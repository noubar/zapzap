import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  arcadeColors,
  arcadeMetrics,
  arcadeTypography,
} from '../constants/ArcadeTheme';

type ResultTone = 'failure' | 'victory' | 'draw';

type ResultStat = {
  label: string;
  value: string;
  accent?: 'player1' | 'player2' | 'success';
};

type GameResultScreenProps = {
  title: string;
  message: string;
  tone: ResultTone;
  stats: ResultStat[];
  onPlayAgain: () => void;
  onMainMenu: () => void;
};

const toneColors: Record<ResultTone, string> = {
  failure: arcadeColors.failure,
  victory: arcadeColors.victory,
  draw: arcadeColors.victory,
};

const statColors = {
  player1: arcadeColors.player1,
  player2: arcadeColors.player2,
  success: arcadeColors.success,
};

export default function GameResultScreen({
  title,
  message,
  tone,
  stats,
  onPlayAgain,
  onMainMenu,
}: GameResultScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={arcadeTypography.eyebrow}>ZAPZAP // RESULT</Text>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: toneColors[tone] }]}
        >
          {title}
        </Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.stats}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statRow}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text
                style={[
                  styles.statValue,
                  stat.accent && { color: statColors[stat.accent] },
                ]}
              >
                {stat.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play again"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={onPlayAgain}
          >
            <Text style={styles.primaryButtonText}>PLAY AGAIN</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to main menu"
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={onMainMenu}
          >
            <Text style={styles.secondaryButtonText}>MAIN MENU</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    backgroundColor: arcadeColors.background,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: arcadeMetrics.maxContentWidth,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    padding: arcadeMetrics.spacing.lg,
  },
  title: {
    marginTop: arcadeMetrics.spacing.md,
    fontFamily: 'SpaceMono',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  message: {
    ...arcadeTypography.body,
    marginTop: arcadeMetrics.spacing.sm,
    color: arcadeColors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
  },
  stats: {
    width: '100%',
    marginTop: arcadeMetrics.spacing.xl,
    borderWidth: arcadeMetrics.borderWidth,
    borderColor: arcadeColors.outline,
    borderRadius: arcadeMetrics.radius,
    backgroundColor: arcadeColors.surface,
    paddingHorizontal: arcadeMetrics.spacing.md,
  },
  statRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: arcadeMetrics.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#4A4A4A',
  },
  statLabel: {
    ...arcadeTypography.caption,
    flex: 1,
    textTransform: 'uppercase',
  },
  statValue: {
    ...arcadeTypography.body,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  actions: {
    width: '100%',
    marginTop: arcadeMetrics.spacing.lg,
    gap: arcadeMetrics.spacing.sm,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: arcadeMetrics.radiusSmall,
    backgroundColor: arcadeColors.outline,
  },
  secondaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: arcadeColors.outline,
    borderRadius: arcadeMetrics.radiusSmall,
    backgroundColor: arcadeColors.background,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  primaryButtonText: {
    ...arcadeTypography.body,
    color: arcadeColors.signalText,
    fontWeight: '900',
  },
  secondaryButtonText: {
    ...arcadeTypography.body,
    fontWeight: '900',
  },
});
