import { StyleSheet, Text, View } from 'react-native';
import type { Router } from 'expo-router';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import {
  arcadeColors,
  arcadeMetrics,
  arcadeTypography,
  formatReactionTime,
} from '../constants/ArcadeTheme';
import DifficultySelector from './DifficultySelector';
import GameResultScreen from './GameResultScreen';

interface OneFingerSinglePlayerContentProps {
  isFilled: boolean;
  handlePressIn: () => void;
  handlePressOut: (releaseTime: number, cancelled: boolean) => void;
  gameState: string;
  reactionTime: number;
  bestReactionTime: number | null;
  resetGame: () => void;
  router: Router;
  zapesAvoided: number;
  hasTouchedToStart: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  setDifficulty: (level: 'easy' | 'medium' | 'hard') => void;
  levels: { label: string; value: 'easy' | 'medium' | 'hard' }[];
  failureReason: string;
}

export default function SinglePlayerGameContent({
  isFilled,
  handlePressIn,
  handlePressOut,
  gameState,
  reactionTime,
  bestReactionTime,
  resetGame,
  router,
  zapesAvoided,
  hasTouchedToStart,
  difficulty,
  setDifficulty,
  levels,
  failureReason,
}: OneFingerSinglePlayerContentProps) {
  const holdGesture = Gesture.LongPress()
    .minDuration(0)
    .shouldCancelWhenOutside(false)
    .onStart(() => scheduleOnRN(handlePressIn))
    .onEnd((_, success) => {
      scheduleOnRN(handlePressOut, performance.now(), !success);
    });

  if (gameState === 'game-over') {
    return (
      <GameResultScreen
        title="RUN OVER"
        message={failureReason}
        tone="failure"
        stats={[
          { label: 'Zaps avoided', value: String(zapesAvoided), accent: 'success' },
          { label: 'Best reaction', value: formatReactionTime(bestReactionTime) },
        ]}
        onPlayAgain={resetGame}
        onMainMenu={() => router.push('/')}
      />
    );
  }

  const isSuccess = gameState === 'reaction-done';
  const isHeld = hasTouchedToStart && !isFilled && !isSuccess;
  const status =
    gameState === 'zap'
      ? 'GO!'
      : isSuccess
        ? 'SUCCESS'
        : hasTouchedToStart
          ? 'KEEP HOLDING'
          : 'TOUCH & HOLD';
  const boxLabel = isFilled ? 'GO!' : isSuccess ? 'NICE!' : isHeld ? 'HOLD' : 'READY';

  return (
    <GestureHandlerRootView style={styles.screen}>
      <SafeAreaView style={styles.playArea} edges={['top', 'bottom']}>
        <View style={styles.hud}>
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.statusText,
              isSuccess && styles.successText,
              gameState === 'zap' && styles.goStatusText,
            ]}
          >
            {status}
          </Text>
          <DifficultySelector
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            hasTouchedToStart={hasTouchedToStart}
            levels={levels}
          />
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statLabel}>ZAPS</Text>
              <Text style={styles.statValue}>{zapesAvoided}</Text>
            </View>
            <View style={styles.statRight}>
              <Text style={styles.statLabel}>BEST</Text>
              <Text style={styles.statValue}>{formatReactionTime(bestReactionTime)}</Text>
            </View>
          </View>
        </View>

        <GestureDetector gesture={holdGesture}>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel="Reaction button"
            accessibilityHint="Touch and hold. Release only when the button turns white and says GO."
            style={[
              styles.rectangle,
              isHeld && styles.held,
              isSuccess && styles.successBox,
              isFilled && styles.filled,
            ]}
          >
            <Text
              style={[
                styles.boxLabel,
                (isFilled || isSuccess) && styles.boxLabelFilled,
              ]}
            >
              {boxLabel}
            </Text>
          </View>
        </GestureDetector>

        {isSuccess && reactionTime > 0 && (
          <View pointerEvents="none" style={styles.reactionOverlay}>
            <Text style={styles.reactionLabel}>REACTION</Text>
            <Text style={styles.reactionTime}>{formatReactionTime(reactionTime)}</Text>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    backgroundColor: arcadeColors.background,
  },
  playArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  hud: {
    position: 'absolute',
    top: arcadeMetrics.spacing.md,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    gap: arcadeMetrics.spacing.sm,
  },
  statusText: {
    ...arcadeTypography.heading,
    fontSize: 24,
    textAlign: 'center',
  },
  goStatusText: {
    color: arcadeColors.text,
  },
  successText: {
    color: arcadeColors.success,
  },
  statsRow: {
    width: '90%',
    maxWidth: 520,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: arcadeMetrics.spacing.xs,
  },
  statRight: {
    alignItems: 'flex-end',
  },
  statLabel: {
    ...arcadeTypography.eyebrow,
  },
  statValue: {
    ...arcadeTypography.body,
    marginTop: 2,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  rectangle: {
    position: 'absolute',
    bottom: '5%',
    width: '90%',
    height: '40%',
    maxWidth: 720,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: arcadeMetrics.borderWidth,
    borderColor: arcadeColors.outline,
    borderRadius: arcadeMetrics.radius,
    backgroundColor: arcadeColors.surface,
  },
  held: {
    backgroundColor: arcadeColors.surfaceHeld,
  },
  filled: {
    backgroundColor: arcadeColors.signal,
    borderColor: arcadeColors.signal,
  },
  successBox: {
    backgroundColor: arcadeColors.success,
    borderColor: arcadeColors.success,
  },
  boxLabel: {
    ...arcadeTypography.heading,
    color: arcadeColors.textMuted,
    letterSpacing: 2,
  },
  boxLabelFilled: {
    color: arcadeColors.signalText,
  },
  reactionOverlay: {
    position: 'absolute',
    top: '43%',
    alignItems: 'center',
  },
  reactionLabel: {
    ...arcadeTypography.eyebrow,
    color: arcadeColors.success,
  },
  reactionTime: {
    ...arcadeTypography.title,
    marginTop: arcadeMetrics.spacing.xs,
    color: arcadeColors.success,
    fontSize: 42,
    fontVariant: ['tabular-nums'],
  },
});
