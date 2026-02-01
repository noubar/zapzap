import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import DifficultySelector from '../components/DifficultySelector';

type Finger = 'left' | 'right';

interface TwoFingerSinglePlayerGameContentProps {
  filledFinger: Finger | null;
  onFingerPressIn: (finger: Finger) => void;
  onFingerPressOut: (finger: Finger) => void;
  gameState: string;
  reactionTime: number;
  bestReactionTime: number | null;
  resetGame: () => void;
  router: any;
  zapsAvoided: number;
  hasTouchedToStart: { left: boolean; right: boolean };
  difficulty: 'easy' | 'medium' | 'hard';
  setDifficulty: (level: 'easy' | 'medium' | 'hard') => void;
  levels: { label: string; value: 'easy' | 'medium' | 'hard' }[];
}

export default function TwoFingerSinglePlayerGameContent(
  props: TwoFingerSinglePlayerGameContentProps
) {
  const {
    filledFinger,
    onFingerPressIn,
    onFingerPressOut,
    gameState,
    reactionTime,
    bestReactionTime,
    resetGame,
    router,
    zapsAvoided,
    hasTouchedToStart,
    difficulty,
    setDifficulty,
    levels: difficultyLevels,
  } = props;

  const hasBothTouched = hasTouchedToStart.left && hasTouchedToStart.right;

  if (gameState === 'game-over') {
    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultText}>Game Over!</Text>
        <Text style={styles.resultText}>Zaps Avoided: {zapsAvoided}</Text>
        <Text style={styles.resultText}>
          Best Reaction: {bestReactionTime !== null ? `${bestReactionTime.toFixed(2)} ms` : '---'}
        </Text>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Text style={styles.statusText}>
        {hasBothTouched ? 'WAITING' : 'TOUCH BOTH TO START'}
      </Text>
      <View style={styles.difficultyWrapper}>
        <DifficultySelector
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          hasTouchedToStart={hasBothTouched}
          levels={difficultyLevels}
        />
      </View>

      <View style={styles.rectRow}>
        <GestureDetector
          gesture={Gesture.LongPress()
            .minDuration(0)
            .onStart(() => scheduleOnRN(onFingerPressIn, 'left'))
            .onEnd(() => scheduleOnRN(onFingerPressOut, 'left'))}
        >
          <View style={[styles.rectangle, filledFinger === 'left' && styles.filled]}>
            <Text style={[styles.fingerLabel, filledFinger === 'left' && styles.fingerLabelFilled]}>
              LEFT
            </Text>
          </View>
        </GestureDetector>

        <GestureDetector
          gesture={Gesture.LongPress()
            .minDuration(0)
            .onStart(() => scheduleOnRN(onFingerPressIn, 'right'))
            .onEnd(() => scheduleOnRN(onFingerPressOut, 'right'))}
        >
          <View style={[styles.rectangle, filledFinger === 'right' && styles.filled]}>
            <Text style={[styles.fingerLabel, filledFinger === 'right' && styles.fingerLabelFilled]}>
              RIGHT
            </Text>
          </View>
        </GestureDetector>
      </View>

      {reactionTime > 0 && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>{reactionTime.toFixed(2)} ms</Text>
        </View>
      )}

      <View style={styles.zapsAvoided}>
        <Text style={styles.zapsAvoidedText}>Zaps Avoided: {zapsAvoided}</Text>
      </View>
      <View style={styles.bestReaction}>
        <Text style={styles.bestReactionText}>
          Best Reaction: {bestReactionTime !== null ? `${bestReactionTime.toFixed(2)} ms` : '---'}
        </Text>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  rectRow: {
    position: 'absolute',
    bottom: '6%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: '5%',
    height: '30%',
  },
  rectangle: {
    width: '48%',
    height: '100%',
    borderWidth: 5,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filled: {
    backgroundColor: 'white',
  },
  fingerLabel: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  fingerLabelFilled: {
    color: 'black',
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: 'white',
    borderRadius: 8,
    color: 'black',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    top: '-30%',
  },
  overlayText: {
    color: 'white',
    fontSize: 48,
    fontWeight: 'bold',
  },
  statusText: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    zIndex: 10,
  },
  difficultyWrapper: {
    position: 'absolute',
    top: 85,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  zapsAvoided: {
    position: 'absolute',
    top: 135,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  zapsAvoidedText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  bestReaction: {
    position: 'absolute',
    top: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  bestReactionText: {
    color: 'white',
    fontSize: 16,
  },
});
