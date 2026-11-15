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
  index.tsx          Home screen
src/
  components/        Reusable UI components
  constants/         Theme colors, spacing, and other constants
  hooks/             Custom React hooks
  services/          API clients, storage, and other side effects
assets/              Images, fonts, sounds
```

Import from `src/` with the `@/` alias, e.g. `import { colors } from '@/constants/theme'`.

## App flow

On first launch, the app shows the welcome screen. Choosing **Yes! Show Me How**
opens the first-bird guide; **Skip** on the welcome screen opens the main page.
**Start Searching** on the guide opens the main page. The onboarding choice is
saved on the device, and the `?` button on the main page reopens the guide.

The main page retains BirdNET recording and identification, compass direction,
and bird-call vibration controls. It displays the closest matching bird and
other detected candidates with photos, species details, and confidence scores.
**Feel the Birdsong** reproduces the detected call rhythm through haptic
pulses.

## Scripts

| Command             | Description                 |
| ------------------- | --------------------------- |
| `npm start`         | Start the Expo dev server   |
| `npm run ios`       | Open in the iOS simulator   |
| `npm run android`   | Open in the Android emulator |
| `npm run typecheck` | Run the TypeScript compiler |
