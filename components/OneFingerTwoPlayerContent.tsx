import { StyleSheet, Text, View } from 'react-native';
import type { Router } from 'expo-router';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { arcadeColors, arcadeMetrics, arcadeTypography, formatReactionTime } from '../constants/ArcadeTheme';
import GameResultScreen from './GameResultScreen';

type Player = 'p1' | 'p2';

interface OneFingerTwoPlayerContentProps {
  isFilled: boolean;
  lives: { p1: number; p2: number };
  onPlayerPressIn: (player: Player) => void;
  onPlayerPressOut: (player: Player, releaseTime: number, cancelled: boolean) => void;
  roundWinner: string;
  roundDetail: string;
  gameState: 'idle' | 'waiting' | 'zap' | 'round-result' | 'game-over';
  reactionTime: { p1: number | null; p2: number | null };
  bestReactionTime: number | null;
  resetGame: () => void;
  router: Router;
  hasTouchedToStart: { p1: boolean; p2: boolean };
}

export default function OneFingerTwoPlayerContent({
  isFilled, lives, onPlayerPressIn, onPlayerPressOut, roundWinner, roundDetail,
  gameState, reactionTime, bestReactionTime, resetGame, router, hasTouchedToStart,
}: OneFingerTwoPlayerContentProps) {
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

  const gestureFor = (player: Player) => Gesture.LongPress()
    .minDuration(0)
    .shouldCancelWhenOutside(false)
    .onStart(() => scheduleOnRN(onPlayerPressIn, player))
    .onEnd((_, success) =>
      scheduleOnRN(onPlayerPressOut, player, performance.now(), !success)
    );

  const status = gameState === 'round-result'
    ? roundWinner.toUpperCase()
    : gameState === 'zap'
      ? 'GO!'
      : hasTouchedToStart.p1 && hasTouchedToStart.p2
        ? 'KEEP HOLDING'
        : 'GET READY';

  const renderPlayer = (player: Player, top: boolean) => {
    const playerNumber = player === 'p1' ? 1 : 2;
    const playerWon = gameState === 'round-result' && roundWinner === `Player ${playerNumber}`;
    const draw = gameState === 'round-result' && (roundWinner === 'Draw' || roundWinner.includes('draw'));
    return (
      <GestureDetector gesture={gestureFor(player)}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Player ${playerNumber} reaction button${isFilled ? ', GO now' : ''}`}
          accessibilityHint="Touch and hold. Release only when the button turns white and says GO."
          style={[
            styles.rectangle,
            top ? styles.rectangleTop : styles.rectangleBottom,
            hasTouchedToStart[player] && !isFilled && styles.held,
            gameState === 'round-result' && !draw && (playerWon ? styles.successBox : styles.failureBox),
            draw && styles.drawBox,
            isFilled && styles.filled,
          ]}
        >
          <Text style={[styles.playerLabel, player === 'p1' ? styles.p1 : styles.p2]}>
            PLAYER {playerNumber}
          </Text>
          <Text style={[styles.livesText, player === 'p1' ? styles.p1 : styles.p2]}>
            LIVES {lives[player]}
          </Text>
          <Text style={[styles.boxAction, isFilled && styles.boxActionSignal]}>
            {isFilled ? 'GO!' : playerWon ? 'ROUND WIN' : 'HOLD'}
          </Text>
          {reactionTime[player] !== null && (
            <Text style={styles.reactionText}>{formatReactionTime(reactionTime[player])}</Text>
          )}
        </View>
      </GestureDetector>
    );
  };

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
  rectangle: {
    width: '90%', height: '40%', position: 'absolute', alignSelf: 'center',
    borderWidth: arcadeMetrics.borderWidth, borderColor: arcadeColors.outline,
    borderRadius: arcadeMetrics.radius, backgroundColor: arcadeColors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  rectangleTop: { top: '5%', transform: [{ rotate: '180deg' }] },
  rectangleBottom: { bottom: '6%' },
  held: { backgroundColor: arcadeColors.surfaceHeld },
  filled: { backgroundColor: arcadeColors.signal, borderColor: arcadeColors.signal },
  successBox: { backgroundColor: arcadeColors.success, borderColor: arcadeColors.success },
  failureBox: { backgroundColor: arcadeColors.failure, borderColor: arcadeColors.failure },
  drawBox: { borderColor: arcadeColors.victory },
  playerLabel: { ...arcadeTypography.eyebrow, fontSize: 16 },
  p1: { color: arcadeColors.player1 },
  p2: { color: arcadeColors.player2 },
  livesText: { ...arcadeTypography.body, position: 'absolute', top: 12, left: 14, fontWeight: '800' },
  boxAction: { ...arcadeTypography.heading, marginTop: arcadeMetrics.spacing.sm },
  boxActionSignal: { color: arcadeColors.signalText },
  reactionText: { ...arcadeTypography.heading, color: arcadeColors.success, marginTop: 8, fontVariant: ['tabular-nums'] },
  centerStatus: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  status: { ...arcadeTypography.heading, position: 'absolute', top: '50%', textAlign: 'center' },
  statusTop: { ...arcadeTypography.heading, position: 'absolute', bottom: '50%', textAlign: 'center', transform: [{ rotate: '180deg' }] },
  detail: { ...arcadeTypography.eyebrow, position: 'absolute', top: '54%', color: arcadeColors.failure },
  detailTop: { ...arcadeTypography.eyebrow, position: 'absolute', bottom: '54%', color: arcadeColors.failure, transform: [{ rotate: '180deg' }] },
  resultStatus: { color: arcadeColors.victory },
});
