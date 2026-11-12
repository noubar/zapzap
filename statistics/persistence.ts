import { ACHIEVEMENTS } from './achievements';
import { createEmptyStatistics, createReactionAggregate } from './statisticsEngine';
import type {
  MultiplayerPositionStatistics,
  ReactionAggregate,
  SinglePlayerStatistics,
  StatisticsState,
} from './types';

export const STATISTICS_STORAGE_KEY = 'zapzap.statistics';
export const STATISTICS_VERSION = 1;

export type StatisticsStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

const numberOrZero = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
const integerOrZero = (value: unknown) => Math.floor(numberOrZero(value));
const stringOrNull = (value: unknown) => typeof value === 'string' ? value : null;

function normalizeReaction(value: unknown): ReactionAggregate {
  const fallback = createReactionAggregate();
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Record<string, unknown>;
  const fastest = source.fastestReactionMs;
  return {
    roundsAttempted: integerOrZero(source.roundsAttempted),
    successfulReactions: integerOrZero(source.successfulReactions),
    failedReactions: integerOrZero(source.failedReactions),
    validReactionCount: integerOrZero(source.validReactionCount),
    reactionTimeTotalMs: numberOrZero(source.reactionTimeTotalMs),
    fastestReactionMs: typeof fastest === 'number' && Number.isFinite(fastest) && fastest >= 0 ? fastest : null,
    falseStarts: integerOrZero(source.falseStarts),
    timeouts: integerOrZero(source.timeouts),
    wrongFingerFailures: integerOrZero(source.wrongFingerFailures),
    lastPlayedAt: stringOrNull(source.lastPlayedAt),
  };
}

function normalizeSingle(value: unknown): SinglePlayerStatistics {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    gamesStarted: integerOrZero(source.gamesStarted),
    gamesCompleted: integerOrZero(source.gamesCompleted),
    zapsAvoided: integerOrZero(source.zapsAvoided),
    currentStreak: integerOrZero(source.currentStreak),
    longestStreak: integerOrZero(source.longestStreak),
    reactions: normalizeReaction(source.reactions),
  };
}

function normalizePosition(value: unknown): MultiplayerPositionStatistics {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    matchesPlayed: integerOrZero(source.matchesPlayed),
    matchesWon: integerOrZero(source.matchesWon),
    matchesLost: integerOrZero(source.matchesLost),
    matchesDrawn: integerOrZero(source.matchesDrawn),
    roundsPlayed: integerOrZero(source.roundsPlayed),
    roundsWon: integerOrZero(source.roundsWon),
    roundsLost: integerOrZero(source.roundsLost),
    roundsDrawn: integerOrZero(source.roundsDrawn),
    reactions: normalizeReaction(source.reactions),
  };
}

