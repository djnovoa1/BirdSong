import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type OnboardingProps = {
  error?: string | null;
};

type FirstTimeProps = OnboardingProps & {
  onShowMeHow: () => void;
  onSkip: () => void;
};

type GuideProps = OnboardingProps & {
  onStartSearching: () => void;
};

export function FirstTimeScreen({
  error,
  onShowMeHow,
  onSkip,
}: FirstTimeProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.content, styles.firstTimeContent]}>
        <Text style={styles.title}>Welcome to Bird Song!</Text>
        <Text style={styles.description}>
          An app focused on improving accessibility in bird watching!
        </Text>
        <Text style={styles.question}>Is this your first time?</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          onPress={onShowMeHow}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>Yes! Show Me How!</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onSkip}
          style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function FirstBirdGuideScreen({
  error,
  onStartSearching,
}: GuideProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.guideTitle}>Find Your First Bird!</Text>
        <Text style={styles.guideSubtitle}>A quick guide to Bird Song!</Text>
        <View style={styles.steps}>
          <GuideStep
            number="1."
            title="Start Recording"
            body={'Press “Start Listening” and hold for at least 3 seconds.'}
          />
          <GuideStep
            number="2."
            title="Stop Recording"
            body="After at least 3 seconds, stop recording to identify birds."
          />
          <GuideStep
            number="3."
            title="Learn about the bird"
            body="Your result shows a bird photo, its name, and the estimated direction."
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          onPress={onStartSearching}
          style={({ pressed }) => [
            styles.startButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Start Searching</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function GuideStep({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepNumber}>{number}</Text>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

const colors = {
  background: '#EEF1DE',
  darkGreen: '#1C543C',
  green: '#246247',
  muted: '#4C6656',
  white: '#FFFFFF',
  error: '#8E2D25',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 28,
  },
  firstTimeContent: {
    alignItems: 'center',
  },
  title: {
    color: colors.darkGreen,
    width: '100%',
    fontSize: 29,
    fontWeight: '800',
    lineHeight: 36,
    textAlign: 'center',
  },
  description: {
    color: colors.muted,
    width: '100%',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 16,
    textAlign: 'center',
  },
  question: {
    color: colors.darkGreen,
    width: '100%',
    fontSize: 16,
    marginTop: 28,
    marginBottom: 16,
    textAlign: 'center',
  },
  guideTitle: {
    color: colors.darkGreen,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  guideSubtitle: {
    color: colors.muted,
    fontSize: 15,
    marginTop: 6,
  },
  steps: {
    gap: 20,
    marginTop: 30,
    marginBottom: 28,
  },
  step: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    color: colors.darkGreen,
    fontSize: 15,
    fontWeight: '800',
    width: 22,
  },
  stepCopy: {
    flex: 1,
    gap: 5,
  },
  stepTitle: {
    color: colors.darkGreen,
    fontSize: 15,
    fontWeight: '800',
  },
  stepBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    alignSelf: 'stretch',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.green,
    borderRadius: 8,
    paddingHorizontal: 18,
  },
  startButton: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.green,
    borderRadius: 8,
    marginTop: 4,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  skipButton: {
    alignSelf: 'center',
    minWidth: 88,
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#687B69',
    borderRadius: 8,
    marginTop: 10,
    paddingHorizontal: 18,
  },
  skipButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.78,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
    textAlign: 'center',
  },
});
