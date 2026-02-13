import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import TwoFingerSinglePlayerGameContent from '../components/TwoFingerSinglePlayerContent';
import { useGlobalSettings } from './GlobalSettings';

type Finger = 'left' | 'right';

const difficultyLevels = [
  { label: 'Easy', value: 'easy' as const, reactionLimit: 500 },
  { label: 'Medium', value: 'medium' as const, reactionLimit: 350 },
  { label: 'Hard', value: 'hard' as const, reactionLimit: 250 },
];

export default function TwoFingerSinglePlayerGameScreen() {
  const router = useRouter();
  const { settings } = useGlobalSettings();
  const vibrationEnabled = settings.vibrationEnabled;
  const [gameState, setGameState] = useState<'idle' | 'waiting' | 'zap' | 'reaction-done' | 'game-over'>('idle');
  const [filledFinger, setFilledFinger] = useState<Finger | null>(null);
  const [reactionTime, setReactionTime] = useState(0);
  const [zapsAvoided, setZapsAvoided] = useState(0);
  const [bestReactionTime, setBestReactionTime] = useState<number | null>(null);
  const [hasTouchedToStart, setHasTouchedToStart] = useState({ left: false, right: false });
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');

  const timerRef = useRef<number | null>(null);
  const zapTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const targetFingerRef = useRef<Finger | null>(null);
  const touchHeldRef = useRef({ left: false, right: false });
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (zapTimerRef.current) clearTimeout(zapTimerRef.current);
    };
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const resetGame = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (zapTimerRef.current) clearTimeout(zapTimerRef.current);
    setGameState('idle');
    setFilledFinger(null);
    setReactionTime(0);
    setZapsAvoided(0);
    setBestReactionTime(null);
    setHasTouchedToStart({ left: false, right: false });
    touchHeldRef.current = { left: false, right: false };
    targetFingerRef.current = null;
  };

  const getRandomTime = () => Math.random() * 4000 + 1000;

  const getReactionLimit = () => {
    const level = difficultyLevels.find((d) => d.value === difficulty);
    return level ? level.reactionLimit : 500;
  };

  const pickTargetFinger = (): Finger => (Math.random() < 0.5 ? 'left' : 'right');

  const startRound = () => {
    setGameState('waiting');
    setFilledFinger(null);
    setReactionTime(0);
    const nextTarget = pickTargetFinger();
    targetFingerRef.current = nextTarget;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (zapTimerRef.current) clearTimeout(zapTimerRef.current);

    const newFillTime = getRandomTime();
    timerRef.current = setTimeout(() => {
      if (gameStateRef.current === 'game-over') return;
      setFilledFinger(nextTarget);
      startTimeRef.current = performance.now();
      setGameState('zap');
      if (vibrationEnabled) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      const reactionLimit = getReactionLimit();
      zapTimerRef.current = setTimeout(() => {
        if (gameStateRef.current !== 'zap') return;
        if (targetFingerRef.current && touchHeldRef.current[targetFingerRef.current]) {
          setGameState('game-over');
        }
      }, reactionLimit);
    }, newFillTime);
  };

  const handlePressIn = (finger: Finger) => {
    touchHeldRef.current[finger] = true;
    setHasTouchedToStart((prev) => ({ ...prev, [finger]: true }));

    if (
      gameStateRef.current === 'idle' &&
      touchHeldRef.current.left &&
      touchHeldRef.current.right
    ) {
      startRound();
    }
  };

  const handlePressOut = (finger: Finger) => {
    touchHeldRef.current[finger] = false;
    setHasTouchedToStart((prev) => ({ ...prev, [finger]: false }));

    if (gameStateRef.current === 'idle') {
      return;
    }

    if (gameStateRef.current === 'waiting') {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (zapTimerRef.current) clearTimeout(zapTimerRef.current);
      setGameState('game-over');
      return;
    }

    if (gameStateRef.current === 'zap') {
      const target = targetFingerRef.current;
      if (!target || finger !== target) {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (zapTimerRef.current) clearTimeout(zapTimerRef.current);
        setGameState('game-over');
        return;
      }

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
        return;
      }

      setZapsAvoided((prev) => prev + 1);
      setGameState('reaction-done');
      setBestReactionTime((prev) => (prev === null ? timeDiff : Math.min(prev, timeDiff)));
      setFilledFinger(null);

      setTimeout(() => {
        if (gameStateRef.current === 'game-over') return;
        if (touchHeldRef.current.left && touchHeldRef.current.right) {
          startRound();
        } else {
          setGameState('idle');
        }
      }, 1000);
    }
  };

  return (
    <View style={styles.container}>
      <TwoFingerSinglePlayerGameContent
        filledFinger={filledFinger}
        onFingerPressIn={handlePressIn}
        onFingerPressOut={handlePressOut}
        gameState={gameState}
        reactionTime={reactionTime}
        bestReactionTime={bestReactionTime}
        resetGame={resetGame}
        router={router}
        zapsAvoided={zapsAvoided}
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
  },
});
