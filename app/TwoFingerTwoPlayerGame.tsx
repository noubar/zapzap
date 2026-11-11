import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import TwoFingerTwoPlayerContent from '../components/TwoFingerTwoPlayerContent';
import { createRandomWait, evaluateReaction, isCorrectTarget, isHeldAfterInput } from '../gameplay/core';
import {
  createFakeSignalSchedule,
  isReleaseBeforeRealSignal,
  scheduleFakeSignalEvents,
  selectFakeTarget,
  type FakeSignalEvent,
} from '../gameplay/fakeSignals';
import {
  applyMatchOutcome,
  areBothPlayersReady,
  createInitialMultiplayerState,
  createSharedSignal,
  getConfiguredMatchWinner,
  recordRoundResult,
  selectIndependentTargets,
  settleCompletedRound,
  settleSingleFailure,
  type MultiplayerRoundOutcome,
  type MultiplayerRoundResults,
  type MultiplayerMatchScore,
  type Player,
  type RoundFailureReason,
} from '../gameplay/multiplayer';
import { RoundTimerManager } from '../gameplay/RoundTimerManager';
import { getReactionDeadline } from '../settings/gameSettings';
import { useGlobalSettings } from './GlobalSettings';

type BoxIndex = 0 | 1;
type MultiplayerFakeSignal = FakeSignalEvent & {
  targets: { p1: BoxIndex; p2: BoxIndex };
};
type GameState = 'idle' | 'waiting' | 'zap' | 'round-result' | 'game-over';

const RESULT_DISPLAY_MS = 1_000;

const playerLabel = (player: Player) => player === 'p1' ? 'Player 1' : 'Player 2';

