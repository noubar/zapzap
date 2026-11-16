import type { MatchFormat } from '../settings/gameSettings';
import type { PlayerRoundResult } from './multiplayer';

export type GeneralPlayerId = `p${number}`;
export type GeneralMultiplayerPhase = 'idle' | 'waiting' | 'go' | 'result' | 'finished';

export interface GeneralPlayerState {
  id: GeneralPlayerId;
  number: number;
  isHolding: boolean;
  isActive: boolean;
  isEliminated: boolean;
  reactionTimeMs: number | null;
  lives: number;
  roundWins: number;
  roundResult: PlayerRoundResult | null;
}

export interface GeneralMultiplayerSession {
  players: GeneralPlayerState[];
  roundId: number;
  roundsPlayed: number;
  phase: GeneralMultiplayerPhase;
  signalTimestamp: number | null;
  matchFormat: MatchFormat;
}

export interface RoundPlacement {
  rank: number;
  playerIds: GeneralPlayerId[];
  reactionTimeMs: number;
}

export interface GeneralRoundOutcome {
  placements: RoundPlacement[];
  winnerIds: GeneralPlayerId[];
  penalizedIds: GeneralPlayerId[];
  invalidIds: GeneralPlayerId[];
  matchWinnerIds: GeneralPlayerId[];
  isRoundDraw: boolean;
  isMatchComplete: boolean;
  isMatchDraw: boolean;
}

export const MIN_GENERAL_PLAYERS = 2;
export const MAX_ENGINE_PLAYERS = 8;

function assertPlayerCount(playerCount: number) {
  if (!Number.isInteger(playerCount) || playerCount < MIN_GENERAL_PLAYERS || playerCount > MAX_ENGINE_PLAYERS) {
    throw new RangeError(`Player count must be an integer from ${MIN_GENERAL_PLAYERS} to ${MAX_ENGINE_PLAYERS}.`);
  }
}

export function createGeneralMultiplayerSession(
  playerCount: number,
  matchFormat: MatchFormat
): GeneralMultiplayerSession {
  assertPlayerCount(playerCount);
  return {
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: `p${index + 1}` as GeneralPlayerId,
      number: index + 1,
      isHolding: false,
      isActive: true,
      isEliminated: false,
      reactionTimeMs: null,
      lives: 3,
      roundWins: 0,
      roundResult: null,
    })),
    roundId: 0,
    roundsPlayed: 0,
    phase: 'idle',
    signalTimestamp: null,
    matchFormat,
  };
}

export function getGeneralPlayer(
  session: GeneralMultiplayerSession,
  playerId: GeneralPlayerId
) {
  return session.players.find((player) => player.id === playerId) ?? null;
}

export function setGeneralPlayerHolding(
  session: GeneralMultiplayerSession,
  playerId: GeneralPlayerId,
  isHolding: boolean
): GeneralMultiplayerSession {
  const player = getGeneralPlayer(session, playerId);
  if (!player || !player.isActive || player.roundResult !== null) return session;
  if (player.isHolding === isHolding) return session;
  return {
    ...session,
    players: session.players.map((candidate) =>
      candidate.id === playerId ? { ...candidate, isHolding } : candidate
    ),
  };
}

export function areGeneralPlayersReady(session: GeneralMultiplayerSession) {
  const eligible = session.players.filter(
    (player) => player.isActive && player.roundResult === null
  );
  return eligible.length > 0 && eligible.every((player) => player.isHolding);
}

export function beginGeneralRound(
  session: GeneralMultiplayerSession,
  roundId: number
): GeneralMultiplayerSession {
  if (session.phase !== 'idle' || !areGeneralPlayersReady(session)) return session;
  return { ...session, roundId, phase: 'waiting', signalTimestamp: null };
}

export function startGeneralSignal(
  session: GeneralMultiplayerSession,
  signalTimestamp: number
): GeneralMultiplayerSession {
  if (session.phase !== 'waiting' || !Number.isFinite(signalTimestamp)) return session;
  return { ...session, phase: 'go', signalTimestamp };
}

export function recordGeneralRoundResult(
  session: GeneralMultiplayerSession,
  playerId: GeneralPlayerId,
  result: PlayerRoundResult
): GeneralMultiplayerSession {
  const player = getGeneralPlayer(session, playerId);
  if (
    !player || !player.isActive || player.roundResult !== null ||
    (session.phase !== 'waiting' && session.phase !== 'go')
  ) return session;

  return {
    ...session,
    players: session.players.map((candidate) =>
      candidate.id === playerId
        ? {
            ...candidate,
            isHolding: false,
            reactionTimeMs: result.kind === 'valid' ? result.reactionTime : null,
            roundResult: result,
          }
        : candidate
    ),
  };
}

export function fillGeneralTimeouts(session: GeneralMultiplayerSession) {
  if (session.phase !== 'go') return session;
  return {
    ...session,
    players: session.players.map((player) =>
      player.isActive && player.roundResult === null
        ? {
            ...player,
            isHolding: false,
            reactionTimeMs: null,
            roundResult: { kind: 'invalid', reason: 'timeout' } as const,
          }
        : player
    ),
  };
}

export function isGeneralRoundComplete(session: GeneralMultiplayerSession) {
  return session.players
    .filter((player) => player.isActive)
    .every((player) => player.roundResult !== null);
}

