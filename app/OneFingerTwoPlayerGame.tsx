import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import OneFingerTwoPlayerContent from '../components/OneFingerTwoPlayerContent';
import { createRandomWait, evaluateReaction, isHeldAfterInput } from '../gameplay/core';
import {
  createFakeSignalSchedule,
  isReleaseBeforeRealSignal,
  scheduleFakeSignalEvents,
  type FakeSignalEvent,
} from '../gameplay/fakeSignals';
import {
  applyMatchOutcome,
  areBothPlayersReady,
  createInitialMultiplayerState,
  createSharedSignal,
  getConfiguredMatchWinner,
  recordRoundResult,
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

type GameState = 'idle' | 'waiting' | 'zap' | 'round-result' | 'game-over';

const RESULT_DISPLAY_MS = 1_000;

const playerLabel = (player: Player) => player === 'p1' ? 'Player 1' : 'Player 2';

export default function OneFingerTwoPlayerGameScreen() {
  const router = useRouter();
  const { settings } = useGlobalSettings();
  const initialMatch = createInitialMultiplayerState();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [isFilled, setIsFilled] = useState(false);
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
  const [fakeSignal, setFakeSignal] = useState<FakeSignalEvent | null>(null);

  const timersRef = useRef(new RoundTimerManager());
  const activeRoundIdRef = useRef<number | null>(null);
  const signalTimeRef = useRef<number | null>(null);
  const roundDeadlineRef = useRef(getReactionDeadline(settings.difficulty));
  const matchFormatRef = useRef(settings.matchFormat);
  const touchHeldRef = useRef({ p1: false, p2: false });
  const roundResultsRef = useRef<MultiplayerRoundResults>(initialMatch.results);
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
    touchHeldRef.current = { p1: false, p2: false };
    setHasTouchedToStart({ p1: false, p2: false });
  };

  const replaceRoundResults = (results: MultiplayerRoundResults) => {
    roundResultsRef.current = results;
    setRoundResults(results);
  };

  const resetGame = () => {
    const nextMatch = createInitialMultiplayerState();
    timersRef.current.invalidate();
    activeRoundIdRef.current = null;
    signalTimeRef.current = null;
    roundResolvedRef.current = false;
    resetReadiness();
    replaceRoundResults(nextMatch.results);
    matchFormatRef.current = settings.matchFormat;
    setMatchScore({
      lives: nextMatch.lives,
      roundWins: nextMatch.roundWins,
      roundsPlayed: nextMatch.roundsPlayed,
    });
    setIsFilled(false);
    setRoundWinner('');
    setRoundDetail('');
    setBestReactionTime(null);
    setFakeSignal(null);
    updateGameState('idle');
  };

  const finishRound = (roundId: number) => {
    updateGameState('round-result');
    setIsFilled(false);
    setFakeSignal(null);
    resetReadiness();
    timersRef.current.schedule(roundId, () => {
      if (gameStateRef.current === 'game-over') return;
      activeRoundIdRef.current = null;
      signalTimeRef.current = null;
      roundResolvedRef.current = false;
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
    setFakeSignal(null);
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
    replaceRoundResults({ p1: null, p2: null });
    setRoundWinner('');
    setRoundDetail('');
    setIsFilled(false);
    setFakeSignal(null);
    updateGameState('waiting');

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
      if (!areBothPlayersReady({
        p1: [touchHeldRef.current.p1],
        p2: [touchHeldRef.current.p2],
      })) return;

      setFakeSignal(null);
      setIsFilled(true);
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

  const onPlayerPressIn = (player: Player) => {
    if (gameStateRef.current !== 'idle') return;
    touchHeldRef.current[player] = isHeldAfterInput('press');
    setHasTouchedToStart((previous) => ({ ...previous, [player]: true }));

    if (areBothPlayersReady({
      p1: [touchHeldRef.current.p1],
      p2: [touchHeldRef.current.p2],
    })) {
      beginWaitingForZap();
    }
  };

  const onPlayerPressOut = (player: Player, releaseTime: number, cancelled: boolean) => {
    const stateAtRelease = gameStateRef.current;
    touchHeldRef.current[player] = isHeldAfterInput(cancelled ? 'cancel' : 'release');
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
      <OneFingerTwoPlayerContent
        isFilled={isFilled}
        lives={matchScore.lives}
        roundWins={matchScore.roundWins}
        matchFormat={matchFormatRef.current}
        onPlayerPressIn={onPlayerPressIn}
        onPlayerPressOut={onPlayerPressOut}
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
