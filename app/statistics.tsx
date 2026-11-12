import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { arcadeColors, arcadeMetrics, arcadeTypography } from '../constants/ArcadeTheme';
import { ACHIEVEMENTS, getAchievementProgress } from '../statistics/achievements';
import {
  averageReactionTime,
  configurationKey,
  createReactionAggregate,
  formatStatisticTime,
  totalForVariant,
} from '../statistics/statisticsEngine';
import { useStatistics } from '../statistics/StatisticsProvider';
import type { GameVariant } from '../statistics/types';
import {
  DIFFICULTIES,
  DIFFICULTY_PROFILES,
  MATCH_FORMATS,
  MATCH_FORMAT_LABELS,
  type Difficulty,
} from '../settings/gameSettings';

const MODES: { value: GameVariant; label: string }[] = [
  { value: 'one-finger-single', label: '1F SOLO' },
  { value: 'two-finger-single', label: '2F SOLO' },
  { value: 'one-finger-multiplayer', label: '1F DUEL' },
  { value: 'two-finger-multiplayer', label: '2F DUEL' },
];

function StatRow({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'failure' | 'victory' | 'p1' | 'p2' }) {
  const colors = { success: arcadeColors.success, failure: arcadeColors.failure, victory: arcadeColors.victory, p1: arcadeColors.player1, p2: arcadeColors.player2 };
  return (
    <View style={styles.statRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone && { color: colors[tone] }]}>{value}</Text>
    </View>
  );
}

