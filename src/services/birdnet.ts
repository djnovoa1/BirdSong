import Constants from 'expo-constants';
import { File } from 'expo-file-system';

export type Species = {
  scientific_name: string;
  common_name: string;
  confidence: number;
};

export type Detection = Species & {
  start_s: number;
  end_s: number;
};

export type DetectResponse = {
  species: Species[];
  detections: Detection[];
};

export type BackendHealth = {
  status: string;
  model_loaded: boolean;
};

// The BirdSong backend (uvicorn), not the Expo dev server, which uses 8081.
const API_PORT = 8000;
const TAXONOMY_IMAGE_API = 'https://birdnet.cornell.edu/taxonomy/api/image';

export function getSpeciesImageUrl(scientificName: string): string {
  return `${TAXONOMY_IMAGE_API}/${encodeURIComponent(scientificName)}?size=medium`;
}

/**
 * Where the BirdSong backend lives.
 *
 * Set EXPO_PUBLIC_API_URL (e.g. in a `.env` file) to point at a deployed server.
 * Otherwise, during development, use the same computer that runs the Expo dev
 * server: a phone can't reach the Mac through "localhost", but it already
 * knows the Mac's network address from the dev server connection.
 */
export function getApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${devHost ?? 'localhost'}:${API_PORT}`;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiUrl()}/health`, { cache: 'no-store' });
    if (!response.ok) return false;
    const health = (await response.json()) as BackendHealth;
    return health.status === 'ok' && health.model_loaded;
  } catch {
    return false;
  }
}

export async function detectBirds(
  recordingUri: string,
  minConfidence = 0.25,
): Promise<DetectResponse> {
  const extension = recordingUri.split('.').pop()?.toLowerCase() || 'm4a';

  const form = new FormData();
  // Expo's fetch expects Blob-compatible parts; the { uri, name, type } shape
  // used by older React Native FormData implementations is rejected.
  form.append('audio', new File(recordingUri), `recording.${extension}`);

  const url = `${getApiUrl()}/detect?min_confidence=${minConfidence}`;

  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', body: form });
  } catch {
    throw new Error(
      `Couldn't reach the BirdSong server at ${getApiUrl()}. ` +
        'Make sure it is running and your phone is on the same Wi-Fi network.',
    );
  }

  if (!response.ok) {
    let detail = `Server error (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.detail === 'string') detail = body.detail;
    } catch {
      // Response wasn't JSON; keep the generic message.
    }
    throw new Error(detail);
  }

  return response.json();
}
