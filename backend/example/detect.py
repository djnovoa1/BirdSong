from pathlib import Path

import birdnet

# Resolve the audio path relative to this file, so the script works from any folder.
AUDIO = str(Path(__file__).parent / "soundscape.wav")


def main():
    # base install
    model_onnx = birdnet.load("acoustic", "3.0", "onnx")
    predictions_onnx = model_onnx.predict(AUDIO)
    predictions_onnx.to_csv("backend/example/predictions.csv")

    model_litert = birdnet.load("acoustic", "2.4", "tf", library="litert")
    predictions_litert = model_litert.predict(AUDIO)

    # birdnet[tf]: the default TFLite interpreter
    model_tflite = birdnet.load("acoustic", "2.4", "tf")
    predictions_tflite = model_tflite.predict(AUDIO)


# BirdNET runs its work in separate worker processes. On macOS each worker
# re-imports this file, so all the work must sit behind this check.
if __name__ == "__main__":
    main()
