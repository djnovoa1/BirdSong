import { useEffect, useState } from 'react';
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
    startScan,
  } = useSoundDirectionScanner();
  const [aboutVisible, setAboutVisible] = useState(false);

  useEffect(() => {
    void startScan();
  }, [startScan]);

  const birdFound = bestDirection !== null;
  const relativeDirection =
    bestDirection !== null && heading !== null
      ? (bestDirection - heading + 360) % 360
      : null;

  return (
    <ScreenFrame contentStyle={styles.content}>
      <Text style={styles.status}>
        {birdFound ? 'Bird Found!' : 'Searching...'}
      </Text>

      <ImagePlaceholder style={styles.birdImage}>
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

      <View style={styles.birdName}>
        <Text style={styles.birdTitle}>Bird Name</Text>
        <Text style={styles.scientificName}>Scientific name</Text>
      </View>

      {birdFound ? (
        <Text style={styles.resultNote}>
          Sound direction: {getDirectionName(bestDirection)}
        </Text>
      ) : null}

      {error ? (
        <View style={styles.errorBlock}>
          <Text style={styles.error}>{error}</Text>
          <WireframeButton
            label="Try again"
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
            <Text style={styles.infoCaption}>
              Birds use calls to communicate.
            </Text>
          </View>
          <ImagePlaceholder style={styles.aboutImage}>
            <Text style={styles.imageLabel}>Bird image</Text>
          </ImagePlaceholder>
        </View>
      ) : null}

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
    paddingTop: 34,
    paddingBottom: 32,
  },
  status: {
    color: wireframeColors.text,
    fontSize: 28,
    textAlign: 'center',
  },
  birdImage: {
    width: '80%',
    maxWidth: 300,
  },
  directionArrow: {
    color: wireframeColors.accent,
    fontSize: 56,
    fontWeight: '700',
  },
  birdName: {
    width: '90%',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: wireframeColors.placeholder,
  },
  birdTitle: {
    color: wireframeColors.text,
    fontSize: 25,
  },
  scientificName: {
    color: wireframeColors.muted,
    fontSize: 13,
  },
  resultNote: {
    color: wireframeColors.muted,
    fontSize: 14,
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
