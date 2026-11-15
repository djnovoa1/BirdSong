"""BirdSong API: receives an audio recording from the app and returns BirdNET detections.

Run from the project root:
    .venv/bin/uvicorn backend.server:app --host 0.0.0.0 --port 8000
"""

import shutil
import tempfile
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import av
import birdnet
import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Formats BirdNET can read directly.
NATIVE_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg"}
# Formats phones record in (iOS: .m4a, Android: .m4a/.3gp), converted to WAV first.
CONVERTED_EXTENSIONS = {".m4a", ".aac", ".mp4", ".3gp", ".caf", ".webm"}
ALLOWED_EXTENSIONS = NATIVE_EXTENSIONS | CONVERTED_EXTENSIONS
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
CONVERT_SAMPLE_RATE = 48_000

model = None
# The model runs its own pool of worker processes; let one request use it at a time.
model_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the model once at startup instead of on every request.
    global model
    model = birdnet.load("acoustic", "3.0", "onnx")
    yield


app = FastAPI(title="BirdSong API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"^https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$"
    ),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


def convert_to_wav(src: Path, dst: Path) -> None:
    """Decode any audio format (e.g. iPhone .m4a) into a mono WAV file BirdNET can read."""
    resampler = av.AudioResampler(format="flt", layout="mono", rate=CONVERT_SAMPLE_RATE)
    chunks = []
    with av.open(str(src)) as container:
        for frame in container.decode(audio=0):
            for out in resampler.resample(frame):
                chunks.append(out.to_ndarray().reshape(-1))
        for out in resampler.resample(None):  # flush buffered samples
            chunks.append(out.to_ndarray().reshape(-1))
    if not chunks:
        raise ValueError("The recording contains no audio.")
    sf.write(str(dst), np.concatenate(chunks), CONVERT_SAMPLE_RATE)


def split_species(label: str) -> tuple[str, str]:
    # BirdNET labels look like "Poecile atricapillus_Black-capped Chickadee".
    scientific, _, common = label.partition("_")
    return scientific, common or scientific


# A plain `def` (not `async def`) so FastAPI runs the slow model call in a
# background thread instead of blocking the server.
@app.post("/detect")
def detect(
    audio: UploadFile = File(..., description="Audio recording of birdsong"),
    min_confidence: float = Query(0.25, ge=0.0, le=1.0),
):
    suffix = Path(audio.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix or 'none'}'. "
            f"Use one of: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir) / f"upload{suffix}"
        with tmp_path.open("wb") as out:
            shutil.copyfileobj(audio.file, out)
        if tmp_path.stat().st_size > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File is larger than 50 MB.")
        if tmp_path.stat().st_size == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        try:
            if suffix in CONVERTED_EXTENSIONS:
                wav_path = Path(tmp_dir) / "upload.wav"
                convert_to_wav(tmp_path, wav_path)
                tmp_path = wav_path
            with model_lock:
                result = model.predict(
                    str(tmp_path), default_confidence_threshold=min_confidence
                )
            df = result.to_dataframe()
        except Exception as exc:
            raise HTTPException(
                status_code=422, detail=f"Could not analyze audio: {exc}"
            ) from exc

    detections = []
    species = {}
    for row in df.itertuples(index=False):
        scientific, common = split_species(row.species_name)
        confidence = round(float(row.confidence), 4)
        detections.append(
            {
                "scientific_name": scientific,
                "common_name": common,
                "start_s": float(row.start_time),
                "end_s": float(row.end_time),
                "confidence": confidence,
            }
        )
        best = species.get(scientific)
        if best is None or confidence > best["confidence"]:
            species[scientific] = {
                "scientific_name": scientific,
                "common_name": common,
                "confidence": confidence,
            }

    return {
        # One entry per species with its best score, highest first: what the app shows.
        "species": sorted(species.values(), key=lambda s: s["confidence"], reverse=True),
        # Every 3-second segment where a species was heard.
        "detections": detections,
    }
