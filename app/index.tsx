import { router } from 'expo-router';
import { User, Users, Vibrate } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  arcadeColors,
  arcadeMetrics,
  arcadeTypography,
} from '../constants/ArcadeTheme';
import { useGlobalSettings } from './GlobalSettings';

export default function MenuScreen() {
  const [fingerMode, setFingerMode] = useState<1 | 2>(1);
  const { settings, setSetting } = useGlobalSettings();

  const menuOptions = useMemo(
    () => [
      {
        id: 'single-1',
        label: 'Single Player',
        subtext: 'Test your reaction time',
        icon: <User size={34} color={arcadeColors.text} />,
        onPress: () => router.push('/OneFingerSinglePlayerGame'),
        fingerMode: 1 as const,
      },
      {
        id: 'single-2',
        label: 'Single Player',
        subtext: 'Two-finger target challenge',
        icon: <User size={34} color={arcadeColors.text} />,
        onPress: () => router.push('/TwoFingerSinglePlayerGame'),
        fingerMode: 2 as const,
      },
      {
        id: 'two-1',
        label: 'Two Players',
        subtext: 'One button per player',
        icon: <Users size={34} color={arcadeColors.text} />,
        onPress: () => router.push('/OneFingerTwoPlayerGame'),
        fingerMode: 1 as const,
      },
      {
        id: 'two-2',
        label: 'Two Players',
        subtext: 'Two target buttons per player',
        icon: <Users size={34} color={arcadeColors.text} />,
        onPress: () => router.push('/TwoFingerTwoPlayerGame'),
        fingerMode: 2 as const,
      },
    ],
    []
  );

  const visibleOptions = useMemo(
    () => menuOptions.filter((option) => option.fingerMode === fingerMode),
    [fingerMode, menuOptions]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.utilityRow}>
            <Pressable
              style={({ pressed }) => [styles.vibrationToggle, pressed && styles.pressed]}
              onPress={() => setSetting('vibrationEnabled', !settings.vibrationEnabled)}
              accessibilityRole="switch"
              accessibilityLabel="Vibration feedback"
              accessibilityState={{ checked: settings.vibrationEnabled }}
            >
              <Vibrate
                size={18}
                color={settings.vibrationEnabled ? arcadeColors.success : arcadeColors.textMuted}
              />
              <Text style={styles.vibrationLabel}>
                HAPTICS {settings.vibrationEnabled ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.brand}>
            <Text style={arcadeTypography.eyebrow}>REACTION ARCADE</Text>
            <Text accessibilityRole="header" style={styles.title}>ZAPZAP</Text>
            <Text style={styles.subtitle}>Hold. Wait for white. Release fast.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CONTROL MODE</Text>
            <View style={styles.switchContainer}>
              {[1, 2].map((mode) => {
                const selected = fingerMode === mode;
                return (
                  <Pressable
                    key={mode}
                    style={({ pressed }) => [
                      styles.switchButton,
                      selected && styles.switchButtonActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setFingerMode(mode as 1 | 2)}
                    accessibilityRole="radio"
                    accessibilityLabel={mode + ' finger mode'}
                    accessibilityState={{ checked: selected }}
                  >
                    <Text
                      style={[
                        styles.switchButtonText,
                        selected && styles.switchButtonTextActive,
                      ]}
                    >
                      {mode} FINGER{mode === 2 ? 'S' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.buttonContainer}>
            {visibleOptions.map((option) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
                onPress={option.onPress}
                accessibilityRole="button"
                accessibilityLabel={option.label + '. ' + option.subtext}
              >
                {option.icon}
                <View style={styles.menuCopy}>
                  <Text style={styles.buttonText}>{option.label}</Text>
                  <Text style={styles.buttonSubtext}>{option.subtext}</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.ruleCard}>
            <Text style={styles.ruleTitle}>THE RULE</Text>
            <Text style={styles.instructions}>
              Keep holding through the random wait. Release only when the box turns white.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.tutorialButton, pressed && styles.pressed]}
            onPress={() => router.push('/tutorial')}
            accessibilityRole="button"
            accessibilityLabel="Open how to play tutorial"
          >
            <Text style={styles.tutorialText}>HOW TO PLAY</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: arcadeColors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: arcadeMetrics.spacing.md,
    paddingVertical: arcadeMetrics.spacing.md,
  },
  content: {
    width: '100%',
    maxWidth: arcadeMetrics.maxContentWidth,
  },
  utilityRow: {
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  vibrationToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: arcadeMetrics.spacing.sm,
    paddingHorizontal: arcadeMetrics.spacing.sm,
  },
  vibrationLabel: {
    ...arcadeTypography.eyebrow,
    color: arcadeColors.text,
    letterSpacing: 1,
  },
  brand: {
    alignItems: 'center',
    paddingVertical: arcadeMetrics.spacing.lg,
  },
  title: {
    ...arcadeTypography.title,
    marginTop: arcadeMetrics.spacing.sm,
    fontSize: 44,
    letterSpacing: 4,
    textAlign: 'center',
  },
  subtitle: {
    ...arcadeTypography.body,
    marginTop: arcadeMetrics.spacing.sm,
    color: arcadeColors.textMuted,
    textAlign: 'center',
  },
  section: {
    marginBottom: arcadeMetrics.spacing.md,
  },
  sectionLabel: {
    ...arcadeTypography.eyebrow,
    marginBottom: arcadeMetrics.spacing.sm,
  },
  switchContainer: {
    minHeight: 48,
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: arcadeColors.outline,
    borderRadius: arcadeMetrics.radiusSmall,
    overflow: 'hidden',
  },
  switchButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: arcadeColors.surface,
  },
  switchButtonActive: {
    backgroundColor: arcadeColors.outline,
  },
  switchButtonText: {
    ...arcadeTypography.caption,
    color: arcadeColors.text,
    fontWeight: '900',
  },
  switchButtonTextActive: {
    color: arcadeColors.signalText,
  },
  buttonContainer: {
    gap: arcadeMetrics.spacing.sm,
  },
  menuButton: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: arcadeMetrics.spacing.md,
    paddingHorizontal: arcadeMetrics.spacing.md,
    borderWidth: arcadeMetrics.borderWidth,
    borderColor: arcadeColors.outline,
    borderRadius: arcadeMetrics.radius,
    backgroundColor: arcadeColors.surface,
  },
  menuButtonPressed: {
    backgroundColor: arcadeColors.surfaceHeld,
  },
  menuCopy: {
    flex: 1,
  },
  buttonText: {
    ...arcadeTypography.heading,
    fontSize: 20,
  },
  buttonSubtext: {
    ...arcadeTypography.caption,
    marginTop: arcadeMetrics.spacing.xs,
    letterSpacing: 0,
    textTransform: 'none',
  },
  arrow: {
    color: arcadeColors.text,
    fontSize: 34,
    fontWeight: '300',
  },
  ruleCard: {
    marginTop: arcadeMetrics.spacing.md,
    padding: arcadeMetrics.spacing.md,
    borderLeftWidth: arcadeMetrics.borderWidth,
    borderLeftColor: arcadeColors.success,
    backgroundColor: arcadeColors.surface,
  },
  ruleTitle: {
    ...arcadeTypography.eyebrow,
    color: arcadeColors.success,
  },
  instructions: {
    ...arcadeTypography.body,
    marginTop: arcadeMetrics.spacing.sm,
    color: arcadeColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  tutorialButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: arcadeMetrics.spacing.md,
    borderWidth: 2,
    borderColor: arcadeColors.outline,
    borderRadius: arcadeMetrics.radiusSmall,
  },
  tutorialText: {
    ...arcadeTypography.body,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
