import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  background: '#FFFFFF',
  text: '#111111',
  muted: '#666666',
  placeholder: '#D8D8D8',
  accent: '#686868',
};

type ScreenFrameProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function ScreenFrame({ children, contentStyle }: ScreenFrameProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type WireframeButtonProps = {
  label: string;
  onPress: () => void;
  compact?: boolean;
  disabled?: boolean;
};

export function WireframeButton({
  label,
  onPress,
  compact = false,
  disabled = false,
}: WireframeButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compactButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={[styles.buttonLabel, compact && styles.compactButtonLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

type ImagePlaceholderProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ImagePlaceholder({ children, style }: ImagePlaceholderProps) {
  return <View style={[styles.imagePlaceholder, style]}>{children}</View>;
}

export { colors as wireframeColors };

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  button: {
    minHeight: 48,
    minWidth: 140,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.placeholder,
  },
  compactButton: {
    minHeight: 40,
    minWidth: 112,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonLabel: {
    color: colors.text,
    fontSize: 17,
    textAlign: 'center',
  },
  compactButtonLabel: {
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressedButton: {
    opacity: 0.72,
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.placeholder,
  },
});
