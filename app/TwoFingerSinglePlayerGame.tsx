import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import TwoFingerSinglePlayerGameContent from '../components/TwoFingerSinglePlayerContent';
import {
  createRandomWait,
  evaluateReaction,
  isCorrectTarget,
  isHeldAfterInput,
} from '../gameplay/core';
import { RoundTimerManager } from '../gameplay/RoundTimerManager';
import { useGlobalSettings } from './GlobalSettings';

type Finger = 'left' | 'right';
type GameState = 'idle' | 'waiting' | 'zap' | 'reaction-done' | 'game-over';

const difficultyLevels = [
  { label: 'Easy', value: 'easy' as const, reactionLimit: 500 },
  { label: 'Medium', value: 'medium' as const, reactionLimit: 350 },
  { label: 'Hard', value: 'hard' as const, reactionLimit: 250 },
];

export default function TwoFingerSinglePlayerGameScreen() {
  const router = useRouter();
  const { settings } = useGlobalSettings();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [filledFinger, setFilledFinger] = useState<Finger | null>(null);
  const [reactionTime, setReactionTime] = useState(0);
  const [zapsAvoided, setZapsAvoided] = useState(0);
  const [bestReactionTime, setBestReactionTime] = useState<number | null>(null);
  const [hasTouchedToStart, setHasTouchedToStart] = useState({ left: false, right: false });
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [failureReason, setFailureReason] = useState('Round ended.');

  const timersRef = useRef(new RoundTimerManager());
  const startTimeRef = useRef<number | null>(null);
  const targetFingerRef = useRef<Finger | null>(null);
  const touchHeldRef = useRef({ left: false, right: false });
  const gameStateRef = useRef<GameState>('idle');

  useEffect(() => () => timersRef.current.invalidate(), []);

  const updateGameState = (nextState: GameState) => {
    gameStateRef.current = nextState;
    setGameState(nextState);
  };

  const getReactionLimit = () =>
    difficultyLevels.find((level) => level.value === difficulty)?.reactionLimit ?? 500;

  const resetGame = () => {
    timersRef.current.invalidate();
    updateGameState('idle');
    setFilledFinger(null);
    setReactionTime(0);
    setZapsAvoided(0);
    setBestReactionTime(null);
    setHasTouchedToStart({ left: false, right: false });
    touchHeldRef.current = { left: false, right: false };
    targetFingerRef.current = null;
    startTimeRef.current = null;
    setFailureReason('Round ended.');
  };

  const startRound = () => {
    const roundId = timersRef.current.beginRound();
    const target = Math.random() < 0.5 ? 'left' : 'right';
    targetFingerRef.current = target;
    startTimeRef.current = null;
    updateGameState('waiting');
    setFilledFinger(null);
    setReactionTime(0);

    timersRef.current.schedule(roundId, () => {
      if (!touchHeldRef.current.left || !touchHeldRef.current.right) return;

      setFilledFinger(target);
      timersRef.current.scheduleFrame(roundId, (frameTime) => {
        startTimeRef.current = frameTime;
        updateGameState('zap');

        if (settings.vibrationEnabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }

        timersRef.current.schedule(roundId, () => {
          timersRef.current.scheduleFrame(roundId, () => {
            if (gameStateRef.current !== 'zap') return;
            setFailureReason('Timeout — the target finger was held past the deadline.');
            updateGameState('game-over');
            setFilledFinger(null);
            setHasTouchedToStart({ left: false, right: false });
            touchHeldRef.current = { left: false, right: false };
          });
        }, getReactionLimit());
      });
    }, createRandomWait());
  };

  const handlePressIn = (finger: Finger) => {
    touchHeldRef.current[finger] = isHeldAfterInput('press');
    setHasTouchedToStart((previous) => ({ ...previous, [finger]: true }));

    if (
      gameStateRef.current === 'idle' &&
      touchHeldRef.current.left &&
      touchHeldRef.current.right
    ) {
      startRound();
    }
  };

  const handlePressOut = (finger: Finger, releaseTime: number, cancelled: boolean) => {
    const stateAtRelease = gameStateRef.current;
    touchHeldRef.current[finger] = isHeldAfterInput(cancelled ? 'cancel' : 'release');
    setHasTouchedToStart((previous) => ({ ...previous, [finger]: false }));

    if (stateAtRelease === 'idle') return;

    if (stateAtRelease === 'waiting') {
      timersRef.current.invalidate();
      setFailureReason(
        cancelled ? 'Hold interrupted before GO.' : 'False start — released before GO.'
      );
      updateGameState('game-over');
      setFilledFinger(null);
      return;
    }

    if (stateAtRelease !== 'zap' || startTimeRef.current === null) return;

    const target = targetFingerRef.current;
    if (target === null || !isCorrectTarget(target, finger)) {
      timersRef.current.invalidate();
      setFailureReason('Wrong finger — release only the white target.');
      updateGameState('game-over');
      setFilledFinger(null);
      return;
    }

    const result = evaluateReaction(startTimeRef.current, releaseTime, getReactionLimit());
    setReactionTime(Math.max(0, result.reactionTime));
    timersRef.current.invalidate();

    if (result.kind !== 'valid') {
      setFailureReason('Too slow — released after the deadline.');
      updateGameState('game-over');
      setFilledFinger(null);
      return;
    }

    setZapsAvoided((previous) => previous + 1);
    setBestReactionTime((previous) =>
      previous === null ? result.reactionTime : Math.min(previous, result.reactionTime)
    );
    setFilledFinger(null);
    updateGameState('reaction-done');

    const transitionId = timersRef.current.beginRound();
    timersRef.current.schedule(transitionId, () => {
      targetFingerRef.current = null;
      startTimeRef.current = null;
      updateGameState('idle');
    }, 1_000);
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
        failureReason={failureReason}
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
