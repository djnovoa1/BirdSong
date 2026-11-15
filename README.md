# BirdSong

A cross-platform mobile app (iOS and Android) built with [Expo](https://expo.dev) and React Native.

## Getting started

```bash
npm install
npx expo install --fix   # align dependency versions with the installed Expo SDK
npm start
```

Then press `i` for the iOS simulator, `a` for the Android emulator, or scan the QR code with Expo Go.

## Project structure

```
app/                 Screens and navigation (file-based routing via expo-router)
  _layout.tsx        Root navigation stack
  index.tsx          Onboarding and BirdSong listening screen
src/
  components/        Reusable UI and onboarding screens
  constants/         Theme colors, spacing, and other constants
  hooks/             Custom React hooks
  services/          BirdNET API client, onboarding storage, and other side effects
assets/              Images, fonts, sounds
```

Import from `src/` with the `@/` alias, e.g. `import { colors } from '@/constants/theme'`.

## Scripts

| Command             | Description                 |
| ------------------- | --------------------------- |
| `npm start`         | Start the Expo dev server   |
| `npm run ios`       | Open in the iOS simulator   |
| `npm run android`   | Open in the Android emulator |
| `npm run typecheck` | Run the TypeScript compiler |
