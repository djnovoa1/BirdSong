import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { detectBirds, type Species } from '@/services/birdnet';

// BirdNET listens in 3-second chunks, so anything shorter can't be analyzed.
const MIN_RECORDING_MS = 3000;

type Status = 'idle' | 'recording' | 'analyzing' | 'done' | 'error';

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function HomeScreen() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  const [status, setStatus] = useState<Status>('idle');
  const [species, setSpecies] = useState<Species[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  async function startRecording() {
    setError(null);
    setSpecies([]);

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setPermissionDenied(true);
      setStatus('error');
      setError('BirdSong needs microphone access to listen for birds.');
      return;
    }
    setPermissionDenied(false);

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('recording');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Could not start recording.');
    }
  }

  async function stopAndAnalyze() {
    const durationMs = recorderState.durationMillis;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });

    if (durationMs < MIN_RECORDING_MS) {
      setStatus('error');
      setError('Record for at least 3 seconds so BirdNET has enough to listen to.');
      return;
    }

    const uri = recorder.uri;
    if (!uri) {
      setStatus('error');
      setError('The recording could not be saved. Please try again.');
      return;
    }

    setStatus('analyzing');
    try {
      const result = await detectBirds(uri);
      setSpecies(result.species);
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  const isRecording = status === 'recording';
  const isAnalyzing = status === 'analyzing';

  return (
    <View style={styles.container}>
      <View style={styles.recorder}>
        <Text style={styles.timer}>
          {formatDuration(isRecording ? recorderState.durationMillis : 0)}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
          disabled={isAnalyzing}
          onPress={isRecording ? stopAndAnalyze : startRecording}
          style={({ pressed }) => [
            styles.recordButton,
            isRecording && styles.recordButtonActive,
            (pressed || isAnalyzing) && styles.recordButtonPressed,
          ]}
        >
          <View style={isRecording ? styles.stopIcon : styles.recordIcon} />
        </Pressable>

        <Text style={styles.hint}>
          {isRecording
            ? 'Listening… tap to stop and identify'
            : isAnalyzing
              ? 'Identifying birds…'
              : 'Tap to record birdsong'}
        </Text>
      </View>

      {isAnalyzing && <ActivityIndicator size="large" color={colors.primary} />}

      {status === 'error' && error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          {permissionDenied && (
            <Pressable onPress={() => Linking.openSettings()}>
              <Text style={styles.link}>Open Settings</Text>
            </Pressable>
          )}
        </View>
      )}

      {status === 'done' && (
        <FlatList
          data={species}
          keyExtractor={(item) => item.scientific_name}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            species.length > 0 ? <Text style={styles.listTitle}>Birds heard</Text> : undefined
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              No birds identified. Try getting closer or recording for longer.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.commonName}>{item.common_name}</Text>
                <Text style={styles.scientificName}>{item.scientific_name}</Text>
              </View>
              <Text style={styles.confidence}>{Math.round(item.confidence * 100)}%</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  recorder: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  timer: {
    fontSize: 40,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    color: colors.text,
    marginBottom: spacing.lg,
  },
  recordButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonActive: {
    borderColor: colors.recording,
  },
  recordButtonPressed: {
    opacity: 0.5,
  },
  recordIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
  },
  stopIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.recording,
  },
  hint: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.muted,
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  errorText: {
    color: colors.error,
    fontSize: 15,
  },
  link: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  list: {
    paddingBottom: spacing.xl,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  empty: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
  },
  commonName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  scientificName: {
    marginTop: 2,
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.muted,
  },
  confidence: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary,
  },
});
