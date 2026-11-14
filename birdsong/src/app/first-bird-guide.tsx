import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  ScreenFrame,
  wireframeColors,
  WireframeButton,
} from '@/components/birdsong-ui';
import { completeOnboarding } from '@/services/onboarding';

const guideSteps = [
  {
    title: 'Point Your Phone',
    description: 'Aim your phone at the trees or open sky around you.',
  },
  {
    title: 'Follow the arrow',
    description: 'When a bird is detected, the arrow will point you to the direction of the bird.',
  },
  {
    title: 'Learn about the bird',
    description: 'Tap “About this bird” to learn a little bit more about the bird.',
  },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function FirstBirdGuideScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const startWatching = async () => {
    try {
      await completeOnboarding();
      router.replace('/main');
    } catch (storageError) {
      setError(`Could not save your onboarding choice: ${getErrorMessage(storageError)}`);
    }
  };

  return (
    <ScreenFrame contentStyle={styles.content}>
      <View style={styles.intro}>
        <Text style={styles.title}>Find your first bird!</Text>
        <Text style={styles.subtitle}>
          A quick guide to bird spotting with Bird Song.
        </Text>
      </View>

      <View style={styles.steps}>
        {guideSteps.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <Text style={styles.number}>{index + 1}</Text>
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.description}>{step.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <WireframeButton
          label="Start watching"
          onPress={() => void startWatching()}
        />
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'space-between',
    gap: 28,
  },
  intro: {
    gap: 12,
    paddingTop: 28,
  },
  title: {
    color: wireframeColors.text,
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    color: wireframeColors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  steps: {
    gap: 26,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  number: {
    width: 16,
    color: wireframeColors.text,
    fontSize: 17,
  },
  stepCopy: {
    flex: 1,
    gap: 6,
  },
  stepTitle: {
    color: wireframeColors.text,
    fontSize: 17,
  },
  description: {
    color: wireframeColors.text,
    fontSize: 14,
    lineHeight: 19,
  },
  footer: {
    gap: 12,
    paddingBottom: 8,
  },
  error: {
    color: '#A00000',
    textAlign: 'center',
  },
});
