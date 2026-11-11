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
import {
  createFakeSignalSchedule,
  isReleaseBeforeRealSignal,
  scheduleFakeSignalEvents,
  selectFakeTarget,
  type FakeSignalEvent,
} from '../gameplay/fakeSignals';
import { RoundTimerManager } from '../gameplay/RoundTimerManager';
import { DIFFICULTIES, DIFFICULTY_PROFILES, getReactionDeadline } from '../settings/gameSettings';
import { useGlobalSettings } from './GlobalSettings';

type Finger = 'left' | 'right';
type TwoFingerFakeSignal = FakeSignalEvent & { target: Finger };
type GameState = 'idle' | 'waiting' | 'zap' | 'reaction-done' | 'game-over';

const difficultyLevels = DIFFICULTIES.map((value) => ({
  label: DIFFICULTY_PROFILES[value].label,
  value,
}));

export default function TwoFingerSinglePlayerGameScreen() {
  const router = useRouter();
  const { settings, setSetting } = useGlobalSettings();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [filledFinger, setFilledFinger] = useState<Finger | null>(null);
  const [reactionTime, setReactionTime] = useState(0);
  const [zapsAvoided, setZapsAvoided] = useState(0);
  const [bestReactionTime, setBestReactionTime] = useState<number | null>(null);
  const [hasTouchedToStart, setHasTouchedToStart] = useState({ left: false, right: false });
  const [failureReason, setFailureReason] = useState('Round ended.');
  const [fakeSignal, setFakeSignal] = useState<TwoFingerFakeSignal | null>(null);

  const timersRef = useRef(new RoundTimerManager());
  const startTimeRef = useRef<number | null>(null);
  const roundDeadlineRef = useRef(getReactionDeadline(settings.difficulty));
  const targetFingerRef = useRef<Finger | null>(null);
  const touchHeldRef = useRef({ left: false, right: false });
  const gameStateRef = useRef<GameState>('idle');
  const roundFakeSignalsEnabledRef = useRef(false);

  useEffect(() => () => timersRef.current.invalidate(), []);

  const updateGameState = (nextState: GameState) => {
    gameStateRef.current = nextState;
    setGameState(nextState);
  };

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
    setFakeSignal(null);
  };

  const startRound = () => {
    const roundId = timersRef.current.beginRound();
    roundDeadlineRef.current = getReactionDeadline(settings.difficulty);
    roundFakeSignalsEnabledRef.current = settings.fakeSignalsEnabled;
    const target = Math.random() < 0.5 ? 'left' : 'right';
    targetFingerRef.current = target;
    startTimeRef.current = null;
    updateGameState('waiting');
    setFilledFinger(null);
    setReactionTime(0);
    setFakeSignal(null);

    const realSignalDelayMs = createRandomWait();
    if (roundFakeSignalsEnabledRef.current) {
      const schedule = createFakeSignalSchedule(realSignalDelayMs);
      const fakeEvents: TwoFingerFakeSignal[] = schedule.events.map((event) => ({
        ...event,
        target: selectFakeTarget<Finger>('left', 'right'),
      }));
      scheduleFakeSignalEvents(
        timersRef.current,
        roundId,
        fakeEvents,
        setFakeSignal,
        (event) => setFakeSignal((current) => current?.id === event.id ? null : current)
      );
    }

    timersRef.current.schedule(roundId, () => {
      if (!touchHeldRef.current.left || !touchHeldRef.current.right) return;

      setFakeSignal(null);
      setFilledFinger(target);
      timersRef.current.scheduleFrame(roundId, (frameTime) => {
        startTimeRef.current = frameTime;
        updateGameState('zap');

        if (settings.hapticsEnabled && !roundFakeSignalsEnabledRef.current) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }

        timersRef.current.schedule(roundId, () => {
          timersRef.current.scheduleFrame(roundId, () => {
            if (gameStateRef.current !== 'zap') return;
            setFailureReason('Timeout — the target finger was held past the deadline.');
            updateGameState('game-over');
            setFilledFinger(null);
            setFakeSignal(null);
            setHasTouchedToStart({ left: false, right: false });
            touchHeldRef.current = { left: false, right: false };
          });
        }, roundDeadlineRef.current);
      });
    }, realSignalDelayMs);
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

    if (isReleaseBeforeRealSignal(stateAtRelease)) {
      timersRef.current.invalidate();
      setFailureReason(
        cancelled ? 'Hold interrupted before GO.' : 'False start — released before GO.'
      );
      updateGameState('game-over');
      setFilledFinger(null);
      setFakeSignal(null);
      return;
    }

    if (stateAtRelease !== 'zap' || startTimeRef.current === null) return;

    const target = targetFingerRef.current;
    if (target === null || !isCorrectTarget(target, finger)) {
      timersRef.current.invalidate();
      setFailureReason('Wrong finger — release only the white target.');
      updateGameState('game-over');
      setFilledFinger(null);
      setFakeSignal(null);
      return;
    }

    const result = evaluateReaction(startTimeRef.current, releaseTime, roundDeadlineRef.current);
    setReactionTime(Math.max(0, result.reactionTime));
    timersRef.current.invalidate();

    if (result.kind !== 'valid') {
      setFailureReason('Too slow — released after the deadline.');
      updateGameState('game-over');
      setFilledFinger(null);
      setFakeSignal(null);
      return;
    }

    setZapsAvoided((previous) => previous + 1);
    setBestReactionTime((previous) =>
      previous === null ? result.reactionTime : Math.min(previous, result.reactionTime)
    );
    setFilledFinger(null);
    setFakeSignal(null);
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
        difficulty={settings.difficulty}
        setDifficulty={(difficulty) => setSetting('difficulty', difficulty)}
        levels={difficultyLevels}
        failureReason={failureReason}
        fakeSignal={fakeSignal}
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
