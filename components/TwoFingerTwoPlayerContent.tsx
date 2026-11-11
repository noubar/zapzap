import { StyleSheet, Text, View } from 'react-native';
import type { Router } from 'expo-router';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { arcadeColors, arcadeMetrics, arcadeTypography, formatReactionTime } from '../constants/ArcadeTheme';
import {
  formatPlayerRoundResult,
  type MultiplayerRoundResults,
} from '../gameplay/multiplayer';
import GameResultScreen from './GameResultScreen';

type Player = 'p1' | 'p2';
type BoxIndex = 0 | 1;

interface TwoFingerTwoPlayerContentProps {
  targets: { p1: number | null; p2: number | null };
  lives: { p1: number; p2: number };
  onBoxPressIn: (player: Player, index: BoxIndex) => void;
  onBoxPressOut: (player: Player, index: BoxIndex, releaseTime: number, cancelled: boolean) => void;
  roundWinner: string;
  roundDetail: string;
  gameState: 'idle' | 'waiting' | 'zap' | 'round-result' | 'game-over';
  roundResults: MultiplayerRoundResults;
  bestReactionTime: number | null;
  resetGame: () => void;
  router: Router;
  hasTouchedToStart: { p1: boolean; p2: boolean };
}

export default function TwoFingerTwoPlayerContent({
  targets, lives, onBoxPressIn, onBoxPressOut, roundWinner, roundDetail,
  gameState, roundResults, bestReactionTime, resetGame, router, hasTouchedToStart,
}: TwoFingerTwoPlayerContentProps) {
  if (gameState === 'game-over') {
    const isDraw = roundWinner === 'Draw';
    return (
      <GameResultScreen
        title={isDraw ? 'DRAW' : `${roundWinner.toUpperCase()} WINS`}
        message={isDraw ? 'Both players are out of lives.' : 'MATCH COMPLETE'}
        tone={isDraw ? 'draw' : 'victory'}
        stats={[
          { label: 'Player 1 lives', value: String(lives.p1), accent: 'player1' },
          { label: 'Player 2 lives', value: String(lives.p2), accent: 'player2' },
          { label: 'Best reaction', value: formatReactionTime(bestReactionTime) },
        ]}
        onPlayAgain={resetGame}
        onMainMenu={() => router.push('/')}
      />
    );
  }

  const gestureFor = (player: Player, index: BoxIndex) => Gesture.LongPress()
    .minDuration(0)
    .shouldCancelWhenOutside(false)
    .onStart(() => scheduleOnRN(onBoxPressIn, player, index))
    .onEnd((_, success) =>
      scheduleOnRN(onBoxPressOut, player, index, performance.now(), !success)
    );
  const gestures = {
    p1: [gestureFor('p1', 0), gestureFor('p1', 1)],
    p2: [gestureFor('p2', 0), gestureFor('p2', 1)],
  } as const;
  const allGestures = [...gestures.p1, ...gestures.p2];
  allGestures.forEach((gesture) => {
    gesture.simultaneousWithExternalGesture(
      ...allGestures.filter((otherGesture) => otherGesture !== gesture)
    );
  });

  const renderBox = (player: Player, index: BoxIndex) => {
    const isTarget = targets[player] === index && gameState === 'zap';
    const playerNumber = player === 'p1' ? 1 : 2;

    return (
      <GestureDetector gesture={gestures[player][index]} key={`${player}-${index}`}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Player ${playerNumber} ${index === 0 ? 'left' : 'right'} reaction button${isTarget ? ', GO now' : ''}`}
          accessibilityHint="Hold both buttons. Release this button only if it turns white."
          style={[styles.box, hasTouchedToStart[player] && styles.held, isTarget && styles.targetBox]}
        >
          <Text style={[styles.boxLabel, isTarget && styles.boxLabelOnTarget]}>
            {isTarget ? 'GO!' : index === 0 ? 'L' : 'R'}
          </Text>
        </View>
      </GestureDetector>
    );
  };

  const renderPlayer = (player: Player, top: boolean) => {
    const playerNumber = player === 'p1' ? 1 : 2;
    const playerWon = gameState === 'round-result' && roundWinner === `Player ${playerNumber}`;
    const draw = gameState === 'round-result' && (roundWinner === 'Draw' || roundWinner.includes('draw'));
    const result = roundResults[player];
    return (
      <View style={[styles.playerArea, top ? styles.playerAreaTop : styles.playerAreaBottom, top && styles.rotated]}>
        <View style={styles.boxRow}>{renderBox(player, 0)}{renderBox(player, 1)}</View>
        <View style={[
          styles.labelBlock,
          gameState === 'round-result' && !draw && (playerWon ? styles.successPanel : styles.failurePanel),
          draw && styles.drawPanel,
        ]}>
          <Text style={[styles.playerLabel, player === 'p1' ? styles.p1 : styles.p2]}>PLAYER {playerNumber}</Text>
          <Text style={[styles.livesText, player === 'p1' ? styles.p1 : styles.p2]}>LIVES {lives[player]}</Text>
          <Text style={styles.readyText}>{playerWon ? 'ROUND WIN' : hasTouchedToStart[player] ? 'READY' : 'HOLD BOTH'}</Text>
          {(result !== null || gameState === 'round-result') && (
            <Text style={[
              styles.reactionText,
              result?.kind === 'invalid' && styles.failureText,
              result === null && styles.noReleaseText,
            ]}>
              {formatPlayerRoundResult(result)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const status = gameState === 'round-result'
    ? roundWinner.toUpperCase()
    : gameState === 'zap'
      ? 'GO!'
      : hasTouchedToStart.p1 && hasTouchedToStart.p2
        ? 'KEEP HOLDING'
        : 'GET READY';

  return (
    <GestureHandlerRootView style={styles.screen} onStartShouldSetResponder={() => true}>
      <SafeAreaView style={styles.playArea} edges={['top', 'bottom']}>
        {renderPlayer('p2', true)}
        <View pointerEvents="none" style={styles.centerStatus}>
          <Text accessibilityLiveRegion="polite" style={[styles.statusTop, gameState === 'round-result' && styles.resultStatus]}>{status}</Text>
          {roundDetail ? <Text style={styles.detailTop}>{roundDetail}</Text> : null}
          <Text accessibilityLiveRegion="polite" style={[styles.status, gameState === 'round-result' && styles.resultStatus]}>{status}</Text>
          {roundDetail ? <Text style={styles.detail}>{roundDetail}</Text> : null}
        </View>
        {renderPlayer('p1', false)}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: arcadeColors.background },
  playArea: { flex: 1, width: '100%' },
  playerArea: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  playerAreaTop: { top: '4%' },
  playerAreaBottom: { bottom: '6%' },
  rotated: { transform: [{ rotate: '180deg' }] },
  boxRow: { width: '90%', flexDirection: 'row', justifyContent: 'space-between', gap: arcadeMetrics.spacing.md },
  box: {
    flex: 1, aspectRatio: 1, borderWidth: arcadeMetrics.borderWidth,
    borderColor: arcadeColors.outline, borderRadius: arcadeMetrics.radius,
    backgroundColor: arcadeColors.surface, alignItems: 'center', justifyContent: 'center',
  },
  held: { backgroundColor: arcadeColors.surfaceHeld },
  targetBox: { backgroundColor: arcadeColors.signal, borderColor: arcadeColors.signal },
  boxLabel: { ...arcadeTypography.heading, color: arcadeColors.textMuted, fontSize: 25 },
  boxLabelOnTarget: { color: arcadeColors.signalText },
  labelBlock: { alignItems: 'center', justifyContent: 'center', marginTop: 4, paddingHorizontal: 16, borderRadius: arcadeMetrics.radiusSmall },
  successPanel: { backgroundColor: arcadeColors.success },
  failurePanel: { backgroundColor: arcadeColors.failure },
  drawPanel: { borderWidth: 2, borderColor: arcadeColors.victory },
  playerLabel: { ...arcadeTypography.eyebrow, fontSize: 15 },
  livesText: { ...arcadeTypography.body, fontWeight: '800' },
  p1: { color: arcadeColors.player1 },
  p2: { color: arcadeColors.player2 },
  readyText: { ...arcadeTypography.eyebrow, marginTop: 2 },
  reactionText: { ...arcadeTypography.body, color: arcadeColors.success, fontWeight: '800', fontVariant: ['tabular-nums'] },
  failureText: { color: arcadeColors.failure },
  noReleaseText: { color: arcadeColors.textMuted, fontSize: 11 },
  centerStatus: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  status: { ...arcadeTypography.heading, position: 'absolute', top: '50%', textAlign: 'center' },
  statusTop: { ...arcadeTypography.heading, position: 'absolute', bottom: '50%', textAlign: 'center', transform: [{ rotate: '180deg' }] },
  detail: { ...arcadeTypography.eyebrow, position: 'absolute', top: '54%', color: arcadeColors.failure },
  detailTop: { ...arcadeTypography.eyebrow, position: 'absolute', bottom: '54%', color: arcadeColors.failure, transform: [{ rotate: '180deg' }] },
  resultStatus: { color: arcadeColors.victory },
});
