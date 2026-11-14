import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as Location from 'expo-location';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

export const BIN_SIZE = 15;
export const BIN_COUNT = 360 / BIN_SIZE;

export type DirectionBin = {
  sum: number;
  count: number;
};

export type BestDirectionBin = {
  index: number;
  count: number;
  average: number;
};

const emptyBins = (): DirectionBin[] =>
  Array.from({ length: BIN_COUNT }, () => ({ sum: 0, count: 0 }));

export function getDirectionName(degrees: number) {
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];

  return directions[Math.round(degrees / 22.5) % 16];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useSoundDirectionScanner() {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 250);
  const [heading, setHeading] = useState<number | null>(null);
  const headingRef = useRef<number | null>(null);
  const [compassAccuracy, setCompassAccuracy] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const isScanningRef = useRef(false);
  const isStartingRef = useRef(false);
  const binsRef = useRef<DirectionBin[]>(emptyBins());
  const [bins, setBins] = useState<DirectionBin[]>(emptyBins);
  const [error, setError] = useState<string | null>(null);
  const headingSubscription = useRef<{ remove: () => void } | null>(null);

  const startScan = useCallback(async () => {
    if (isScanningRef.current || isStartingRef.current) return;

    isStartingRef.current = true;
    setError(null);

    try {
      const locationPermission =
        await Location.requestForegroundPermissionsAsync();

      if (!locationPermission.granted) {
        setError(
          'Location access is needed to read the phone compass. Allow access and try again.'
        );
        return;
      }

      const currentPermission =
        await AudioModule.getRecordingPermissionsAsync();
      const audioPermission = currentPermission.granted
        ? currentPermission
        : await AudioModule.requestRecordingPermissionsAsync();

      if (!audioPermission.granted) {
        setError('Microphone access is needed to listen for bird calls.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      headingSubscription.current = await Location.watchHeadingAsync(
        (result) => {
          if (Number.isFinite(result.magHeading) && result.magHeading >= 0) {
            headingRef.current = result.magHeading;
            setHeading(result.magHeading);
            setCompassAccuracy(result.accuracy);
          }
        }
      );

      await recorder.prepareToRecordAsync();
      recorder.record();
      isScanningRef.current = true;
      setIsScanning(true);
    } catch (scanError) {
      headingSubscription.current?.remove();
      headingSubscription.current = null;
      setError(`Could not start listening: ${getErrorMessage(scanError)}`);
    } finally {
      isStartingRef.current = false;
    }
  }, [recorder]);

  const stopScan = useCallback(async () => {
    isScanningRef.current = false;
    setIsScanning(false);
    headingSubscription.current?.remove();
    headingSubscription.current = null;

    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
    } catch (scanError) {
      setError(`Could not stop listening: ${getErrorMessage(scanError)}`);
    }
  }, [recorder]);

  const resetScan = useCallback(() => {
    if (isScanningRef.current) return;

    const freshBins = emptyBins();
    binsRef.current = freshBins;
    setBins(freshBins);
    setHeading(null);
    headingRef.current = null;
    setError(null);
  }, []);

  useEffect(() => {
    if (!isScanning) return;

    const level = recorderState.metering;
    const currentHeading = headingRef.current;

    if (
      typeof level !== 'number' ||
      !Number.isFinite(level) ||
      currentHeading === null
    ) {
      return;
    }

    const binIndex = Math.round(currentHeading / BIN_SIZE) % BIN_COUNT;
    const previous = binsRef.current[binIndex];
    binsRef.current[binIndex] = {
      sum: previous.sum + level,
      count: previous.count + 1,
    };
    setBins([...binsRef.current]);
  }, [recorderState, isScanning]);

  useEffect(
    () => () => {
      headingSubscription.current?.remove();

      if (recorder.isRecording) {
        void recorder.stop().catch((stopError: unknown) => {
          console.error(
            'Could not stop audio recording after leaving the scanner.',
            stopError
          );
        });
      }
    },
    [recorder]
  );

  const bestBin = useMemo<BestDirectionBin | null>(() => {
    const candidates = bins
      .map((bin, index) => ({
        index,
        count: bin.count,
        average: bin.count > 0 ? bin.sum / bin.count : -Infinity,
      }))
      .filter((bin) => bin.count >= 2);

    candidates.sort((first, second) => second.average - first.average);
    return candidates[0] ?? null;
  }, [bins]);

  return {
    bestBin,
    bestDirection: bestBin ? bestBin.index * BIN_SIZE : null,
    bins,
    compassAccuracy,
    error,
    heading,
    isScanning,
    recorderState,
    resetScan,
    startScan,
    stopScan,
  };
}
