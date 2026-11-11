import { compareReactionTimes } from './core';

export type Player = 'p1' | 'p2';
export type RoundFailureReason =
  | 'false-start'
  | 'timeout'
  | 'wrong-finger'
  | 'cancelled'
  | 'late';

export type PlayerRoundResult =
  | { kind: 'valid'; reactionTime: number }
  | { kind: 'invalid'; reason: RoundFailureReason; reactionTime?: number };

export type MultiplayerRoundResults = {
  p1: PlayerRoundResult | null;
  p2: PlayerRoundResult | null;
};

export type MultiplayerRoundOutcome = {
  winner: Player | 'draw';
  losers: Player[];
  reason: 'faster-reaction' | 'equal-reaction' | 'single-failure' | 'both-failed';
};

export type MultiplayerLives = { p1: number; p2: number };
export type MatchWinner = Player | 'draw' | null;

export const EMPTY_ROUND_RESULTS: MultiplayerRoundResults = { p1: null, p2: null };
export const INITIAL_MULTIPLAYER_LIVES: MultiplayerLives = { p1: 3, p2: 3 };

export function createInitialMultiplayerState() {
  return {
    lives: { ...INITIAL_MULTIPLAYER_LIVES },
    results: { ...EMPTY_ROUND_RESULTS },
  };
}

export function areBothPlayersReady(
  holds: { p1: readonly boolean[]; p2: readonly boolean[] }
) {
  return holds.p1.length > 0 && holds.p2.length > 0 &&
    holds.p1.every(Boolean) && holds.p2.every(Boolean);
}

export function createSharedSignal(signalTime: number) {
  return { signalTime } as const;
}

export function selectIndependentTargets(random: () => number = Math.random) {
  return {
    p1: (random() < 0.5 ? 0 : 1) as 0 | 1,
    p2: (random() < 0.5 ? 0 : 1) as 0 | 1,
  };
}

export function recordRoundResult(
  current: MultiplayerRoundResults,
  player: Player,
  result: PlayerRoundResult
) {
  if (current[player] !== null) return current;
  return { ...current, [player]: result };
}

export function settleCompletedRound(
  results: MultiplayerRoundResults
): MultiplayerRoundOutcome | null {
  const { p1, p2 } = results;
  if (p1 === null || p2 === null) return null;

  if (p1.kind === 'valid' && p2.kind === 'valid') {
    const comparison = compareReactionTimes(p1.reactionTime, p2.reactionTime);
    if (comparison === 'draw') {
      return { winner: 'draw', losers: [], reason: 'equal-reaction' };
    }
    if (comparison === 'first') {
      return { winner: 'p1', losers: ['p2'], reason: 'faster-reaction' };
    }
    return { winner: 'p2', losers: ['p1'], reason: 'faster-reaction' };
  }

  if (p1.kind === 'valid') {
    return { winner: 'p1', losers: ['p2'], reason: 'single-failure' };
  }
  if (p2.kind === 'valid') {
    return { winner: 'p2', losers: ['p1'], reason: 'single-failure' };
  }
  return { winner: 'draw', losers: ['p1', 'p2'], reason: 'both-failed' };
}

export function settleSingleFailure(player: Player): MultiplayerRoundOutcome {
  return {
    winner: player === 'p1' ? 'p2' : 'p1',
    losers: [player],
    reason: 'single-failure',
  };
}

export function applyRoundOutcome(
  lives: MultiplayerLives,
  outcome: MultiplayerRoundOutcome
): MultiplayerLives {
  return outcome.losers.reduce<MultiplayerLives>(
    (next, player) => ({ ...next, [player]: Math.max(0, next[player] - 1) }),
    lives
  );
}

export function getMatchWinner(lives: MultiplayerLives): MatchWinner {
  if (lives.p1 <= 0 && lives.p2 <= 0) return 'draw';
  if (lives.p1 <= 0) return 'p2';
  if (lives.p2 <= 0) return 'p1';
  return null;
}

export function formatPlayerRoundResult(result: PlayerRoundResult | null) {
  if (result === null) return 'NO RELEASE NEEDED';
  if (result.kind === 'valid') return `${result.reactionTime.toFixed(2)} ms`;

  const labels: Record<RoundFailureReason, string> = {
    'false-start': 'FALSE START',
    timeout: 'TIMEOUT',
    'wrong-finger': 'WRONG FINGER',
    cancelled: 'HOLD INTERRUPTED',
    late: 'TOO SLOW',
  };
  return labels[result.reason];
}