export function rankGeneralRound(players: readonly GeneralPlayerState[]) {
  const validPlayers = players
    .filter((player) => player.isActive && player.roundResult?.kind === 'valid')
    .sort((first, second) =>
      (first.reactionTimeMs ?? Number.POSITIVE_INFINITY) -
      (second.reactionTimeMs ?? Number.POSITIVE_INFINITY)
    );

  const placements: RoundPlacement[] = [];
  validPlayers.forEach((player) => {
    const reactionTimeMs = player.reactionTimeMs as number;
    const previous = placements.at(-1);
    if (previous && previous.reactionTimeMs === reactionTimeMs) {
      previous.playerIds.push(player.id);
      return;
    }
    placements.push({ rank: placements.length + 1, playerIds: [player.id], reactionTimeMs });
  });
  return placements;
}

function winsRequired(matchFormat: MatchFormat) {
  if (matchFormat === 'single-round') return 1;
  if (matchFormat === 'best-of-three') return 2;
  if (matchFormat === 'best-of-five') return 3;
  if (matchFormat === 'best-of-seven') return 4;
  return null;
}

export function settleGeneralRound(
  session: GeneralMultiplayerSession
): { session: GeneralMultiplayerSession; outcome: GeneralRoundOutcome } | null {
  if (!isGeneralRoundComplete(session) || (session.phase !== 'waiting' && session.phase !== 'go')) {
    return null;
  }

  const activePlayers = session.players.filter((player) => player.isActive);
  const placements = rankGeneralRound(activePlayers);
  const invalidIds = activePlayers
    .filter((player) => player.roundResult?.kind === 'invalid')
    .map((player) => player.id);
  const fastestIds = placements[0]?.playerIds ?? [];
  let penalizedIds: GeneralPlayerId[] = [];
  let roundWinnerIds: GeneralPlayerId[] = [];

  if (session.matchFormat === 'three-lives') {
    penalizedIds = invalidIds.length > 0
      ? invalidIds
      : placements.at(-1)?.playerIds ?? [];
    if (activePlayers.length === 2 && invalidIds.length === 0 && placements.length === 1) {
      penalizedIds = [];
    }
    roundWinnerIds = fastestIds;
  } else if (fastestIds.length === 1) {
    roundWinnerIds = fastestIds;
  }

  let players = session.players.map((player) => {
    const losesLife = session.matchFormat === 'three-lives' && penalizedIds.includes(player.id);
    const gainsWin = session.matchFormat !== 'three-lives' && roundWinnerIds.includes(player.id);
    const lives = losesLife ? Math.max(0, player.lives - 1) : player.lives;
    const isEliminated = session.matchFormat === 'three-lives' && lives === 0;
    return {
      ...player,
      lives,
      roundWins: gainsWin ? player.roundWins + 1 : player.roundWins,
      isEliminated,
      isActive: !isEliminated,
      isHolding: false,
    };
  });

  const roundsPlayed = session.roundsPlayed + 1;
  let isMatchComplete = false;
  let matchWinnerIds: GeneralPlayerId[] = [];

  if (session.matchFormat === 'three-lives') {
    const survivors = players.filter((player) => player.isActive);
    isMatchComplete = survivors.length <= 1;
    matchWinnerIds = survivors.map((player) => player.id);
  } else if (session.matchFormat === 'single-round') {
    isMatchComplete = true;
    matchWinnerIds = roundWinnerIds;
  } else {
    const target = winsRequired(session.matchFormat) as number;
    matchWinnerIds = players
      .filter((player) => player.roundWins >= target)
      .map((player) => player.id);
    isMatchComplete = matchWinnerIds.length > 0;
  }

  const isMatchDraw = isMatchComplete && matchWinnerIds.length !== 1;
  const nextSession: GeneralMultiplayerSession = {
    ...session,
    players,
    roundsPlayed,
    phase: isMatchComplete ? 'finished' : 'result',
  };
  return {
    session: nextSession,
    outcome: {
      placements,
      winnerIds: roundWinnerIds,
      penalizedIds,
      invalidIds,
      matchWinnerIds,
      isRoundDraw: roundWinnerIds.length !== 1,
      isMatchComplete,
      isMatchDraw,
    },
  };
}

export function prepareNextGeneralRound(
  session: GeneralMultiplayerSession
): GeneralMultiplayerSession {
  if (session.phase !== 'result') return session;
  return {
    ...session,
    phase: 'idle',
    signalTimestamp: null,
    players: session.players.map((player) => ({
      ...player,
      isHolding: false,
      reactionTimeMs: null,
      roundResult: null,
    })),
  };
}

export function cancelGeneralRound(
  session: GeneralMultiplayerSession
): GeneralMultiplayerSession {
  if (session.phase === 'finished') return session;
  return {
    ...session,
    phase: 'idle',
    signalTimestamp: null,
    players: session.players.map((player) => ({
      ...player,
      isHolding: false,
      reactionTimeMs: null,
      roundResult: null,
    })),
  };
}

export function resetGeneralMultiplayerSession(session: GeneralMultiplayerSession) {
  return createGeneralMultiplayerSession(session.players.length, session.matchFormat);
}
