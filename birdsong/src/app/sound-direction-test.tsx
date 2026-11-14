
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';

import * as Location from 'expo-location';

import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

// 15-degree bins = 24 directions around a circle
const BIN_SIZE = 15;
const BIN_COUNT = 360 / BIN_SIZE;

type Bin = {
  sum: number;
  count: number;
};

const emptyBins = (): Bin[] =>
  Array.from({ length: BIN_COUNT }, () => ({
    sum: 0,
    count: 0,
  }));

function getDirectionName(degrees: number) {
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];

  return directions[Math.round(degrees / 22.5) % 16];
}

export default function SoundDirectionScreen() {
  // Microphone setup
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });

  const recorderState = useAudioRecorderState(recorder, 250);

  // Compass and scanning state
  const [heading, setHeading] = useState<number | null>(null);
  const headingRef = useRef<number | null>(null);

  const [compassAccuracy, setCompassAccuracy] = useState<number>(0);
  const [isScanning, setIsScanning] = useState(false);

  // Store measurements for each direction
  const binsRef = useRef<Bin[]>(emptyBins());
  const [bins, setBins] = useState<Bin[]>(emptyBins);

  const headingSubscription = useRef<{ remove: () => void } | null>(
    null
  );

  // Start recording and reading compass
  const startScan = async () => {
    try {
      const locationPermission =
        await Location.requestForegroundPermissionsAsync();

      if (!locationPermission.granted) {
        Alert.alert(
          'Location permission required',
          'The compass needs location permission to report your phone heading. Allow access while using the app, then try again.'
        );
        return;
      }

      const permission = await AudioModule.getRecordingPermissionsAsync();

      if (!permission.granted) {
        const requested =
          await AudioModule.requestRecordingPermissionsAsync();

        if (!requested.granted) {
          Alert.alert('Microphone permission required');
          return;
        }
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Start receiving compass readings
      headingSubscription.current =
        await Location.watchHeadingAsync((result) => {
          const currentHeading = result.magHeading;

          if (
            Number.isFinite(currentHeading) &&
            currentHeading >= 0
          ) {
            headingRef.current = currentHeading;
            setHeading(currentHeading);
            setCompassAccuracy(result.accuracy);
          }
        });

      // Start microphone
      await recorder.prepareToRecordAsync();
      recorder.record();

      setIsScanning(true);
    } catch (error) {
      headingSubscription.current?.remove();
      headingSubscription.current = null;

      Alert.alert('Could not start scanner', String(error));
    }
  };

  // Stop recording and compass
  const stopScan = async () => {
    setIsScanning(false);

    headingSubscription.current?.remove();
    headingSubscription.current = null;

    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
    } catch (error) {
      Alert.alert('Error stopping recording', String(error));
    }
  };

  // Reset all measurements
  const resetScan = () => {
    if (isScanning) return;

    const freshBins = emptyBins();

    binsRef.current = freshBins;
    setBins(freshBins);
    setHeading(null);
    headingRef.current = null;
  };

  // Every time we receive a new microphone measurement,
  // associate it with the current compass direction.
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

    // Find the closest 15-degree direction
    const binIndex =
      Math.round(currentHeading / BIN_SIZE) % BIN_COUNT;

    const previous = binsRef.current[binIndex];

    binsRef.current[binIndex] = {
      sum: previous.sum + level,
      count: previous.count + 1,
    };

    setBins([...binsRef.current]);
  }, [recorderState, isScanning]);

  // Clean up when leaving the page
  useEffect(() => {
    return () => {
      headingSubscription.current?.remove();

      if (recorder.isRecording) {
        void recorder.stop();
      }
    };
  }, [recorder]);

  // Find the direction with the highest average microphone level
  const validBins = bins
    .map((bin, index) => ({
      index,
      count: bin.count,
      average: bin.count > 0 ? bin.sum / bin.count : -Infinity,
    }))
    .filter((bin) => bin.count >= 2);

  const bestBin = validBins.length
    ? [...validBins].sort((a, b) => b.average - a.average)[0]
    : null;

  const bestDirection = bestBin
    ? bestBin.index * BIN_SIZE
    : null;

  const visitedBins = bins.filter((bin) => bin.count > 0).length;
  const progress = (visitedBins / BIN_COUNT) * 100;

  const currentLevel = recorderState.metering;

  const headingOffset = heading ?? 0;

  const coveragePoints = bins.map((bin, index) => {
    const angleDegrees = index * BIN_SIZE - headingOffset - 90;
    const radians = (angleDegrees * Math.PI) / 180;
    const radius = 86;

    return {
      index,
      left: 110 + Math.cos(radians) * radius,
      top: 110 + Math.sin(radians) * radius,
      sampled: bin.count > 0,
    };
  });

  const missingDirections = bins
    .map((bin, index) => ({
      index,
      sampled: bin.count > 0,
    }))
    .filter(({ sampled }) => !sampled)
    .map(({ index }) => {
      const degrees = index * BIN_SIZE;
      return `${getDirectionName(degrees)} (${Math.round(degrees)}°)`;
    });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Sound Direction Tester</Text>

      <Text style={styles.subtitle}>
        Rotate your phone to find where a sound is coming from.
      </Text>

      {/* Direction coverage and detected sound direction */}
      <View style={styles.card}>
        <Text style={styles.label}>MISSING DIRECTIONS</Text>

        <View style={styles.coverageMapWrap}>
          <View style={styles.coverageRing}>
            <View style={styles.coverageFrontMarker} />

            {bestDirection !== null &&
              heading !== null && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.coverageArrowLayer,
                    {
                      transform: [
                        { rotate: `${bestDirection - heading}deg` },
                      ],
                    },
                  ]}
                >
                  <View style={styles.coverageArrowHead} />
                  <View style={styles.coverageArrowStem} />
                </View>
              )}

            {coveragePoints.map(({ index, left, top, sampled }) => (
              <View
                key={`coverage-${index}`}
                style={[
                  styles.coverageDot,
                  {
                    left,
                    top,
                    backgroundColor: sampled ? '#54D6A0' : '#3A4B5F',
                    borderColor: sampled ? '#A7F3D0' : '#7A8AA0',
                  },
                ]}
              />
            ))}

            <View style={styles.coverageCenter}>
              <Text style={styles.coverageCenterText}>
                {missingDirections.length}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.smallText}>
          {bestDirection === null
            ? 'Blue marker shows the direction you are facing. Collect at least 2 readings in a direction to show the strongest direction.'
            : 'Blue marker shows your facing direction; the arrow points toward the strongest detected direction.'}
        </Text>
        <Text style={styles.smallText}>
          {missingDirections.length === 0
            ? 'Full 360° range sampled'
            : missingDirections.length <= 8
              ? `Still need: ${missingDirections.join(', ')}`
              : `Still need: ${missingDirections
                  .slice(0, 8)
                  .join(', ')} +${missingDirections.length - 8} more`}
        </Text>
      </View>

      {/* Microphone readings */}
      <View style={styles.card}>
        <Text style={styles.label}>MICROPHONE LEVEL</Text>

        <Text style={styles.bigNumber}>
          {isScanning && typeof currentLevel === 'number'
            ? `${currentLevel.toFixed(1)} dB`
            : '--'}
        </Text>

        <Text style={styles.smallText}>
          Relative recording level, not calibrated sound pressure
        </Text>
      </View>

      {/* Phone heading and strongest detected direction */}
      <View style={styles.card}>
        <View style={styles.directionInfoRow}>
          <View style={styles.directionInfoColumn}>
            <Text style={styles.label}>PHONE HEADING</Text>
            <Text style={styles.directionInfoNumber}>
              {heading !== null ? `${Math.round(heading)}°` : '--'}
            </Text>
            <Text style={styles.direction}>
              {heading !== null
                ? getDirectionName(heading)
                : 'Waiting for compass'}
            </Text>
            <Text style={styles.smallText}>
              Compass accuracy: {compassAccuracy}
              {' '}
              (3 = high, 2 = medium, 1 = low, 0 = poor)
            </Text>
          </View>

          <View style={styles.directionInfoDivider} />

          <View style={styles.directionInfoColumn}>
            <Text style={styles.label}>STRONGEST DETECTED</Text>
            <Text style={styles.directionInfoNumber}>
              {bestDirection !== null ? `${bestDirection}°` : '--'}
            </Text>
            <Text style={styles.direction}>
              {bestDirection !== null
                ? getDirectionName(bestDirection)
                : 'No result yet'}
            </Text>
            <Text style={styles.smallText}>
              {bestBin
                ? `${bestBin.count} measurements`
                : 'Rotate to collect measurements'}
            </Text>
          </View>
        </View>
      </View>

      {/* Scan progress */}
      <View style={styles.card}>
        <Text style={styles.label}>DIRECTION COVERAGE</Text>
        <Text style={styles.progressText}>
          {visitedBins} / {BIN_COUNT} directions sampled
        </Text>

        <View style={styles.progressBackground}>
          <View
            style={[styles.progressFill, { width: `${progress}%` }]}
          />
        </View>

        <Text style={styles.smallText}>
          {Math.round(progress)}% of compass directions visited
        </Text>
      </View>

      {/* Controls */}
      <Pressable
        style={[
          styles.button,
          isScanning ? styles.stopButton : styles.startButton,
        ]}
        onPress={isScanning ? stopScan : startScan}
      >
        <Text style={styles.buttonText}>
          {isScanning ? 'Stop Scanning' : 'Start Scanning'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.resetButton}
        onPress={resetScan}
        disabled={isScanning}
      >
        <Text style={styles.resetText}>
          Reset Measurements
        </Text>
      </Pressable>

      <Text style={styles.instructions}>
        Place a continuous sound source somewhere in the room.
        Start scanning, slowly rotate your phone through 360°,
        and watch which direction produces the strongest readings.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 22,
    paddingTop: 60,
    paddingBottom: 50,
    backgroundColor: '#101827',
    flexGrow: 1,
  },
  title: {
    fontSize: 27,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    color: '#AAB5C5',
    fontSize: 15,
    marginBottom: 25,
  },
  card: {
    backgroundColor: '#202D40',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
  },
  label: {
    color: '#9BAAC0',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  bigNumber: {
    color: 'white',
    fontSize: 42,
    fontWeight: 'bold',
    marginTop: 10,
  },
  direction: {
    color: '#54D6A0',
    fontSize: 20,
    fontWeight: 'bold',
  },
  smallText: {
    color: '#9BAAC0',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  progressText: {
    color: 'white',
    marginTop: 12,
  },
  progressBackground: {
    height: 9,
    backgroundColor: '#39485C',
    borderRadius: 10,
    width: '100%',
    marginTop: 15,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#54D6A0',
  },
  directionInfoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  directionInfoColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  directionInfoDivider: {
    width: 1,
    backgroundColor: '#485C74',
    marginHorizontal: 8,
  },
  directionInfoNumber: {
    color: 'white',
    fontSize: 34,
    fontWeight: 'bold',
    marginTop: 10,
  },
  button: {
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  startButton: {
    backgroundColor: '#168B65',
  },
  stopButton: {
    backgroundColor: '#C44949',
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  resetButton: {
    padding: 15,
    alignItems: 'center',
  },
  resetText: {
    color: '#AAB5C5',
    fontSize: 14,
  },
  instructions: {
    color: '#9BAAC0',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 15,
    textAlign: 'center',
  },
  coverageMapWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  coverageRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: '#485C74',
    backgroundColor: '#182334',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverageDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    marginLeft: -6,
    marginTop: -6,
  },
  coverageArrowLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 220,
    height: 220,
  },
  coverageArrowHead: {
    position: 'absolute',
    top: 34,
    left: 101,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FACC15',
  },
  coverageArrowStem: {
    position: 'absolute',
    top: 46,
    left: 108,
    width: 4,
    height: 44,
    borderRadius: 2,
    backgroundColor: '#FACC15',
  },
  coverageFrontMarker: {
    position: 'absolute',
    top: 8,
    left: '50%',
    width: 4,
    height: 22,
    marginLeft: -2,
    borderRadius: 2,
    backgroundColor: '#38BDF8',
  },
  coverageCenter: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#54D6A0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverageCenterText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