export default function StatisticsScreen() {
  const { statistics, resetStatistics } = useStatistics();
  const [mode, setMode] = useState<GameVariant>('one-finger-single');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [fakeSignals, setFakeSignals] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const unlockedCount = Object.keys(statistics.achievements).length;
  const filtered = statistics.configurations[configurationKey({
    variant: mode, difficulty, fakeSignalsEnabled: fakeSignals,
  })] ?? createReactionAggregate();
  const modeTotal = useMemo(() => totalForVariant(statistics, mode), [mode, statistics]);
  const oneSolo = statistics.singlePlayer['one-finger-single'];
  const twoSolo = statistics.singlePlayer['two-finger-single'];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={arcadeTypography.eyebrow}>ZAPZAP // PROGRESS</Text>
        <Text accessibilityRole="header" style={styles.title}>STATISTICS</Text>

        <Text style={styles.sectionTitle}>OVERVIEW</Text>
        <View style={styles.card}>
          <StatRow label="Personal best" value={formatStatisticTime(statistics.overall.fastestReactionMs)} tone="victory" />
          <StatRow label="Average reaction" value={formatStatisticTime(averageReactionTime(statistics.overall))} />
          <StatRow label="Rounds attempted" value={String(statistics.overall.roundsAttempted)} />
          <StatRow label="Successful reactions" value={String(statistics.overall.successfulReactions)} tone="success" />
          <StatRow label="Failed reactions" value={String(statistics.overall.failedReactions)} tone="failure" />
          <StatRow label="Achievements" value={`${unlockedCount} / ${ACHIEVEMENTS.length}`} tone="victory" />
        </View>

        <Text style={styles.sectionTitle}>CONFIGURATION RECORD</Text>
        <View style={styles.segmentWrap} accessibilityRole="radiogroup">
          {MODES.map((item) => (
            <Pressable key={item.value} onPress={() => setMode(item.value)} accessibilityRole="radio" accessibilityState={{ checked: mode === item.value }} style={[styles.segment, mode === item.value && styles.segmentSelected]}>
              <Text style={[styles.segmentText, mode === item.value && styles.segmentTextSelected]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.segmentWrap} accessibilityRole="radiogroup">
          {DIFFICULTIES.map((item) => (
            <Pressable key={item} onPress={() => setDifficulty(item)} accessibilityRole="radio" accessibilityState={{ checked: difficulty === item }} style={[styles.segment, difficulty === item && styles.segmentSelected]}>
              <Text style={[styles.segmentText, difficulty === item && styles.segmentTextSelected]}>{DIFFICULTY_PROFILES[item].label.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setFakeSignals((value) => !value)} accessibilityRole="switch" accessibilityState={{ checked: fakeSignals }} style={[styles.fakeToggle, fakeSignals && styles.fakeToggleOn]}>
          <Text style={styles.segmentText}>FAKE SIGNALS: {fakeSignals ? 'ON' : 'OFF'}</Text>
        </Pressable>
        <View style={styles.card}>
          <StatRow label="Best" value={formatStatisticTime(filtered.fastestReactionMs)} tone="victory" />
          <StatRow label="Average" value={formatStatisticTime(averageReactionTime(filtered))} />
          <StatRow label="Rounds" value={String(filtered.roundsAttempted)} />
          <StatRow label="Successes" value={String(filtered.successfulReactions)} tone="success" />
          <StatRow label="Failures" value={String(filtered.failedReactions)} tone="failure" />
        </View>

        <Text style={styles.sectionTitle}>SINGLE PLAYER</Text>
        <View style={styles.card}>
          <StatRow label="One-finger zaps" value={String(oneSolo.zapsAvoided)} tone="success" />
          <StatRow label="One-finger longest streak" value={String(oneSolo.longestStreak)} />
          <StatRow label="Two-finger zaps" value={String(twoSolo.zapsAvoided)} tone="success" />
          <StatRow label="Two-finger longest streak" value={String(twoSolo.longestStreak)} />
          <StatRow label="Selected mode best" value={formatStatisticTime(modeTotal.fastestReactionMs)} tone="victory" />
        </View>

        <Text style={styles.sectionTitle}>MULTIPLAYER</Text>
        {(['one-finger-multiplayer', 'two-finger-multiplayer'] as const).map((variant) => {
          const players = statistics.multiplayer[variant];
          return (
            <View key={variant} style={styles.card}>
              <Text style={styles.cardTitle}>{variant === 'one-finger-multiplayer' ? 'ONE-FINGER DUELS' : 'TWO-FINGER DUELS'}</Text>
              <StatRow label="Player 1 matches W / L / D" value={`${players.p1.matchesWon} / ${players.p1.matchesLost} / ${players.p1.matchesDrawn}`} tone="p1" />
              <StatRow label="Player 2 matches W / L / D" value={`${players.p2.matchesWon} / ${players.p2.matchesLost} / ${players.p2.matchesDrawn}`} tone="p2" />
              <StatRow label="Player 1 rounds W / L / D" value={`${players.p1.roundsWon} / ${players.p1.roundsLost} / ${players.p1.roundsDrawn}`} tone="p1" />
              <StatRow label="Player 2 rounds W / L / D" value={`${players.p2.roundsWon} / ${players.p2.roundsLost} / ${players.p2.roundsDrawn}`} tone="p2" />
              {MATCH_FORMATS.map((format) => {
                const formatStats = statistics.multiplayerMatchFormats[`${variant}|${format}`];
                if (!formatStats?.matchesPlayed) return null;
                return (
                  <StatRow
                    key={format}
                    label={MATCH_FORMAT_LABELS[format]}
                    value={`P1 ${formatStats.player1Wins} · P2 ${formatStats.player2Wins} · D ${formatStats.draws}`}
                  />
                );
              })}
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
        <View style={styles.achievementList}>
          {ACHIEVEMENTS.map((achievement) => {
            const unlock = statistics.achievements[achievement.id];
            const progress = Math.min(achievement.target, getAchievementProgress(achievement, statistics));
            return (
              <View key={achievement.id} style={[styles.achievement, unlock && styles.achievementUnlocked]} accessible accessibilityLabel={`${achievement.title}. ${unlock ? 'Unlocked' : `Progress ${progress} of ${achievement.target}`}. ${achievement.description}`}>
                <Text style={[styles.achievementTitle, unlock && styles.gold]}>{achievement.title.toUpperCase()}</Text>
                <Text style={styles.achievementDescription}>{achievement.description}</Text>
                <Text style={[styles.achievementProgress, unlock && styles.gold]}>
                  {unlock ? `UNLOCKED · ${new Date(unlock.unlockedAt).toLocaleDateString()}` : `${progress} / ${achievement.target}`}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>DATA</Text>
        {confirmingReset ? (
          <View style={styles.resetConfirm} accessibilityRole="alert">
            <Text style={styles.resetTitle}>RESET ALL STATISTICS?</Text>
            <Text style={styles.resetCopy}>Records and achievements will be permanently cleared. Game Options will not change.</Text>
            <View style={styles.resetActions}>
              <Pressable onPress={() => setConfirmingReset(false)} style={styles.secondaryButton}><Text style={styles.buttonText}>CANCEL</Text></Pressable>
              <Pressable onPress={() => { resetStatistics(); setConfirmingReset(false); }} style={styles.dangerButton}><Text style={styles.buttonText}>RESET</Text></Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmingReset(true)} accessibilityRole="button" style={styles.resetButton}><Text style={styles.resetButtonText}>RESET STATISTICS</Text></Pressable>
        )}

        <Pressable onPress={() => router.replace('/')} accessibilityRole="button" style={styles.backButton}><Text style={styles.backText}>BACK TO MENU</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: arcadeColors.background },
  content: { width: '100%', maxWidth: arcadeMetrics.maxContentWidth, alignSelf: 'center', padding: arcadeMetrics.spacing.md, paddingBottom: 48 },
  title: { ...arcadeTypography.title, marginTop: 8, marginBottom: 24 },
  sectionTitle: { ...arcadeTypography.eyebrow, color: arcadeColors.success, marginTop: 24, marginBottom: 10 },
  card: { borderWidth: 2, borderColor: arcadeColors.outline, borderRadius: arcadeMetrics.radiusSmall, backgroundColor: arcadeColors.surface, paddingHorizontal: 14, marginBottom: 10 },
  cardTitle: { ...arcadeTypography.eyebrow, color: arcadeColors.victory, paddingTop: 14, paddingBottom: 5 },
  statRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#444' },
  statLabel: { ...arcadeTypography.caption, flex: 1, textTransform: 'uppercase' },
  statValue: { ...arcadeTypography.body, fontWeight: '900', fontVariant: ['tabular-nums'], textAlign: 'right' },
  segmentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  segment: { minHeight: 42, flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, borderWidth: 1, borderColor: '#555', borderRadius: 4, backgroundColor: arcadeColors.surface },
  segmentSelected: { borderColor: arcadeColors.outline, backgroundColor: arcadeColors.outline },
  segmentText: { ...arcadeTypography.caption, color: arcadeColors.text, fontWeight: '900' },
  segmentTextSelected: { color: arcadeColors.signalText },
  fakeToggle: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#555', borderRadius: 4 },
  fakeToggleOn: { borderColor: arcadeColors.victory },
  achievementList: { gap: 8 },
  achievement: { padding: 14, borderWidth: 1, borderColor: '#555', borderRadius: arcadeMetrics.radiusSmall, backgroundColor: arcadeColors.surface, opacity: 0.68 },
  achievementUnlocked: { borderColor: arcadeColors.victory, opacity: 1 },
  achievementTitle: { ...arcadeTypography.body, fontWeight: '900' },
  achievementDescription: { ...arcadeTypography.caption, marginTop: 3, color: arcadeColors.text },
  achievementProgress: { ...arcadeTypography.eyebrow, marginTop: 8 },
  gold: { color: arcadeColors.victory },
  resetButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: arcadeColors.failure, borderRadius: arcadeMetrics.radiusSmall },
  resetButtonText: { ...arcadeTypography.body, color: arcadeColors.failure, fontWeight: '900' },
  resetConfirm: { padding: 14, borderWidth: 2, borderColor: arcadeColors.failure, borderRadius: arcadeMetrics.radiusSmall, backgroundColor: arcadeColors.surface },
  resetTitle: { ...arcadeTypography.body, color: arcadeColors.failure, fontWeight: '900' },
  resetCopy: { ...arcadeTypography.caption, marginTop: 8, lineHeight: 18 },
  resetActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  secondaryButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: arcadeColors.outline, borderRadius: 4 },
  dangerButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: arcadeColors.failure, borderRadius: 4 },
  buttonText: { ...arcadeTypography.body, fontWeight: '900' },
  backButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 24, backgroundColor: arcadeColors.outline, borderRadius: arcadeMetrics.radiusSmall },
  backText: { ...arcadeTypography.body, color: arcadeColors.signalText, fontWeight: '900' },
});

