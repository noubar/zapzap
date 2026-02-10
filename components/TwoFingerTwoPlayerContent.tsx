// TwoVsTwoGameContent.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

type Player = 'p1' | 'p2';
type BoxIndex = 0 | 1;

interface TwoFingerTwoPlayerContent {
  targets: { p1: number | null; p2: number | null };
  lives: { p1: number; p2: number };
  onBoxPressIn: (player: Player, index: BoxIndex) => void;
  onBoxPressOut: (player: Player, index: BoxIndex) => void;
  roundWinner: string;
  gameState: 'idle' | 'waiting' | 'zap' | 'round-result' | 'game-over';
  reactionTimes: { p1: number | null; p2: number | null };
  bestReactionTime: number | null;
  resetGame: () => void;
  router: any;
  hasTouchedToStart: { p1: boolean; p2: boolean };
}

export default function TwoVsTwoGameContent(props: TwoFingerTwoPlayerContent) {
  const {
    targets,
    lives,
    onBoxPressIn,
    onBoxPressOut,
    roundWinner,
    gameState,
    reactionTimes,
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
        <Text style={styles.resultText}>
          P1 Lives: {lives.p1} — P2 Lives: {lives.p2}
        </Text>
        <Text style={[styles.smallText, { marginTop: 10 }]}>
          Best Reaction:{' '}
          {bestReactionTime !== null ? `${bestReactionTime.toFixed(2)} ms` : '---'}
        </Text>

        <View style={{ height: 16 }} />

        <Text style={styles.button} onPress={resetGame}>
          Play Again
        </Text>
        <Text style={styles.button} onPress={() => router.push('/')}
        >
          Main Menu
        </Text>
      </View>
    );
  }

  const renderBox = (player: Player, index: BoxIndex) => {
    const isTarget = targets[player] === index && gameState === 'zap';

    const gesture = Gesture.LongPress()
      .minDuration(0)
      .onStart(() => scheduleOnRN(onBoxPressIn, player, index))
      .onEnd(() => scheduleOnRN(onBoxPressOut, player, index));

    return (
      <GestureDetector gesture={gesture} key={`${player}-${index}`}>
        <View style={[styles.box, isTarget && styles.targetBox]}>
          <Text style={[styles.boxLabel, isTarget && styles.boxLabelOnTarget]}>
            {index === 0 ? 'L' : 'R'}
          </Text>
        </View>
      </GestureDetector>
    );
  };

  return (
    <GestureHandlerRootView style={styles.screen} onStartShouldSetResponder={() => true}>
      {/* TOP: Player 2 Status */}
      <Text style={[styles.smallTextTop, { textAlign: 'center', marginTop: 8 }]}>
        {hasTouchedToStart.p2 ? 'WAITING...' : 'TOUCH & HOLD BOTH BOXES TO START'}
      </Text>

      {/* TOP: Player 2 Boxes */}
      <View style={[styles.rectangle, styles.rectangleTop]}>
        <View style={styles.boxRow}>
          {renderBox('p2', 0)}
          {renderBox('p2', 1)}
        </View>
        <View style={styles.labelBlock}>
          <Text style={styles.playerLabel}>PLAYER 2</Text>
          <Text style={styles.livesText}>❤️ {lives.p2}</Text>
          <Text style={styles.reactionText}>
            {reactionTimes.p2 !== null ? `${reactionTimes.p2.toFixed(2)} ms` : ''}
          </Text>
        </View>
      </View>

      {/* CENTER STATUS */}
      <Text style={styles.statusTextTop}>{gameState.toUpperCase()}</Text>
      <Text style={styles.statusText}>{gameState.toUpperCase()}</Text>

      {/* BOTTOM: Player 1 Boxes */}
      <View style={[styles.rectangle, styles.rectangleBottom]}>
        <View style={styles.boxRow}>
          {renderBox('p1', 0)}
          {renderBox('p1', 1)}
        </View>
        <View style={styles.labelBlock}>
          <Text style={styles.playerLabel}>PLAYER 1</Text>
          <Text style={styles.livesText}>❤️ {lives.p1}</Text>
          <Text style={styles.reactionText}>
            {reactionTimes.p1 !== null ? `${reactionTimes.p1.toFixed(2)} ms` : ''}
          </Text>
        </View>
      </View>

      {/* BOTTOM: Player 1 Status */}
      <Text style={[styles.smallTextBottom, { textAlign: 'center', marginBottom: 8 }]}>
        {hasTouchedToStart.p1 ? 'WAITING...' : 'TOUCH & HOLD BOTH BOXES TO START'}
      </Text>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'black',
  },
  rectangle: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',

  },
  rectangleTop: {
    top: '4%',
    transform: [{ rotate: '180deg' }],
  },
  rectangleBottom: {
    bottom: '6%',
  },
  boxRow: {
    width: '90%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  box: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 5,
    borderColor: 'white',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetBox: {
    backgroundColor: 'white',
  },
  boxLabel: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
  },
  boxLabelOnTarget: {
    color: 'black',
  },
  labelBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 4,
  },
  livesText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  playerLabel: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  reactionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  statusText: {
    position: 'absolute',
    top: '50%',
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
    top: '48%',
    left: 0,
    right: 0,
    alignSelf: 'center',
    textAlign: 'center',
    transform: [{ rotate: '180deg' }],
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    zIndex: 10,
  },
  smallTextTop: {
    position: 'absolute',
    top: '3%',
    alignSelf: 'center',
    transform: [{ rotate: '180deg' }],
    color: 'white',
    fontSize: 14,
  },
  smallTextBottom: {
    position: 'absolute',
    top: '93%',
    alignSelf: 'center',
    color: 'white',
    fontSize: 14,
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
    textAlign: 'center',
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
  smallText: {
    color: 'white',
    fontSize: 14,
  },
});
