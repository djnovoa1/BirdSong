import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  ImagePlaceholder,
  ScreenFrame,
  wireframeColors,
  WireframeButton,
} from '@/components/birdsong-ui';
import {
  getDirectionName,
  useSoundDirectionScanner,
} from '@/hooks/use-sound-direction-scanner';

export default function MainScreen() {
  const router = useRouter();
  const {
    bestDirection,
    error,
    heading,
    isScanning,
    startScan,
    stopScan,
  } = useSoundDirectionScanner();
  const [aboutVisible, setAboutVisible] = useState(false);
  const [hasStartedListening, setHasStartedListening] = useState(false);

  const birdFound = bestDirection !== null;
  const statusText = isScanning
    ? 'Searching...'
    : birdFound
      ? 'Bird Found!'
      : hasStartedListening
        ? 'None found'
        : 'Ready to listen';

  const relativeDirection =
    bestDirection !== null && heading !== null
      ? (bestDirection - heading + 360) % 360
      : null;

  const onListenToggle = async () => {
    if (isScanning) {
      await stopScan();
      return;
    }

    await startScan();
    setHasStartedListening(true);
  };

  return (
    <ScreenFrame contentStyle={styles.content}>
      <View style={styles.topBar}>
        <Text style={styles.status}>{statusText}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/first-bird-guide')}
          style={styles.helpButton}
        >
          <Text style={styles.helpButtonText}>?</Text>
        </Pressable>
      </View>

      <View style={styles.compassPanel}>
        <ImagePlaceholder style={styles.compassBox}>
          {relativeDirection !== null ? (
            <Text
              accessibilityLabel={`Sound direction ${Math.round(relativeDirection)} degrees`}
              style={[
                styles.directionArrow,
                { transform: [{ rotate: `${relativeDirection}deg` }] },
              ]}
            >
              ↑
            </Text>
          ) : null}
        </ImagePlaceholder>
      </View>

      {birdFound ? (
        <View style={styles.foundResults}>
          <Text style={styles.sectionLabel}>Birds Heard</Text>
          <ImagePlaceholder style={styles.birdImage} />
          <View style={styles.birdNameCard}>
            <Text style={styles.birdTitle}>Bird Name</Text>
            <Text style={styles.scientificName}>Scientific name</Text>
          </View>
          <Text style={styles.resultNote}>
            Sound direction: {getDirectionName(bestDirection)}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBlock}>
          <Text style={styles.error}>{error}</Text>
          <WireframeButton
            label={isScanning ? 'Try again' : 'Retry listening'}
            onPress={() => void startScan()}
            compact
          />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: aboutVisible }}
        onPress={() => setAboutVisible((visible) => !visible)}
        style={styles.aboutButton}
      >
        <Text style={styles.aboutLabel}>
          {aboutVisible ? 'Hide bird info' : 'About this bird'}
        </Text>
      </Pressable>

      {aboutVisible ? (
        <View style={styles.aboutCards}>
          <View style={[styles.aboutCard, styles.infographicCard]}>
            <Text style={styles.infoTitle}>Bird calls</Text>
            <View style={styles.soundBars}>
              <View style={[styles.soundBar, styles.shortBar]} />
              <View style={[styles.soundBar, styles.tallBar]} />
              <View style={[styles.soundBar, styles.mediumBar]} />
              <View style={[styles.soundBar, styles.tallBar]} />
              <View style={[styles.soundBar, styles.shortBar]} />
            </View>
            <Text style={styles.infoCaption}>Birds use calls to communicate.</Text>
          </View>
          <ImagePlaceholder style={styles.aboutImage}>
            <Text style={styles.imageLabel}>Bird image</Text>
          </ImagePlaceholder>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <WireframeButton
          label={isScanning ? 'Stop' : 'Start Listening'}
          onPress={() => void onListenToggle()}
          compact={false}
        />
      </View>

      <WireframeButton
        label="Back to start"
        onPress={() =>
          router.replace({ pathname: '/', params: { restart: '1' } })
        }
        compact
      />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 18,
    paddingTop: 28,
    paddingBottom: 32,
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  status: {
    color: wireframeColors.text,
    fontSize: 28,
    textAlign: 'center',
  },
  helpButton: {
    position: 'absolute',
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: wireframeColors.placeholder,
  },
  helpButtonText: {
    color: wireframeColors.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
  },
  compassPanel: {
    width: '100%',
    alignItems: 'center',
  },
  compassBox: {
    width: 180,
    height: 180,
    borderRadius: 18,
    backgroundColor: '#90D588',
  },
  directionArrow: {
    color: '#0B3A10',
    fontSize: 56,
    fontWeight: '700',
  },
  foundResults: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  sectionLabel: {
    width: '100%',
    color: wireframeColors.text,
    fontSize: 22,
    textAlign: 'left',
  },
  birdImage: {
    width: '100%',
    maxWidth: 300,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#1F1F1F',
  },
  birdNameCard: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    paddingVertical: 16,
    backgroundColor: '#D5E7D2',
    borderRadius: 12,
  },
  birdTitle: {
    color: wireframeColors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  scientificName: {
    color: wireframeColors.text,
    fontSize: 16,
    marginTop: 4,
  },
  resultNote: {
    color: wireframeColors.muted,
    fontSize: 14,
  },
  actionRow: {
    width: '100%',
    alignItems: 'center',
  },
  errorBlock: {
    alignItems: 'center',
    gap: 10,
  },
  error: {
    color: '#A00000',
    textAlign: 'center',
  },
  aboutButton: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  aboutLabel: {
    color: wireframeColors.text,
    fontSize: 14,
  },
  aboutCards: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  aboutCard: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'space-between',
    padding: 12,
  },
  infographicCard: {
    backgroundColor: wireframeColors.accent,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  soundBars: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  soundBar: {
    width: 8,
    backgroundColor: '#FFFFFF',
  },
  shortBar: {
    height: 16,
  },
  mediumBar: {
    height: 32,
  },
  tallBar: {
    height: 48,
  },
  infoCaption: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
  },
  aboutImage: {
    flex: 1,
    aspectRatio: 1,
  },
  imageLabel: {
    color: wireframeColors.muted,
    fontSize: 13,
  },
});
