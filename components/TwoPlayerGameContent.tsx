import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

type Player = 'p1' | 'p2';

interface TwoPlayerGameContentProps {
  isFilled: boolean;
  lives: { p1: number; p2: number };
  onPlayerPressIn: (player: Player) => void;
  onPlayerPressOut: (player: Player) => void;
  roundWinner: string;
  gameState: 'idle' | 'waiting' | 'zap' | 'round-result' | 'game-over';
  reactionTime: { p1: number | null; p2: number | null };
  bestReactionTime: number | null;
  resetGame: () => void;
  router: any;
  hasTouchedToStart: { p1: boolean; p2: boolean };
}

export default function TwoPlayerGameContent(props: TwoPlayerGameContentProps) {
  const {
    isFilled,
    lives,
    onPlayerPressIn,
    onPlayerPressOut,
    roundWinner,
    gameState,
    reactionTime,
    bestReactionTime,
    resetGame,
    router,
    hasTouchedToStart,
  } = props;

  if (gameState === 'game-over') {
    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultText}>
          {roundWinner === 'Draw' ? 'Draw!' : `${roundWinner} Wins!`}
        </Text>

        <Text style={styles.resultText}>P1 Lives: {lives.p1} — P2 Lives: {lives.p2}</Text>

        <Text style={[styles.smallText, { marginTop: 10 }]}>
          Best Reaction:{' '}
          {bestReactionTime !== null ? `${bestReactionTime.toFixed(2)} ms` : '---'}
        </Text>

        <View style={{ height: 16 }} />

        <Text style={styles.button} onPress={resetGame}>
          Play Again
        </Text>

        <Text style={styles.button} onPress={() => router.push('/')}>
          Main Menu
        </Text>
      </View>
    );
  }

  return (
    <>
        <GestureHandlerRootView
        style={{ flex: 1 }}
        onStartShouldSetResponder={() => true}
      >
        {/* TOP: Player 2 Status */}
        <Text style={[styles.smallTextTop, { textAlign: 'center', marginTop: 8 }]}>
          {hasTouchedToStart.p2 ? 'WAITING...' : 'TOUCH & HOLD TO START'}
        </Text>
        {/* TOP: Player 2 Box */}
        <GestureDetector gesture={Gesture.LongPress().minDuration(0).onStart(() => scheduleOnRN(onPlayerPressIn,'p2')).onEnd(() => scheduleOnRN(onPlayerPressOut,'p2'))}>
          <View style={[styles.rectangle, styles.rectangleTop, isFilled && styles.filled]}>
            <Text style={styles.livesText}>❤️ {lives.p2}</Text>
            <Text style={styles.playerLabel}>PLAYER 2</Text>
            <Text style={styles.reactionText}>
              {reactionTime.p2 !== null ? `${reactionTime.p2.toFixed(2)} ms` : ''}
            </Text>
          </View>
        </GestureDetector>

        {/* CENTER STATUS */}
        <Text style={styles.statusTextTop}>{gameState.toUpperCase()}</Text>
        <Text style={styles.statusText}>{gameState.toUpperCase()}</Text>

        <GestureDetector gesture={Gesture.LongPress().minDuration(0).onStart(() => scheduleOnRN(onPlayerPressIn,'p1')).onEnd(() => scheduleOnRN(onPlayerPressOut,'p1'))}>
          <View style={[styles.rectangle, styles.rectangleBottom, isFilled && styles.filled]}>
            <Text style={styles.livesText}>❤️ {lives.p1}</Text>
            <Text style={styles.playerLabel}>PLAYER 1</Text>
            <Text style={styles.reactionText}>
              {reactionTime.p1 !== null ? `${reactionTime.p1.toFixed(2)} ms` : ''}
            </Text>
          </View>
        </GestureDetector>

        {/* BOTTOM: Player 1 Status */}
        <Text style={[styles.smallTextButtom, { textAlign: 'center', marginBottom: 8 }]}>
          {hasTouchedToStart.p1 ? 'WAITING...' : 'TOUCH & HOLD TO START'}
        </Text>

        </GestureHandlerRootView>
    </>
  );
}

const styles = StyleSheet.create({
  rectangle: {
    width: '90%',
    height: '40%',
    position: 'absolute',
    borderWidth: 5,
    borderColor: 'white',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rectangleTop: {
    top: '5%',
    // rotate so text feels oriented for player 2 (optional)
    transform: [{ rotate: '180deg' }],
  },
  rectangleBottom: {
    bottom: '6%',
  },
  filled: {
    backgroundColor: 'white',
  },
  livesText: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  playerLabel: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  reactionText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  statusText: {
    position: 'absolute',
    top: '49%',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    zIndex: 10,
  },
  statusTextTop: {
    position: 'absolute',
    top: '47%',
    left: 0,
    right: 0,
    alignSelf: 'center',
    textAlign: 'center',
    transform : 'rotate(180deg)',
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    zIndex: 10,
  },
  resultContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'black',
    width: '100%',
    height: '100%',
  },
  resultText: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  button: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    color: 'black',
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    width: 180,
  },
  smallTextTop: {
    position: 'absolute',
    top: '2%',
    alignSelf: 'center',
    transform : 'rotate(180deg)',
    color: 'white',
    fontSize: 14,
  },
  smallTextButtom: {
    position: 'absolute',
    top: '95%',
    alignSelf: 'center',
    color: 'white',
    fontSize: 14,
  },
    smallText: {
    color: 'white',
    fontSize: 14,
  },
});
