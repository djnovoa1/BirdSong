import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  ImagePlaceholder,
  ScreenFrame,
  wireframeColors,
  WireframeButton,
} from '@/components/birdsong-ui';
import { hasCompletedOnboarding } from '@/services/onboarding';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function IntroScreen() {
  const router = useRouter();
  const { restart } = useLocalSearchParams<{ restart?: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    if (restart === '1') {
      setError(null);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const checkOnboarding = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const complete = await hasCompletedOnboarding();
        if (!isMounted) return;

        if (complete) {
          router.replace('/main');
          return;
        }

        setIsLoading(false);
      } catch (storageError) {
        if (!isMounted) return;

        setError(`Could not load your onboarding status: ${getErrorMessage(storageError)}`);
        setIsLoading(false);
      }
    };

    void checkOnboarding();
    return () => {
      isMounted = false;
    };
  }, [restart, retryCount, router]);

  if (isLoading) {
    return (
      <ScreenFrame contentStyle={styles.centered}>
        <ActivityIndicator color={wireframeColors.text} />
      </ScreenFrame>
    );
  }

  if (error) {
    return (
      <ScreenFrame contentStyle={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <WireframeButton
          label="Try again"
          onPress={() => setRetryCount((count) => count + 1)}
          compact
        />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame contentStyle={styles.content}>
      <Text style={styles.title}>Bird Song</Text>
      <ImagePlaceholder style={styles.heroImage} />
      <Text style={styles.tagline}>
        Making Bird Watching more Accessible!
      </Text>
      <WireframeButton
        label="Start"
        onPress={() => router.push('/first-time')}
        compact
      />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: 24,
  },
  title: {
    color: wireframeColors.text,
    fontSize: 28,
    textAlign: 'center',
  },
  heroImage: {
    width: '82%',
    maxWidth: 280,
  },
  tagline: {
    maxWidth: 300,
    color: wireframeColors.text,
    fontSize: 27,
    lineHeight: 34,
    textAlign: 'center',
  },
  error: {
    maxWidth: 320,
    color: '#A00000',
    textAlign: 'center',
  },
});