export function normalizeStatistics(value: unknown): StatisticsState {
  const empty = createEmptyStatistics();
  if (!value || typeof value !== 'object') return empty;
  const source = value as Record<string, unknown>;
  const single = source.singlePlayer && typeof source.singlePlayer === 'object'
    ? source.singlePlayer as Record<string, unknown> : {};
  const multiplayer = source.multiplayer && typeof source.multiplayer === 'object'
    ? source.multiplayer as Record<string, unknown> : {};
  const oneMulti = multiplayer['one-finger-multiplayer'] && typeof multiplayer['one-finger-multiplayer'] === 'object'
    ? multiplayer['one-finger-multiplayer'] as Record<string, unknown> : {};
  const twoMulti = multiplayer['two-finger-multiplayer'] && typeof multiplayer['two-finger-multiplayer'] === 'object'
    ? multiplayer['two-finger-multiplayer'] as Record<string, unknown> : {};
  const configs = source.configurations && typeof source.configurations === 'object'
    ? source.configurations as Record<string, unknown> : {};
  const achievementSource = source.achievements && typeof source.achievements === 'object'
    ? source.achievements as Record<string, unknown> : {};
  const validAchievementIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));

  return {
    overall: normalizeReaction(source.overall),
    configurations: Object.fromEntries(
      Object.entries(configs).slice(0, 128).map(([key, aggregate]) => [key, normalizeReaction(aggregate)])
    ),
    singlePlayer: {
      'one-finger-single': normalizeSingle(single['one-finger-single']),
      'two-finger-single': normalizeSingle(single['two-finger-single']),
    },
    multiplayer: {
      'one-finger-multiplayer': { p1: normalizePosition(oneMulti.p1), p2: normalizePosition(oneMulti.p2) },
      'two-finger-multiplayer': { p1: normalizePosition(twoMulti.p1), p2: normalizePosition(twoMulti.p2) },
    },
    multiplayerMatchFormats: Object.fromEntries(
      Object.entries(
        source.multiplayerMatchFormats && typeof source.multiplayerMatchFormats === 'object'
          ? source.multiplayerMatchFormats as Record<string, unknown>
          : {}
      ).slice(0, 16).map(([key, value]) => {
        const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
        return [key, {
          matchesPlayed: integerOrZero(item.matchesPlayed),
          player1Wins: integerOrZero(item.player1Wins),
          player2Wins: integerOrZero(item.player2Wins),
          draws: integerOrZero(item.draws),
        }];
      })
    ),
    achievements: Object.fromEntries(
      Object.entries(achievementSource).flatMap(([id, unlock]) => {
        if (!validAchievementIds.has(id) || !unlock || typeof unlock !== 'object') return [];
        const unlockedAt = stringOrNull((unlock as Record<string, unknown>).unlockedAt);
        return unlockedAt ? [[id, { unlockedAt }]] : [];
      })
    ),
    successfulFakeSignalReactions: integerOrZero(source.successfulFakeSignalReactions),
    successfulTwoFingerReactions: integerOrZero(source.successfulTwoFingerReactions),
    processedEventIds: Array.isArray(source.processedEventIds)
      ? source.processedEventIds.filter((id): id is string => typeof id === 'string').slice(-512)
      : [],
  };
}

export function serializeStatistics(statistics: StatisticsState) {
  return JSON.stringify({ version: STATISTICS_VERSION, statistics: normalizeStatistics(statistics) });
}

export function deserializeStatistics(raw: string | null) {
  if (raw === null) return { statistics: createEmptyStatistics(), needsWrite: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { statistics: createEmptyStatistics(), needsWrite: true };
    const document = parsed as Record<string, unknown>;
    const source = document.statistics ?? document;
    const statistics = normalizeStatistics(source);
    return {
      statistics,
      needsWrite: document.version !== STATISTICS_VERSION || raw !== serializeStatistics(statistics),
    };
  } catch {
    return { statistics: createEmptyStatistics(), needsWrite: true };
  }
}

export async function hydrateStatistics(storage: StatisticsStorage) {
  const raw = await storage.getItem(STATISTICS_STORAGE_KEY);
  const loaded = deserializeStatistics(raw);
  const canonical = serializeStatistics(loaded.statistics);
  if (loaded.needsWrite) await storage.setItem(STATISTICS_STORAGE_KEY, canonical);
  return { statistics: loaded.statistics, canonical };
}

export class StatisticsWriteQueue {
  private tail: Promise<void> = Promise.resolve();
  private lastCanonical: string | null;

  constructor(private readonly storage: StatisticsStorage, initialCanonical: string | null = null) {
    this.lastCanonical = initialCanonical;
  }

  enqueue(statistics: StatisticsState, force = false) {
    const canonical = serializeStatistics(statistics);
    this.tail = this.tail.catch(() => undefined).then(async () => {
      if (!force && canonical === this.lastCanonical) return;
      await this.storage.setItem(STATISTICS_STORAGE_KEY, canonical);
      this.lastCanonical = canonical;
    });
    return this.tail;
  }

  flush() { return this.tail; }
}

