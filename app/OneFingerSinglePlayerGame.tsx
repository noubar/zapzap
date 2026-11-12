import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import SinglePlayerGameContent from '../components/OneFingerSinglePlayerContent';
import { createRandomWait, evaluateReaction, isHeldAfterInput } from '../gameplay/core';
import {
  createFakeSignalSchedule,
  isReleaseBeforeRealSignal,
  scheduleFakeSignalEvents,
  type FakeSignalEvent,
} from '../gameplay/fakeSignals';
import { RoundTimerManager } from '../gameplay/RoundTimerManager';
import { useFeedback } from '../feedback/FeedbackProvider';
import { createStatisticsSessionId, useStatistics } from '../statistics/StatisticsProvider';
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
  const { beginFeedbackSession, cancelFeedback, emitFeedback } = useFeedback();
  const { recordEvent, setGameplayActive } = useStatistics();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [isFilled, setIsFilled] = useState(false);
  const [reactionTime, setReactionTime] = useState(0);
  const [zapesAvoided, setZapesAvoided] = useState(0);
  const [bestReactionTime, setBestReactionTime] = useState<number | null>(null);
  const [hasTouchedToStart, setHasTouchedToStart] = useState(false);
  const [failureReason, setFailureReason] = useState('Round ended.');
  const [fakeSignal, setFakeSignal] = useState<FakeSignalEvent | null>(null);

  const timersRef = useRef(new RoundTimerManager());
  const startTimeRef = useRef<number | null>(null);
  const roundDeadlineRef = useRef(getReactionDeadline(settings.difficulty));
  const touchHeldRef = useRef(false);
  const roundFakeSignalsEnabledRef = useRef(false);
  const roundDifficultyRef = useRef(settings.difficulty);
  const gameStateRef = useRef<GameState>('idle');
  const feedbackSessionRef = useRef(0);
  const statisticsSessionRef = useRef(createStatisticsSessionId('one-finger-solo'));
  const gameStartedRecordedRef = useRef(false);
  const roundSequenceRef = useRef(0);
  const currentRoundEventIdRef = useRef('');

  useEffect(() => () => {
    timersRef.current.invalidate();
    cancelFeedback();
    setGameplayActive(false);
  }, [cancelFeedback, setGameplayActive]);

  const updateGameState = (nextState: GameState) => {
    gameStateRef.current = nextState;
    setGameState(nextState);
    setGameplayActive(nextState === 'waiting' || nextState === 'zap');
  };

  const recordRound = (
    eventId: string,
    result: { kind: 'valid'; reactionTimeMs: number } | { kind: 'invalid'; reason: 'false-start' | 'timeout' | 'cancelled' | 'late' },
    gameCompleted: boolean
  ) => recordEvent({
    id: eventId,
    type: 'single-round-completed',
    occurredAt: new Date().toISOString(),
    configuration: {
      variant: 'one-finger-single',
      difficulty: roundDifficultyRef.current,
      fakeSignalsEnabled: roundFakeSignalsEnabledRef.current,
    },
    result,
    gameCompleted,
  });

  const resetGame = () => {
    timersRef.current.invalidate();
    cancelFeedback();
    statisticsSessionRef.current = createStatisticsSessionId('one-finger-solo');
    gameStartedRecordedRef.current = false;
    roundSequenceRef.current = 0;
    startTimeRef.current = null;
    touchHeldRef.current = false;
    updateGameState('idle');
    setIsFilled(false);
    setReactionTime(0);
    setHasTouchedToStart(false);
    setZapesAvoided(0);
    setBestReactionTime(null);
    setFailureReason('Round ended.');
    setFakeSignal(null);
  };

  const finishRound = (roundId: number) => {
    updateGameState('reaction-done');
    setIsFilled(false);
    setFakeSignal(null);
    setHasTouchedToStart(false);

    timersRef.current.schedule(roundId, () => {
      startTimeRef.current = null;
      updateGameState('idle');
    }, 1_000);
  };

  const startRound = () => {
    const roundId = timersRef.current.beginRound();
    roundSequenceRef.current += 1;
    currentRoundEventIdRef.current = `${statisticsSessionRef.current}:round:${roundSequenceRef.current}`;
    feedbackSessionRef.current = beginFeedbackSession();
    roundDeadlineRef.current = getReactionDeadline(settings.difficulty);
    roundDifficultyRef.current = settings.difficulty;
    roundFakeSignalsEnabledRef.current = settings.fakeSignalsEnabled;
    updateGameState('waiting');
    if (!gameStartedRecordedRef.current) {
      gameStartedRecordedRef.current = true;
      recordEvent({
        id: `${statisticsSessionRef.current}:game-started`,
        type: 'single-game-started',
        occurredAt: new Date().toISOString(),
        configuration: {
          variant: 'one-finger-single',
          difficulty: roundDifficultyRef.current,
          fakeSignalsEnabled: roundFakeSignalsEnabledRef.current,
        },
      });
    }
    setIsFilled(false);
    setReactionTime(0);
    startTimeRef.current = null;
    setFakeSignal(null);

    const realSignalDelayMs = createRandomWait();
    if (roundFakeSignalsEnabledRef.current) {
      const schedule = createFakeSignalSchedule(realSignalDelayMs);
      scheduleFakeSignalEvents(
        timersRef.current,
        roundId,
        schedule.events,
        setFakeSignal,
        (event) => setFakeSignal((current) => current?.id === event.id ? null : current)
      );
    }

    timersRef.current.schedule(roundId, () => {
      if (!touchHeldRef.current) return;

      setFakeSignal(null);
      setIsFilled(true);
      timersRef.current.scheduleFrame(roundId, (frameTime) => {
        startTimeRef.current = frameTime;
        updateGameState('zap');

        emitFeedback('go', {
          fakeSignalsEnabled: roundFakeSignalsEnabledRef.current,
          eventId: `${roundId}:go`,
          session: feedbackSessionRef.current,
        });

        timersRef.current.schedule(roundId, () => {
          timersRef.current.scheduleFrame(roundId, () => {
            if (gameStateRef.current !== 'zap') return;
            touchHeldRef.current = false;
            setHasTouchedToStart(false);
            setFailureReason('Timeout — the button was held past the deadline.');
            updateGameState('game-over');
            setIsFilled(false);
            setFakeSignal(null);
            emitFeedback('timeout', { eventId: `${roundId}:timeout`, session: feedbackSessionRef.current });
            recordRound(currentRoundEventIdRef.current, { kind: 'invalid', reason: 'timeout' }, true);
          });
        }, roundDeadlineRef.current);
      });
    }, realSignalDelayMs);
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

    if (isReleaseBeforeRealSignal(stateAtRelease)) {
      timersRef.current.invalidate();
      setFailureReason(
        cancelled ? 'Hold interrupted before GO.' : 'False start — released before GO.'
      );
      updateGameState('game-over');
      setIsFilled(false);
      setFakeSignal(null);
      emitFeedback('false-start', { eventId: `${feedbackSessionRef.current}:false-start`, session: feedbackSessionRef.current });
      recordRound(currentRoundEventIdRef.current, { kind: 'invalid', reason: cancelled ? 'cancelled' : 'false-start' }, true);
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
      setFakeSignal(null);
      emitFeedback('timeout', { eventId: `${feedbackSessionRef.current}:late`, session: feedbackSessionRef.current });
      recordRound(currentRoundEventIdRef.current, { kind: 'invalid', reason: 'late' }, true);
      return;
    }

    timersRef.current.invalidate();
    const transitionId = timersRef.current.beginRound();
    setZapesAvoided((previous) => previous + 1);
    setBestReactionTime((previous) =>
      previous === null ? result.reactionTime : Math.min(previous, result.reactionTime)
    );
    emitFeedback('success', { eventId: `${feedbackSessionRef.current}:success`, session: feedbackSessionRef.current });
    recordRound(currentRoundEventIdRef.current, { kind: 'valid', reactionTimeMs: result.reactionTime }, false);
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
        fakeSignal={fakeSignal}
        visualEffectsEnabled={settings.visualEffectsEnabled}
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
