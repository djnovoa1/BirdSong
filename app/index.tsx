import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Vibration,
} from "react-native";

import * as Haptics from "expo-haptics";

import { colors, spacing } from "@/constants/theme";
import {
  FirstBirdGuideScreen,
  FirstTimeScreen,
} from "@/components/onboarding";
import {
  checkBackendHealth,
  detectBirds,
  getApiUrl,
  getSpeciesImageUrl,
  type Species,
} from "@/services/birdnet";
import {
  completeOnboarding,
  hasCompletedOnboarding,
} from "@/services/onboarding";

const MIN_RECORDING_MS = 3000;
const BIN_SIZE = 15;
const BIN_COUNT = 360 / BIN_SIZE;
const COMPASS_SIZE = 260;
const COMPASS_CENTER = COMPASS_SIZE / 2;
const COMPASS_RADIUS = COMPASS_SIZE * 0.39;
const DIRECTIONS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

type SoundBin = { energy: number; samples: number };
type Status = "idle" | "recording" | "analyzing" | "done" | "error";
type AppScreen = "loading" | "storage-error" | "first-time" | "guide" | "main";

const createBins = (): SoundBin[] =>
  Array.from({ length: BIN_COUNT }, () => ({ energy: 0, samples: 0 }));

function directionName(degrees: number) {
  return DIRECTIONS[Math.round(degrees / 22.5) % DIRECTIONS.length];
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export default function HomeScreen() {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 25);
  const [appScreen, setAppScreen] = useState<AppScreen>("loading");
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [species, setSpecies] = useState<Species[]>([]);
  const [failedSpeciesImage, setFailedSpeciesImage] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [compassAccuracy, setCompassAccuracy] = useState<number | null>(null);
  const [savedBearing, setSavedBearing] = useState<number | null>(null);
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "ready" | "offline"
  >("checking");
  const [analysisElapsed, setAnalysisElapsed] = useState(0);
  const [bins, setBins] = useState<SoundBin[]>(createBins);
  const binsRef = useRef<SoundBin[]>(createBins());
  const headingRef = useRef<number | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const isRecording = status === "recording";
  const isAnalyzing = status === "analyzing";
  const rankedSpecies = useMemo(
    () => [...species].sort((a, b) => b.confidence - a.confidence),
    [species],
  );
  const featuredSpecies = rankedSpecies[0] ?? null;

  const levelsRef = useRef<{ time: number; db: number }[]>([]);
  const playbackIdRef = useRef(0);
  const activePlaybackRef = useRef(false);
  const [isPlayingRhythm, setIsPlayingRhythm] = useState(false);

  useEffect(() => {
    let isMounted = true;
    hasCompletedOnboarding()
      .then((completed) => {
        if (isMounted) setAppScreen(completed ? "main" : "first-time");
      })
      .catch((e: unknown) => {
        if (!isMounted) return;
        setOnboardingError(
          e instanceof Error ? e.message : "The saved setup could not be read.",
        );
        setAppScreen("storage-error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (status !== "recording") return;

    const db = recorderState.metering;

    if (typeof db === "number") {
      levelsRef.current.push({
        time: recorderState.durationMillis,
        db,
      });
    }
  }, [status, recorderState.durationMillis, recorderState.metering]);

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      const ready = await checkBackendHealth();
      if (isMounted) setBackendStatus(ready ? "ready" : "offline");
    };
    void check();
    const interval = setInterval(() => void check(), 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(
      () => setAnalysisElapsed((seconds) => seconds + 1),
      1000,
    );
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  async function refreshBackend() {
    setBackendStatus("checking");
    const ready = await checkBackendHealth();
    setBackendStatus(ready ? "ready" : "offline");
  }

  async function retryOnboardingLoad() {
    setAppScreen("loading");
    setOnboardingError(null);
    try {
      const completed = await hasCompletedOnboarding();
      setAppScreen(completed ? "main" : "first-time");
    } catch (e) {
      setOnboardingError(
        e instanceof Error ? e.message : "The saved setup could not be read.",
      );
      setAppScreen("storage-error");
    }
  }

  async function finishFirstTime(nextScreen: "guide" | "main") {
    setOnboardingError(null);
    try {
      await completeOnboarding();
    } catch (e) {
      setOnboardingError(
        e instanceof Error
          ? `Your choice could not be saved: ${e.message}`
          : "Your choice could not be saved. You may see this screen again next time.",
      );
    }
    setAppScreen(nextScreen);
  }

  useEffect(() => {
    if (!isRecording || Platform.OS === "web") return;
    const level = recorderState.metering;
    const currentHeading = headingRef.current;
    if (
      typeof level !== "number" ||
      !Number.isFinite(level) ||
      currentHeading === null
    )
      return;

    const index = Math.round(currentHeading / BIN_SIZE) % BIN_COUNT;
    const current = binsRef.current[index];
    // Metering is in dB. Convert to power before averaging so louder readings count more.
    binsRef.current[index] = {
      energy: current.energy + 10 ** (level / 10),
      samples: current.samples + 1,
    };
    setBins([...binsRef.current]);
  }, [isRecording, recorderState]);

  useEffect(
    () => () => {
      subscriptionRef.current?.remove();
      if (recorder.isRecording) void recorder.stop();
    },
    [recorder],
  );

  const loudestBearing = useMemo(() => {
    let bestIndex = -1;
    let bestAverage = -Infinity;
    bins.forEach((bin, index) => {
      if (bin.samples < 2) return;
      const average = bin.energy / bin.samples;
      if (average > bestAverage) {
        bestAverage = average;
        bestIndex = index;
      }
    });
    return bestIndex < 0 ? null : bestIndex * BIN_SIZE;
  }, [bins]);

  const visitedBins = bins.filter((bin) => bin.samples > 0).length;
  const missingDirections = bins.flatMap((bin, index) =>
    bin.samples > 0
      ? []
      : [`${directionName(index * BIN_SIZE)} (${index * BIN_SIZE}°)`],
  );
  const coveragePoints = bins.map((bin, index) => {
    const angle = ((index * BIN_SIZE - (heading ?? 0) - 90) * Math.PI) / 180;
    return {
      index,
      left: COMPASS_CENTER + Math.cos(angle) * COMPASS_RADIUS,
      top: COMPASS_CENTER + Math.sin(angle) * COMPASS_RADIUS,
      sampled: bin.samples > 0,
    };
  });

  async function startListening() {
    levelsRef.current = [];
    setError(null);
    setSpecies([]);
    setPermissionDenied(false);
    const freshBins = createBins();
    binsRef.current = freshBins;
    setBins(freshBins);
    setSavedBearing(null);

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setPermissionDenied(true);
        setStatus("error");
        setError("BirdSong needs microphone access to listen for birds.");
        return;
      }

      if (Platform.OS !== "web" && !subscriptionRef.current) {
        const locationPermission =
          await Location.requestForegroundPermissionsAsync();
        if (locationPermission.granted) {
          subscriptionRef.current = await Location.watchHeadingAsync(
            (reading) => {
              if (
                Number.isFinite(reading.magHeading) &&
                reading.magHeading >= 0
              ) {
                headingRef.current = reading.magHeading;
                setHeading(reading.magHeading);
                setCompassAccuracy(reading.accuracy);
              }
            },
          );
        }
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus("recording");
    } catch (e) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not start listening.");
    }
  }

  async function stopAndIdentify() {
    const durationMs = recorderState.durationMillis;
    setSavedBearing(loudestBearing);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      if (durationMs < MIN_RECORDING_MS) {
        setStatus("error");
        setError(
          "Listen for at least 3 seconds so BirdNET has enough audio to identify.",
        );
        return;
      }
      const uri = recorder.uri;
      if (!uri)
        throw new Error("The recording could not be saved. Please try again.");

      setAnalysisElapsed(0);
      setStatus("analyzing");
      const result = await detectBirds(uri);
      setSpecies(result.species);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong while identifying birds.",
      );
    }
  }

  function stopBirdRhythm() {
    playbackIdRef.current++;
    activePlaybackRef.current = false;
    setIsPlayingRhythm(false);
    Vibration.cancel();
  }

  async function playBirdRhythm() {
    if (activePlaybackRef.current || status !== "done") return;

    const levels = levelsRef.current.filter(
      (l) => Number.isFinite(l.time) && Number.isFinite(l.db),
    );

    if (levels.length < 3) return;

    const sorted = levels.map((l) => l.db).sort((a, b) => a - b);
    const baseline = sorted[Math.floor(sorted.length / 2)];

    // Group consecutive loud readings into individual chirps
    type Chirp = { start: number; end: number; peakDb: number };
    const chirps: Chirp[] = [];
    let current: Chirp | null = null;

    for (const { time, db } of levels) {
      if (db < baseline + 3) continue;

      // Allow small gaps within one chirp
      if (current && time - current.end <= 80) {
        current.end = time;
        current.peakDb = Math.max(current.peakDb, db);
      } else {
        if (current) chirps.push(current);
        current = { start: time, end: time, peakDb: db };
      }
    }

    if (current) chirps.push(current);
    if (chirps.length === 0) return;

    const playbackId = ++playbackIdRef.current;
    activePlaybackRef.current = true;
    setIsPlayingRhythm(true);

    const startedAt = Date.now();
    const firstTime = chirps[0].start;

    try {
      for (const chirp of chirps.slice(0, 30)) {
        if (playbackId !== playbackIdRef.current) break;

        const targetMs = chirp.start - firstTime;
        const waitMs = Math.max(0, targetMs - (Date.now() - startedAt));

        if (waitMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
        }

        if (playbackId !== playbackIdRef.current) break;

        const duration = chirp.end - chirp.start + 25;
        const difference = chirp.peakDb - baseline;

        if (duration >= 200) {
          // Sustained sound -> buzz
          Vibration.vibrate(
            Platform.OS === "android" ? Math.min(duration, 600) : undefined,
          );
        } else {
          // Short chirp -> tap based on loudness
          const intensity =
            difference >= 12
              ? Haptics.ImpactFeedbackStyle.Heavy
              : difference >= 6
                ? Haptics.ImpactFeedbackStyle.Medium
                : Haptics.ImpactFeedbackStyle.Light;

          await Haptics.impactAsync(intensity);
        }
      }
    } finally {
      if (playbackId === playbackIdRef.current) {
        activePlaybackRef.current = false;
        setIsPlayingRhythm(false);
      }
    }
  }

  const displayedBearing = isRecording
    ? loudestBearing
    : (savedBearing ?? loudestBearing);
  const arrowRotation =
    displayedBearing !== null && heading !== null
      ? displayedBearing - heading
      : 0;
  const cardinalCounterRotation = {
    transform: [{ rotate: `${heading ?? 0}deg` }],
  };
  const compassLabel =
    displayedBearing === null
      ? "Rotate slowly while listening"
      : `${directionName(displayedBearing)} · ${Math.round(displayedBearing)}°`;

  if (appScreen === "loading") {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (appScreen === "storage-error") {
    return (
      <View style={styles.storageErrorPage}>
        <Text style={styles.storageErrorTitle}>
          Could not load your setup
        </Text>
        <Text style={styles.storageErrorText}>
          {onboardingError ?? "Please check your device storage and try again."}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void retryOnboardingLoad()}
          style={styles.primaryAction}
        >
          <Text style={styles.primaryActionText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (appScreen === "first-time") {
    return (
      <FirstTimeScreen
        error={onboardingError}
        onShowMeHow={() => void finishFirstTime("guide")}
        onSkip={() => void finishFirstTime("main")}
      />
    );
  }

  if (appScreen === "guide") {
    return (
      <FirstBirdGuideScreen
        error={onboardingError}
        onStartSearching={() => setAppScreen("main")}
      />
    );
  }

  const pageTitle =
    isRecording || isAnalyzing
      ? "Searching…"
      : status === "done"
        ? rankedSpecies.length > 0
          ? "Bird Found!"
          : "None Found."
        : "…";

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text accessibilityLiveRegion="polite" style={styles.title}>
              {pageTitle}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Return to the first bird guide"
              onPress={() => setAppScreen("guide")}
              style={({ pressed }) => [
                styles.helpButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.helpButtonText}>?</Text>
            </Pressable>
          </View>
          {backendStatus !== "ready" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Check BirdNET server connection"
              onPress={refreshBackend}
              style={[
                styles.serverPill,
                backendStatus === "offline"
                  ? styles.serverOffline
                  : styles.serverChecking,
              ]}
            >
              <View
                style={[
                  styles.serverDot,
                  backendStatus === "offline"
                    ? styles.serverDotOffline
                    : styles.serverDotChecking,
                ]}
              />
              <Text style={styles.serverText}>
                {backendStatus === "offline"
                  ? "Server offline · tap to retry"
                  : "Checking server…"}
              </Text>
            </Pressable>
          )}
          {backendStatus === "offline" && (
            <Text style={styles.serverHelp}>
              Start the BirdSong backend on your computer. This app is checking{" "}
              {getApiUrl()}.
            </Text>
          )}
          {onboardingError && (
            <Text style={styles.serverHelp}>{onboardingError}</Text>
          )}
        </View>

        <View style={styles.compassCard}>
          <View style={styles.cardHeading}>
            <View>
              <Text style={styles.sectionLabel}>SOUND DIRECTION</Text>
              <Text style={styles.bearing}>{compassLabel}</Text>
            </View>
            {heading !== null && (
              <Text style={styles.phoneHeading}>
                PHONE {Math.round(heading)}°
              </Text>
            )}
          </View>
          <View
            style={styles.compass}
            accessibilityLabel={`Estimated sound direction: ${compassLabel}`}
          >
            <View
              style={[
                styles.dial,
                { transform: [{ rotate: `${-(heading ?? 0)}deg` }] },
              ]}
            >
              <Text
                style={[styles.cardinal, styles.north, cardinalCounterRotation]}
              >
                N
              </Text>
              <Text
                style={[styles.cardinal, styles.east, cardinalCounterRotation]}
              >
                E
              </Text>
              <Text
                style={[styles.cardinal, styles.south, cardinalCounterRotation]}
              >
                S
              </Text>
              <Text
                style={[styles.cardinal, styles.west, cardinalCounterRotation]}
              >
                W
              </Text>
              <View style={styles.compassInner} />
              {coveragePoints.map(({ index, left, top, sampled }) => (
                <View
                  key={`coverage-${index}`}
                  style={[
                    styles.coverageDot,
                    {
                      left,
                      top,
                      backgroundColor: sampled ? "#54D6A0" : "#294A40",
                      borderColor: sampled ? "#A7F3D0" : "#78988A",
                    },
                  ]}
                />
              ))}
            </View>
            {loudestBearing !== null && heading !== null ? (
              <Text
                style={[
                  styles.arrow,
                  { transform: [{ rotate: `${arrowRotation}deg` }] },
                ]}
              >
                ↑
              </Text>
            ) : (
              <View style={styles.compassDot} />
            )}
          </View>
          <Text style={styles.compassHint}>
            {Platform.OS === "web"
              ? "Compass direction is available in the mobile app."
              : heading === null
                ? "Allow compass access, then slowly turn in place as you listen."
                : compassAccuracy === 0
                  ? "Compass needs calibration. Move your phone in a figure eight."
                  : savedBearing !== null
                    ? "Direction saved. Turn the phone and follow the arrow back to where the sound came from."
                    : "Turn the phone toward the sound; the arrow updates from the loudest direction heard."}
          </Text>
          <Text style={styles.coverageDetail}>
            {Platform.OS === "web"
              ? "Direction coverage appears when scanning on a phone."
              : missingDirections.length === 0
                ? "Full 360° range sampled"
                : `${visitedBins} / ${BIN_COUNT} directions sampled · Still need: ${missingDirections.slice(0, 6).join(", ")}${missingDirections.length > 6 ? ` +${missingDirections.length - 6} more` : ""}`}
          </Text>
        </View>

        <View style={styles.listenCard}>
          <View style={styles.listenTop}>
            <View>
              <Text style={styles.sectionLabel}>BIRDNET LISTENING</Text>
              <Text style={styles.timer}>
                {formatDuration(isRecording ? recorderState.durationMillis : 0)}
              </Text>
            </View>
            {isRecording && (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LISTENING</Text>
              </View>
            )}
          </View>
          <Text style={styles.listenHint}>
            {isRecording
              ? "Turn slowly through a full circle, then stop to identify."
              : isAnalyzing
                ? `BirdNET is analyzing your recording · ${analysisElapsed}s`
                : "Record at least 3 seconds. A longer, slow scan helps estimate direction."}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isRecording ? "Stop and identify birds" : "Start listening"
            }
            disabled={isAnalyzing}
            onPress={isRecording ? stopAndIdentify : startListening}
            style={({ pressed }) => [
              styles.actionButton,
              isRecording && styles.stopButton,
              (pressed || isAnalyzing) && styles.pressed,
            ]}
          >
            {isAnalyzing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionText}>
                {isRecording ? "Stop & identify" : "Start listening"}
              </Text>
            )}
          </Pressable>
          {isAnalyzing && (
            <Text style={styles.analyzingText}>
              This can take a little while on the first analysis.
            </Text>
          )}
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            {permissionDenied && (
              <Pressable onPress={() => Linking.openSettings()}>
                <Text style={styles.settingsLink}>Open Settings</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.results}>
          <Text style={styles.resultSectionLabel}>BIRDS HEARD</Text>
          {featuredSpecies && (
            <View style={styles.resultImageBox}>
              {failedSpeciesImage === featuredSpecies.scientific_name ? (
                <View style={styles.featuredImageFallback}>
                  <Text style={styles.featuredImageFallbackText}>
                    Photo unavailable
                  </Text>
                </View>
              ) : (
                <Image
                  accessibilityLabel={`Photo of ${featuredSpecies.common_name}`}
                  contentFit="cover"
                  onError={() =>
                    setFailedSpeciesImage(featuredSpecies.scientific_name)
                  }
                  source={{
                    uri: getSpeciesImageUrl(featuredSpecies.scientific_name),
                  }}
                  style={styles.featuredImage}
                  transition={180}
                />
              )}
            </View>
          )}
          <View style={styles.featuredInfo}>
            {featuredSpecies ? (
              <>
                <View style={styles.birdText}>
                  <Text style={styles.commonName}>
                    {featuredSpecies.common_name}
                  </Text>
                  <Text style={styles.scientificName}>
                    {featuredSpecies.scientific_name}
                  </Text>
                </View>
                <Text style={styles.confidence}>
                  {Math.round(featuredSpecies.confidence * 100)}%
                </Text>
              </>
            ) : (
              <Text style={styles.resultMessage}>
                {status === "done"
                  ? "No birds identified this time. Try a longer recording in a quieter spot."
                  : isAnalyzing
                    ? `BirdNET is identifying your recording · ${analysisElapsed}s`
                    : isRecording
                      ? "Listening for birds. Stop when you are ready to identify."
                      : status === "error"
                        ? "Fix the issue above, then try listening again."
                        : "Record at least 3 seconds. A longer, slower scan helps."}
              </Text>
            )}
          </View>
          {featuredSpecies && (
            <Text style={styles.imageCredit}>Photo via BirdNET Taxonomy</Text>
          )}
          {rankedSpecies.length > 1 && (
            <Text style={styles.alsoHeardLabel}>ALSO HEARD</Text>
          )}
          {rankedSpecies.slice(1, 5).map((bird) => (
            <View key={bird.scientific_name} style={styles.birdRow}>
              <View style={styles.birdText}>
                <Text style={styles.commonName}>{bird.common_name}</Text>
                <Text style={styles.scientificName}>
                  {bird.scientific_name}
                </Text>
              </View>
              <Text style={styles.confidence}>
                {Math.round(bird.confidence * 100)}%
              </Text>
            </View>
          ))}
          {loudestBearing !== null && Platform.OS !== "web" && (
            <Text style={styles.directionNote}>
              The direction above is a rough estimate from microphone level as
              you turned.
            </Text>
          )}
        </View>

        <Text style={styles.privacyNote}>
          Compass is used to estimate direction while you scan. BirdSong sends
          the recording to its BirdNET server for identification.
        </Text>
      </View>
      <View style={styles.rhythmControls}>
        <Pressable
          accessibilityRole="button"
          disabled={status !== "done" || isPlayingRhythm}
          onPress={() => void playBirdRhythm()}
          style={({ pressed }) => [
            styles.rhythmButton,
            styles.rhythmStart,
            (pressed || status !== "done" || isPlayingRhythm) &&
              styles.disabledButton,
          ]}
        >
          <Text style={styles.rhythmButtonText}>Feel the Birdsong</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!isPlayingRhythm}
          onPress={stopBirdRhythm}
          style={({ pressed }) => [
            styles.rhythmButton,
            styles.rhythmStop,
            (pressed || !isPlayingRhythm) && styles.disabledButton,
          ]}
        >
          <Text style={styles.rhythmButtonText}>Stop the Birdsong</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF1DE",
  },
  storageErrorPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: "#EEF1DE",
  },
  storageErrorTitle: {
    color: "#1C543C",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  storageErrorText: {
    color: "#4C6656",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  primaryAction: {
    minHeight: 48,
    minWidth: 150,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#246247",
    borderRadius: 8,
    paddingHorizontal: spacing.md,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  page: {
    flexGrow: 1,
    backgroundColor: "#EEF1DE",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  content: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    gap: 12,
  },
  header: {
    gap: 8,
    paddingBottom: 2,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#1C543C",
    flex: 1,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  helpButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "#07835A",
    marginLeft: spacing.sm,
  },
  helpButtonText: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "700",
    lineHeight: 29,
  },
  serverPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  serverOffline: { backgroundColor: "#FEE2E2" },
  serverChecking: { backgroundColor: "#E5E7EB" },
  serverDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  serverDotOffline: { backgroundColor: "#DC2626" },
  serverDotChecking: { backgroundColor: "#9CA3AF" },
  serverText: {
    color: "#1F2937",
    fontSize: 10,
    fontWeight: "600",
  },
  serverHelp: {
    color: colors.error,
    fontSize: 12,
    marginTop: 6,
  },
  compassCard: {
    backgroundColor: "#246247",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  cardHeading: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: {
    color: "#E6F0E7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  resultSectionLabel: {
    color: "#1C543C",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  bearing: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "700",
    marginTop: 4,
  },
  phoneHeading: { color: "#C5D8CE", fontSize: 10, fontWeight: "700" },
  compass: {
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    borderRadius: COMPASS_CENTER,
    borderWidth: 1,
    borderColor: "#658478",
    backgroundColor: "#204C3E",
    marginTop: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  dial: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  compassInner: {
    position: "absolute",
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 1,
    borderColor: "#527566",
  },
  cardinal: {
    position: "absolute",
    color: "#D8E8DF",
    fontSize: 14,
    fontWeight: "800",
    zIndex: 2,
  },
  north: { top: 13 },
  east: { right: 16 },
  south: { bottom: 13 },
  west: { left: 16 },
  coverageDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    marginLeft: -7,
    marginTop: -7,
    zIndex: 2,
  },
  arrow: {
    position: "absolute",
    color: "#F4C86A",
    fontSize: 84,
    lineHeight: 94,
    fontWeight: "500",
    textAlign: "center",
    textAlignVertical: "center",
  },
  compassDot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#F4C86A",
  },
  compassHint: {
    color: "#D0DED7",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 330,
  },
  coverageDetail: {
    color: "#D0DED7",
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 340,
  },
  listenCard: {
    backgroundColor: "#07835A",
    borderRadius: 10,
    padding: 14,
  },
  listenTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  timer: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "400",
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#D6F1E2",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#246247",
  },
  liveText: {
    color: "#1C543C",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  listenHint: {
    color: "#E6F0E7",
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  actionButton: {
    minHeight: 44,
    borderRadius: 7,
    backgroundColor: "#EEF1DE",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  stopButton: { backgroundColor: "#E94736" },
  actionText: { color: "#1C543C", fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.72 },
  analyzingText: {
    color: "#E6F0E7",
    textAlign: "center",
    fontSize: 12,
    marginTop: spacing.sm,
  },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: spacing.md,
  },
  errorText: { color: colors.error, fontSize: 14, lineHeight: 20 },
  settingsLink: {
    color: colors.primary,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  results: {
    gap: 9,
    paddingTop: 2,
    alignItems: "stretch",
  },
  resultImageBox: {
    overflow: "hidden",
    width: "100%",
    alignSelf: "center",
    aspectRatio: 1,
    maxHeight: 300,
    borderRadius: 8,
    backgroundColor: "#204C3E",
  },
  featuredImage: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#204C3E",
  },
  featuredImageFallback: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#204C3E",
  },
  featuredImageFallbackText: { color: "#E6F0E7", fontSize: 13 },
  featuredInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#07835A",
    borderRadius: 8,
    minHeight: 58,
    padding: 13,
    gap: spacing.sm,
  },
  resultMessage: {
    color: "#FFFFFF",
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  imageCredit: {
    color: "#4C6656",
    fontSize: 10,
    paddingHorizontal: 2,
  },
  alsoHeardLabel: {
    color: "#1C543C",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: spacing.xs,
  },
  birdRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#246247",
    borderRadius: 8,
    padding: 12,
  },
  birdText: { flex: 1 },
  commonName: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  scientificName: {
    color: "#E6F0E7",
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 3,
  },
  confidence: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  directionNote: {
    color: "#4C6656",
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  privacyNote: {
    color: "#4C6656",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.md,
  },
  rhythmControls: {
    gap: 6,
    paddingBottom: spacing.md,
  },
  rhythmButton: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  rhythmStart: { backgroundColor: "#07835A" },
  rhythmStop: { backgroundColor: "#1C543C" },
  disabledButton: { opacity: 0.58 },
  rhythmButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
