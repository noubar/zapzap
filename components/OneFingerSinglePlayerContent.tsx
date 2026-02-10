import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DifficultySelector from './DifficultySelector';

interface OneFingerSinglePlayerContent {
    isFilled: boolean;
    handlePressIn: () => void;
    handlePressOut: () => void;
    gameState: string;
    reactionTime: number;
    bestReactionTime: number | null;
    resetGame: () => void;
    router: any;
    zapesAvoided: number;
    hasTouchedToStart: boolean;
    difficulty: 'easy' | 'medium' | 'hard';
    setDifficulty: (level: 'easy' | 'medium' | 'hard') => void;
    levels: { label: string; value: 'easy' | 'medium' | 'hard' }[];
}

export default function SinglePlayerGameContent(props: OneFingerSinglePlayerContent) {
  const {
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
    levels: difficultyLevels,
  } = props;

  if (gameState === 'game-over') {
    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultText}>Game Over!</Text>
        <Text style={styles.resultText}>Zaps Avoided: {zapesAvoided}</Text>
        <Text style={styles.resultText}>Best Reaction: {bestReactionTime}</Text>
        <Pressable style={styles.button} onPress={resetGame}>
          <Text style={styles.buttonText}>Play Again</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => router.push('/') }>
          <Text style={styles.buttonText}>Main Menu</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
    <Text style={styles.statusText}>{hasTouchedToStart ? 'WAITING' : 'TOUCH TO START'}</Text>
    <DifficultySelector
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        hasTouchedToStart={hasTouchedToStart}
        levels={difficultyLevels}
        />
      <View style={[styles.rectangle, isFilled && styles.filled]}>
        <Pressable
          style={styles.fullSize}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        />
      </View>
      {reactionTime > 0 && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>{reactionTime.toFixed(2)} ms</Text>
        </View>
      )}
      <View style={{ position: 'absolute', top: 85, left: 0, right: 0, alignItems: 'center', zIndex: 20 }}>
            <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold' }}>
              Zaps Avoided: {zapesAvoided}
            </Text>
      </View>
      <View style={{ position: 'absolute', top: 110, left: 0, right: 0, alignItems: 'center', zIndex: 10 }}>
        <Text style={{ color: 'white', fontSize: 18 }}>
          Best Reaction: {bestReactionTime !== null ? bestReactionTime.toFixed(2) + ' ms' : '---'}
        </Text>
      </View>
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
    bottom: '5%',
  },
  filled: {
    backgroundColor: 'white',
  },
  fullSize: {
    flex: 1,
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
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  buttonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
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
    top: 50,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    zIndex: 10,
  },
});