export default function TwoFingerTwoPlayerGameScreen() {
  const router = useRouter();
  const { settings } = useGlobalSettings();
  const initialMatch = createInitialMultiplayerState();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [targets, setTargets] = useState<{ p1: BoxIndex | null; p2: BoxIndex | null }>({ p1: null, p2: null });
  const [roundResults, setRoundResults] = useState(initialMatch.results);
  const [matchScore, setMatchScore] = useState<MultiplayerMatchScore>({
    lives: initialMatch.lives,
    roundWins: initialMatch.roundWins,
    roundsPlayed: initialMatch.roundsPlayed,
  });
  const [roundWinner, setRoundWinner] = useState('');
  const [roundDetail, setRoundDetail] = useState('');
  const [bestReactionTime, setBestReactionTime] = useState<number | null>(null);
  const [hasTouchedToStart, setHasTouchedToStart] = useState({ p1: false, p2: false });
  const [fakeSignal, setFakeSignal] = useState<MultiplayerFakeSignal | null>(null);

  const timersRef = useRef(new RoundTimerManager());
  const activeRoundIdRef = useRef<number | null>(null);
  const signalTimeRef = useRef<number | null>(null);
  const roundDeadlineRef = useRef(getReactionDeadline(settings.difficulty));
  const matchFormatRef = useRef(settings.matchFormat);
  const targetsRef = useRef<{ p1: BoxIndex | null; p2: BoxIndex | null }>({ p1: null, p2: null });
  const roundResultsRef = useRef<MultiplayerRoundResults>(initialMatch.results);
  const touchHeldRef = useRef<{ p1: [boolean, boolean]; p2: [boolean, boolean] }>({
    p1: [false, false], p2: [false, false],
  });
  const gameStateRef = useRef<GameState>('idle');
  const roundResolvedRef = useRef(false);
  const roundFakeSignalsEnabledRef = useRef(false);

  useEffect(() => () => timersRef.current.invalidate(), []);

  useEffect(() => {
    const winner = getConfiguredMatchWinner(matchScore, matchFormatRef.current);
    if (winner === null) return;
    timersRef.current.invalidate();
    activeRoundIdRef.current = null;
    setRoundWinner(winner === 'draw' ? 'Draw' : playerLabel(winner));
    setRoundDetail('MATCH COMPLETE');
    updateGameState('game-over');
  }, [matchScore]);

  const updateGameState = (nextState: GameState) => {
    gameStateRef.current = nextState;
    setGameState(nextState);
  };

  const resetReadiness = () => {
    touchHeldRef.current = { p1: [false, false], p2: [false, false] };
    setHasTouchedToStart({ p1: false, p2: false });
  };

  const replaceRoundResults = (results: MultiplayerRoundResults) => {
    roundResultsRef.current = results;
    setRoundResults(results);
  };

  const replaceTargets = (nextTargets: { p1: BoxIndex | null; p2: BoxIndex | null }) => {
    targetsRef.current = nextTargets;
    setTargets(nextTargets);
  };

  const resetGame = () => {
    const nextMatch = createInitialMultiplayerState();
    timersRef.current.invalidate();
    activeRoundIdRef.current = null;
    signalTimeRef.current = null;
    roundResolvedRef.current = false;
    resetReadiness();
    replaceTargets({ p1: null, p2: null });
    replaceRoundResults(nextMatch.results);
    matchFormatRef.current = settings.matchFormat;
    setMatchScore({
      lives: nextMatch.lives,
      roundWins: nextMatch.roundWins,
      roundsPlayed: nextMatch.roundsPlayed,
    });
    setRoundWinner('');
    setRoundDetail('');
    setBestReactionTime(null);
    setFakeSignal(null);
    updateGameState('idle');
  };

  const finishRound = (roundId: number) => {
    updateGameState('round-result');
    setFakeSignal(null);
    resetReadiness();
    timersRef.current.schedule(roundId, () => {
      if (gameStateRef.current === 'game-over') return;
      activeRoundIdRef.current = null;
      signalTimeRef.current = null;
      roundResolvedRef.current = false;
      replaceTargets({ p1: null, p2: null });
      replaceRoundResults({ p1: null, p2: null });
      setRoundWinner('');
      setRoundDetail('');
      updateGameState('idle');
    }, RESULT_DISPLAY_MS);
  };

  const settleOutcome = (roundId: number, outcome: MultiplayerRoundOutcome) => {
    if (roundResolvedRef.current || !timersRef.current.isCurrent(roundId)) return;
    roundResolvedRef.current = true;
    setMatchScore((previous) => applyMatchOutcome(previous, matchFormatRef.current, outcome));
    setRoundWinner(outcome.winner === 'draw' ? 'Draw' : playerLabel(outcome.winner));
    setRoundDetail({
      'faster-reaction': 'FASTER REACTION',
      'equal-reaction': 'TIED REACTION',
      'single-failure': 'ROUND FORFEIT',
      'both-failed': 'BOTH PLAYERS FAILED',
    }[outcome.reason]);
    finishRound(roundId);
  };

  const recordValidReaction = (player: Player, reactionTime: number) => {
    const results = recordRoundResult(
      roundResultsRef.current,
      player,
      { kind: 'valid', reactionTime }
    );
    replaceRoundResults(results);
    setBestReactionTime((previous) =>
      previous === null ? reactionTime : Math.min(previous, reactionTime)
    );
    return results;
  };

  const recordFailureAndSettle = (player: Player, reason: RoundFailureReason) => {
    const results = recordRoundResult(
      roundResultsRef.current,
      player,
      { kind: 'invalid', reason }
    );
    if (results === roundResultsRef.current) return;
    replaceRoundResults(results);
    setFakeSignal(null);

    const settlementId = timersRef.current.beginRound();
    activeRoundIdRef.current = settlementId;
    timersRef.current.scheduleFrame(settlementId, () => {
      const completedOutcome = settleCompletedRound(roundResultsRef.current);
      settleOutcome(settlementId, completedOutcome ?? settleSingleFailure(player));
    });
  };

  const beginWaitingForZap = () => {
    const roundId = timersRef.current.beginRound();
    activeRoundIdRef.current = roundId;
    roundDeadlineRef.current = getReactionDeadline(settings.difficulty);
    roundFakeSignalsEnabledRef.current = settings.fakeSignalsEnabled;
    roundResolvedRef.current = false;
    signalTimeRef.current = null;
    replaceTargets({ p1: null, p2: null });
    replaceRoundResults({ p1: null, p2: null });
    setRoundWinner('');
    setRoundDetail('');
    setFakeSignal(null);
    updateGameState('waiting');

    const realSignalDelayMs = createRandomWait();
    if (roundFakeSignalsEnabledRef.current) {
      const schedule = createFakeSignalSchedule(realSignalDelayMs);
      const fakeEvents: MultiplayerFakeSignal[] = schedule.events.map((event) => ({
        ...event,
        targets: {
          p1: selectFakeTarget<BoxIndex>(0, 1),
          p2: selectFakeTarget<BoxIndex>(0, 1),
        },
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
      if (!areBothPlayersReady(touchHeldRef.current)) return;

      setFakeSignal(null);
      replaceTargets(selectIndependentTargets());
      timersRef.current.scheduleFrame(roundId, (frameTime) => {
        const signal = createSharedSignal(frameTime);
        signalTimeRef.current = signal.signalTime;
        updateGameState('zap');

        if (settings.hapticsEnabled && !roundFakeSignalsEnabledRef.current) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }

        timersRef.current.schedule(roundId, () => {
          timersRef.current.scheduleFrame(roundId, () => {
            if (gameStateRef.current !== 'zap' || roundResolvedRef.current) return;
            let results = roundResultsRef.current;
            if (results.p1 === null) {
              results = recordRoundResult(results, 'p1', { kind: 'invalid', reason: 'timeout' });
            }
            if (results.p2 === null) {
              results = recordRoundResult(results, 'p2', { kind: 'invalid', reason: 'timeout' });
            }
            replaceRoundResults(results);
            const outcome = settleCompletedRound(results);
            if (outcome) settleOutcome(roundId, outcome);
          });
        }, roundDeadlineRef.current);
      });
    }, realSignalDelayMs);
  };

  const onBoxPressIn = (player: Player, index: BoxIndex) => {
    if (gameStateRef.current !== 'idle') return;
    touchHeldRef.current[player][index] = isHeldAfterInput('press');
    const playerReady = touchHeldRef.current[player].every(Boolean);
    setHasTouchedToStart((previous) => ({ ...previous, [player]: playerReady }));
    if (areBothPlayersReady(touchHeldRef.current)) beginWaitingForZap();
  };

  const onBoxPressOut = (
    player: Player,
    index: BoxIndex,
    releaseTime: number,
    cancelled: boolean
  ) => {
    const stateAtRelease = gameStateRef.current;
    touchHeldRef.current[player][index] = isHeldAfterInput(cancelled ? 'cancel' : 'release');
    setHasTouchedToStart((previous) => ({ ...previous, [player]: false }));

    if (stateAtRelease === 'idle' || stateAtRelease === 'round-result' || stateAtRelease === 'game-over') return;
    if (roundResultsRef.current[player] !== null) return;

    if (isReleaseBeforeRealSignal(stateAtRelease)) {
      recordFailureAndSettle(player, cancelled ? 'cancelled' : 'false-start');
      return;
    }

    if (stateAtRelease !== 'zap' || signalTimeRef.current === null) return;
    if (cancelled) {
      recordFailureAndSettle(player, 'cancelled');
      return;
    }

    const target = targetsRef.current[player];
    if (target === null || !isCorrectTarget(target, index)) {
      recordFailureAndSettle(player, 'wrong-finger');
      return;
    }

    const evaluation = evaluateReaction(
      signalTimeRef.current,
      releaseTime,
      roundDeadlineRef.current
    );
    if (evaluation.kind !== 'valid') {
      recordFailureAndSettle(player, evaluation.kind === 'false-start' ? 'false-start' : 'late');
      return;
    }

    const results = recordValidReaction(player, evaluation.reactionTime);
    const outcome = settleCompletedRound(results);
    const roundId = activeRoundIdRef.current;
    if (outcome && roundId !== null) settleOutcome(roundId, outcome);
  };

  return (
    <View style={styles.container}>
      <TwoFingerTwoPlayerContent
        targets={targets}
        lives={matchScore.lives}
        roundWins={matchScore.roundWins}
        matchFormat={matchFormatRef.current}
        onBoxPressIn={onBoxPressIn}
        onBoxPressOut={onBoxPressOut}
        roundWinner={roundWinner}
        roundDetail={roundDetail}
        gameState={gameState}
        roundResults={roundResults}
        bestReactionTime={bestReactionTime}
        resetGame={resetGame}
        router={router}
        hasTouchedToStart={hasTouchedToStart}
        fakeSignal={fakeSignal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
});
