import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  ScreenFrame,
  wireframeColors,
  WireframeButton,
} from '@/components/birdsong-ui';
import { completeOnboarding } from '@/services/onboarding';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function FirstTimeScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const skipGuide = async () => {
    try {
      await completeOnboarding();
      router.replace('/main');
    } catch (storageError) {
      setError(`Could not save your onboarding choice: ${getErrorMessage(storageError)}`);
    }
  };

  return (
    <ScreenFrame contentStyle={styles.content}>
      <View style={styles.message}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.question}>Is this your first time?</Text>
      </View>

      <View style={styles.actions}>
        <WireframeButton
          label="Yes! Show Me How"
          onPress={() => router.push('/first-bird-guide')}
        />
        <WireframeButton label="Skip" onPress={() => void skipGuide()} compact />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  message: {
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: wireframeColors.text,
    fontSize: 28,
    textAlign: 'center',
  },
  question: {
    color: wireframeColors.text,
    fontSize: 17,
    textAlign: 'center',
  },
  actions: {
    alignItems: 'center',
    gap: 10,
  },
  error: {
    maxWidth: 300,
    color: '#A00000',
    textAlign: 'center',
  },
});
