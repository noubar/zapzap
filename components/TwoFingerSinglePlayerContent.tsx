import { StyleSheet, Text, View } from 'react-native';
import type { Router } from 'expo-router';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { arcadeColors, arcadeMetrics, arcadeTypography, formatReactionTime } from '../constants/ArcadeTheme';
import type { Difficulty } from '../settings/gameSettings';
import DifficultySelector from './DifficultySelector';
import GameResultScreen from './GameResultScreen';

type Finger = 'left' | 'right';

interface TwoFingerSinglePlayerContentProps {
  filledFinger: Finger | null;
  onFingerPressIn: (finger: Finger) => void;
  onFingerPressOut: (finger: Finger, releaseTime: number, cancelled: boolean) => void;
  gameState: string;
  reactionTime: number;
  bestReactionTime: number | null;
  resetGame: () => void;
  router: Router;
  zapsAvoided: number;
  hasTouchedToStart: { left: boolean; right: boolean };
  difficulty: Difficulty;
  setDifficulty: (level: Difficulty) => void;
  levels: { label: string; value: Difficulty }[];
  failureReason: string;
}

export default function TwoFingerSinglePlayerContent({
  filledFinger, onFingerPressIn, onFingerPressOut, gameState, reactionTime,
  bestReactionTime, resetGame, router, zapsAvoided, hasTouchedToStart,
  difficulty, setDifficulty, levels, failureReason,
}: TwoFingerSinglePlayerContentProps) {
  const hasBothTouched = hasTouchedToStart.left && hasTouchedToStart.right;
  const isSuccess = gameState === 'reaction-done';

  if (gameState === 'game-over') {
    return (
      <GameResultScreen
        title="RUN OVER"
        message={failureReason}
        tone="failure"
        stats={[
          { label: 'Zaps avoided', value: String(zapsAvoided), accent: 'success' },
          { label: 'Best reaction', value: formatReactionTime(bestReactionTime) },
        ]}
        onPlayAgain={resetGame}
        onMainMenu={() => router.push('/')}
      />
    );
  }

  const status = gameState === 'zap'
    ? 'GO!'
    : isSuccess
      ? 'SUCCESS'
      : hasBothTouched
        ? 'KEEP HOLDING'
        : 'TOUCH BOTH';

  const renderFinger = (finger: Finger) => {
    const isTarget = filledFinger === finger;
    const isHeld = hasTouchedToStart[finger] && !isTarget && !isSuccess;
    const gesture = Gesture.LongPress()
      .minDuration(0)
      .shouldCancelWhenOutside(false)
      .onStart(() => scheduleOnRN(onFingerPressIn, finger))
      .onEnd((_, success) =>
        scheduleOnRN(onFingerPressOut, finger, performance.now(), !success)
      );

    return (
      <GestureDetector gesture={gesture} key={finger}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${finger} reaction button${isTarget ? ', GO now' : ''}`}
          accessibilityHint="Touch and hold. Release this finger only if its button turns white."
          style={[
            styles.rectangle,
            isHeld && styles.held,
            isSuccess && styles.successBox,
            isTarget && styles.filled,
          ]}
        >
          <Text style={[styles.fingerLabel, (isTarget || isSuccess) && styles.fingerLabelFilled]}>
            {isTarget ? 'GO!' : isSuccess ? 'NICE!' : finger.toUpperCase()}
          </Text>
        </View>
      </GestureDetector>
    );
  };

  return (
    <GestureHandlerRootView style={styles.screen}>
      <SafeAreaView style={styles.playArea} edges={['top', 'bottom']}>
        <View style={styles.hud}>
          <Text accessibilityLiveRegion="polite" style={[styles.statusText, isSuccess && styles.successText]}>
            {status}
          </Text>
          <DifficultySelector
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            hasTouchedToStart={hasBothTouched}
            levels={levels}
          />
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statLabel}>ZAPS</Text>
              <Text style={styles.statValue}>{zapsAvoided}</Text>
            </View>
            <View style={styles.statRight}>
              <Text style={styles.statLabel}>BEST</Text>
              <Text style={styles.statValue}>{formatReactionTime(bestReactionTime)}</Text>
            </View>
          </View>
        </View>

        {isSuccess && reactionTime > 0 && (
          <View pointerEvents="none" style={styles.reactionOverlay}>
            <Text style={styles.reactionLabel}>REACTION</Text>
            <Text style={styles.reactionTime}>{formatReactionTime(reactionTime)}</Text>
          </View>
        )}

        <View style={styles.rectRow}>
          {renderFinger('left')}
          {renderFinger('right')}
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', backgroundColor: arcadeColors.background },
  playArea: { flex: 1, width: '100%', alignItems: 'center' },
  hud: {
    position: 'absolute', top: arcadeMetrics.spacing.md, left: 0, right: 0,
    zIndex: 10, alignItems: 'center', gap: arcadeMetrics.spacing.sm,
  },
  statusText: { ...arcadeTypography.heading, fontSize: 24, textAlign: 'center' },
  successText: { color: arcadeColors.success },
  statsRow: {
    width: '90%', maxWidth: 520, flexDirection: 'row', justifyContent: 'space-between',
    marginTop: arcadeMetrics.spacing.xs,
  },
  statRight: { alignItems: 'flex-end' },
  statLabel: { ...arcadeTypography.eyebrow },
  statValue: { ...arcadeTypography.body, marginTop: 2, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rectRow: {
    position: 'absolute', bottom: '6%', left: 0, right: 0, flexDirection: 'row',
    justifyContent: 'space-between', paddingHorizontal: '5%', height: '30%', gap: arcadeMetrics.spacing.sm,
  },
  rectangle: {
    width: '48%', height: '100%', borderWidth: arcadeMetrics.borderWidth,
    borderColor: arcadeColors.outline, borderRadius: arcadeMetrics.radius,
    backgroundColor: arcadeColors.surface, justifyContent: 'center', alignItems: 'center',
  },
  held: { backgroundColor: arcadeColors.surfaceHeld },
  filled: { backgroundColor: arcadeColors.signal, borderColor: arcadeColors.signal },
  successBox: { backgroundColor: arcadeColors.success, borderColor: arcadeColors.success },
  fingerLabel: { ...arcadeTypography.heading, color: arcadeColors.textMuted, fontSize: 19 },
  fingerLabelFilled: { color: arcadeColors.signalText },
  reactionOverlay: { position: 'absolute', top: '43%', alignItems: 'center' },
  reactionLabel: { ...arcadeTypography.eyebrow, color: arcadeColors.success },
  reactionTime: {
    ...arcadeTypography.title, marginTop: arcadeMetrics.spacing.xs, color: arcadeColors.success,
    fontSize: 42, fontVariant: ['tabular-nums'],
  },
});
