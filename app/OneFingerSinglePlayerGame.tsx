import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import SinglePlayerGameContent from '../components/OneFingerSinglePlayerContent';
import { createRandomWait, evaluateReaction, isHeldAfterInput } from '../gameplay/core';
import { RoundTimerManager } from '../gameplay/RoundTimerManager';
import { DIFFICULTIES, DIFFICULTY_PROFILES, getReactionDeadline } from '../settings/gameSettings';
import { useGlobalSettings } from './GlobalSettings';

const difficultyLevels = DIFFICULTIES.map((value) => ({
  label: DIFFICULTY_PROFILES[value].label,
  value,
}));

type GameState = 'idle' | 'waiting' | 'zap' | 'reaction-done' | 'game-over';

export default function SinglePlayerGameScreen() {
  const router = useRouter();
  const { settings, setSetting } = useGlobalSettings();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [isFilled, setIsFilled] = useState(false);
  const [reactionTime, setReactionTime] = useState(0);
  const [zapesAvoided, setZapesAvoided] = useState(0);
  const [bestReactionTime, setBestReactionTime] = useState<number | null>(null);
  const [hasTouchedToStart, setHasTouchedToStart] = useState(false);
  const [failureReason, setFailureReason] = useState('Round ended.');

  const timersRef = useRef(new RoundTimerManager());
  const startTimeRef = useRef<number | null>(null);
  const roundDeadlineRef = useRef(getReactionDeadline(settings.difficulty));
  const touchHeldRef = useRef(false);
  const gameStateRef = useRef<GameState>('idle');

  useEffect(() => () => timersRef.current.invalidate(), []);

  const updateGameState = (nextState: GameState) => {
    gameStateRef.current = nextState;
    setGameState(nextState);
  };

  const resetGame = () => {
    timersRef.current.invalidate();
    startTimeRef.current = null;
    touchHeldRef.current = false;
    updateGameState('idle');
    setIsFilled(false);
    setReactionTime(0);
    setHasTouchedToStart(false);
    setZapesAvoided(0);
    setBestReactionTime(null);
    setFailureReason('Round ended.');
  };

  const finishRound = (roundId: number) => {
    updateGameState('reaction-done');
    setIsFilled(false);
    setHasTouchedToStart(false);

    timersRef.current.schedule(roundId, () => {
      startTimeRef.current = null;
      updateGameState('idle');
    }, 1_000);
  };

  const startRound = () => {
    const roundId = timersRef.current.beginRound();
    roundDeadlineRef.current = getReactionDeadline(settings.difficulty);
    updateGameState('waiting');
    setIsFilled(false);
    setReactionTime(0);
    startTimeRef.current = null;

    timersRef.current.schedule(roundId, () => {
      if (!touchHeldRef.current) return;

      setIsFilled(true);
      timersRef.current.scheduleFrame(roundId, (frameTime) => {
        startTimeRef.current = frameTime;
        updateGameState('zap');

        if (settings.hapticsEnabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }

        timersRef.current.schedule(roundId, () => {
          timersRef.current.scheduleFrame(roundId, () => {
            if (gameStateRef.current !== 'zap') return;
            touchHeldRef.current = false;
            setHasTouchedToStart(false);
            setFailureReason('Timeout — the button was held past the deadline.');
            updateGameState('game-over');
            setIsFilled(false);
          });
        }, roundDeadlineRef.current);
      });
    }, createRandomWait());
  };

  const handlePressIn = () => {
    if (gameStateRef.current !== 'idle') return;
    touchHeldRef.current = isHeldAfterInput('press');
    setHasTouchedToStart(true);
    startRound();
  };

  const handlePressOut = (releaseTime: number, cancelled: boolean) => {
    const stateAtRelease = gameStateRef.current;
    touchHeldRef.current = isHeldAfterInput(cancelled ? 'cancel' : 'release');
    setHasTouchedToStart(false);

    if (stateAtRelease === 'waiting') {
      timersRef.current.invalidate();
      setFailureReason(
        cancelled ? 'Hold interrupted before GO.' : 'False start — released before GO.'
      );
      updateGameState('game-over');
      setIsFilled(false);
      return;
    }

    if (stateAtRelease !== 'zap' || startTimeRef.current === null) return;

    const result = evaluateReaction(startTimeRef.current, releaseTime, roundDeadlineRef.current);
    setReactionTime(Math.max(0, result.reactionTime));

    if (result.kind !== 'valid') {
      timersRef.current.invalidate();
      setFailureReason('Too slow — released after the deadline.');
      updateGameState('game-over');
      setIsFilled(false);
      return;
    }

    timersRef.current.invalidate();
    const transitionId = timersRef.current.beginRound();
    setZapesAvoided((previous) => previous + 1);
    setBestReactionTime((previous) =>
      previous === null ? result.reactionTime : Math.min(previous, result.reactionTime)
    );
    finishRound(transitionId);
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
        difficulty={settings.difficulty}
        setDifficulty={(difficulty) => setSetting('difficulty', difficulty)}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
