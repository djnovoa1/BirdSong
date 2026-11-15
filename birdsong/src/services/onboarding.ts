import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETE_KEY = '@birdsong/onboarding-complete';

export async function hasCompletedOnboarding() {
  return (await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)) === 'true';
}

export async function completeOnboarding() {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
}
