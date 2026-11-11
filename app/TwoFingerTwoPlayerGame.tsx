import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import TwoFingerTwoPlayerContent from '../components/TwoFingerTwoPlayerContent';
import { createRandomWait, evaluateReaction, isCorrectTarget, isHeldAfterInput } from '../gameplay/core';
import {
  applyRoundOutcome,
  areBothPlayersReady,
  createInitialMultiplayerState,
  createSharedSignal,
  getMatchWinner,
  recordRoundResult,
  selectIndependentTargets,
  settleCompletedRound,
  settleSingleFailure,
  type MultiplayerRoundOutcome,
  type MultiplayerRoundResults,
  type Player,
  type RoundFailureReason,
} from '../gameplay/multiplayer';
import { RoundTimerManager } from '../gameplay/RoundTimerManager';
import { useGlobalSettings } from './GlobalSettings';

type BoxIndex = 0 | 1;
type GameState = 'idle' | 'waiting' | 'zap' | 'round-result' | 'game-over';

const REACTION_DEADLINE_MS = 500;
const RESULT_DISPLAY_MS = 1_000;

const playerLabel = (player: Player) => player === 'p1' ? 'Player 1' : 'Player 2';

export default function TwoFingerTwoPlayerGameScreen() {
  const router = useRouter();
  const { settings } = useGlobalSettings();
  const initialMatch = createInitialMultiplayerState();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [targets, setTargets] = useState<{ p1: BoxIndex | null; p2: BoxIndex | null }>({ p1: null, p2: null });
  const [roundResults, setRoundResults] = useState(initialMatch.results);
  const [lives, setLives] = useState(initialMatch.lives);
  const [roundWinner, setRoundWinner] = useState('');
  const [roundDetail, setRoundDetail] = useState('');
  const [bestReactionTime, setBestReactionTime] = useState<number | null>(null);
  const [hasTouchedToStart, setHasTouchedToStart] = useState({ p1: false, p2: false });

  const timersRef = useRef(new RoundTimerManager());
  const activeRoundIdRef = useRef<number | null>(null);
  const signalTimeRef = useRef<number | null>(null);
  const targetsRef = useRef<{ p1: BoxIndex | null; p2: BoxIndex | null }>({ p1: null, p2: null });
  const roundResultsRef = useRef<MultiplayerRoundResults>(initialMatch.results);
  const touchHeldRef = useRef<{ p1: [boolean, boolean]; p2: [boolean, boolean] }>({
    p1: [false, false], p2: [false, false],
  });
  const gameStateRef = useRef<GameState>('idle');
  const roundResolvedRef = useRef(false);

  useEffect(() => () => timersRef.current.invalidate(), []);

  useEffect(() => {
    const winner = getMatchWinner(lives);
    if (winner === null) return;
    timersRef.current.invalidate();
    activeRoundIdRef.current = null;
    setRoundWinner(winner === 'draw' ? 'Draw' : playerLabel(winner));
    setRoundDetail('MATCH COMPLETE');
    updateGameState('game-over');
  }, [lives]);

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
    setLives(nextMatch.lives);
    setRoundWinner('');
    setRoundDetail('');
    setBestReactionTime(null);
    updateGameState('idle');
  };

  const finishRound = (roundId: number) => {
    updateGameState('round-result');
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
    setLives((previous) => applyRoundOutcome(previous, outcome));
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
    roundResolvedRef.current = false;
    signalTimeRef.current = null;
    replaceTargets({ p1: null, p2: null });
    replaceRoundResults({ p1: null, p2: null });
    setRoundWinner('');
    setRoundDetail('');
    updateGameState('waiting');

    timersRef.current.schedule(roundId, () => {
      if (!areBothPlayersReady(touchHeldRef.current)) return;

      replaceTargets(selectIndependentTargets());
      timersRef.current.scheduleFrame(roundId, (frameTime) => {
        const signal = createSharedSignal(frameTime);
        signalTimeRef.current = signal.signalTime;
        updateGameState('zap');

        if (settings.vibrationEnabled) {
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
        }, REACTION_DEADLINE_MS);
      });
    }, createRandomWait());
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

    if (stateAtRelease === 'waiting') {
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
      REACTION_DEADLINE_MS
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
        lives={lives}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
});
