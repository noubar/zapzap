import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import SinglePlayerGameContent from '../components/OneFingerSinglePlayerContent';

const difficultyLevels = [
  { label: 'Easy', value: 'easy' as 'easy', reactionLimit: 500 },
  { label: 'Medium', value: 'medium' as 'medium', reactionLimit: 350 },
  { label: 'Hard', value: 'hard' as 'hard', reactionLimit: 250 },
];

export default function SinglePlayerGameScreen() {
  const router = useRouter();
  const [gameState, setGameState] = useState('waiting'); // 'waiting', 'zap', 'game-over'
  const [fillTime, setFillTime] = useState(0); // Time until rectangle fills
  const [isFilled, setIsFilled] = useState(false); // Whether the rectangle is filled
  const [reactionTime, setReactionTime] = useState(0); // Players react time in ms
  const [zapesAvoided, setZapesAvoided] = useState(0); // Number of successful zapes avoided
  const [bestReactionTime, setBestReactionTime] = useState<number | null>(null);
  const [hasTouchedToStart, setHasTouchedToStart] = useState(false); // Players first touch to start
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');

  const timerRef = useRef<number | null>(null); // Timer for filling the rectangle
  const zapTimerRef = useRef<number | null>(null); // Timer for raction timeout
  const startTimeRef = useRef(0); // Stores the timestamp of "zap"
  const touchHeldRef = useRef({ p1: false }); // Whether player is currently touching
  const releaseTimeRef = useRef({ p1: 0 }); // Time when player last released
  const gameStateRef = useRef(gameState); // To access latest gameState in async callbacks

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (zapTimerRef.current) clearTimeout(zapTimerRef.current);
    };
  }, []);
  // Keep gameStateRef in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  
  const resetGame = () => {
    setGameState('waiting');
    setIsFilled(false);
    setReactionTime(0);
    setHasTouchedToStart(false);
    setZapesAvoided(0);
  };

  const getRandomTime = () => Math.random() * 4000 + 1000; // 1 to 5 seconds

  const startRound = () => {
    setGameState('waiting');
    setIsFilled(false);
    setReactionTime(0);
    touchHeldRef.current = { p1: false };
    releaseTimeRef.current = { p1: 0 };
    const newFillTime = getRandomTime();
    setFillTime(newFillTime);

    timerRef.current = setTimeout(() => {
      if (gameStateRef.current === 'game-over') return; // Prevent starting round if game is over
      setIsFilled(true);
      startTimeRef.current = performance.now();
      setGameState('zap');

      zapTimerRef.current = setTimeout(() => {
        if (gameStateRef.current === 'game-over') return; // Prevent state change if game is over
        if (touchHeldRef.current.p1) {
          setGameState('game-over');
        }
      }, 1000);
    }, newFillTime);
  };

  const getReactionLimit = () => {
    const level = difficultyLevels.find(d => d.value === difficulty);
    return level ? level.reactionLimit : 500;
  };

  const handlePressIn = () => {
    if (gameState === 'waiting') {
      touchHeldRef.current['p1'] = true;
      setHasTouchedToStart(true);
      startRound();
    }
  };

  const handlePressOut = () => {
    if (gameState === 'zap') {
      if (zapTimerRef.current) {
        clearTimeout(zapTimerRef.current);
        zapTimerRef.current = null;
      }
      const endTime = performance.now();
      const timeDiff = endTime - startTimeRef.current;
      setReactionTime(timeDiff);

      const reactionLimit = getReactionLimit();
      if (timeDiff > reactionLimit) {
        setGameState('game-over');
      } 
      else {
        setZapesAvoided(prev => prev + 1);
        setGameState('reaction-done');
        setBestReactionTime(prev => (prev === null ? timeDiff : Math.min(prev, timeDiff)));
        setTimeout(() => {
          if (gameStateRef.current !== 'game-over') startRound();
        }, 1000);
      }
    } 
    else if (gameState === 'waiting') {
      setGameState('game-over');
    }
    touchHeldRef.current['p1'] = false; // Player released
    releaseTimeRef.current['p1'] = performance.now(); // Record release time
  };

  

  return (
    <View style={styles.container}>
      <SinglePlayerGameContent
        isFilled={isFilled}
        handlePressIn={handlePressIn}
        handlePressOut={handlePressOut}
        gameState={gameState}
        reactionTime={reactionTime}
        bestReactionTime={bestReactionTime}
        resetGame={resetGame}
        router={router}
        zapesAvoided={zapesAvoided}
        hasTouchedToStart={hasTouchedToStart}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        levels={difficultyLevels}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
