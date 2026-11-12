import { ACHIEVEMENTS, getAchievementProgress, type AchievementDefinition } from './achievements';
import type {
  FailureKind,
  GameVariant,
  MultiplayerPositionStatistics,
  ReactionAggregate,
  SinglePlayerStatistics,
  StatisticsConfiguration,
  StatisticsEvent,
  StatisticsState,
} from './types';

const MAX_PROCESSED_EVENTS = 512;

export const createReactionAggregate = (): ReactionAggregate => ({
  roundsAttempted: 0,
  successfulReactions: 0,
  failedReactions: 0,
  validReactionCount: 0,
  reactionTimeTotalMs: 0,
  fastestReactionMs: null,
  falseStarts: 0,
  timeouts: 0,
  wrongFingerFailures: 0,
  lastPlayedAt: null,
});

const createSinglePlayerStatistics = (): SinglePlayerStatistics => ({
  gamesStarted: 0,
  gamesCompleted: 0,
  zapsAvoided: 0,
  currentStreak: 0,
  longestStreak: 0,
  reactions: createReactionAggregate(),
});

const createMultiplayerPositionStatistics = (): MultiplayerPositionStatistics => ({
  matchesPlayed: 0,
  matchesWon: 0,
  matchesLost: 0,
  matchesDrawn: 0,
  roundsPlayed: 0,
  roundsWon: 0,
  roundsLost: 0,
  roundsDrawn: 0,
  reactions: createReactionAggregate(),
});

export function createEmptyStatistics(): StatisticsState {
  return {
    overall: createReactionAggregate(),
    configurations: {},
    singlePlayer: {
      'one-finger-single': createSinglePlayerStatistics(),
      'two-finger-single': createSinglePlayerStatistics(),
    },
    multiplayer: {
      'one-finger-multiplayer': { p1: createMultiplayerPositionStatistics(), p2: createMultiplayerPositionStatistics() },
      'two-finger-multiplayer': { p1: createMultiplayerPositionStatistics(), p2: createMultiplayerPositionStatistics() },
    },
    multiplayerMatchFormats: {},
    achievements: {},
    successfulFakeSignalReactions: 0,
    successfulTwoFingerReactions: 0,
    processedEventIds: [],
  };
}

export function configurationKey(configuration: StatisticsConfiguration) {
  return `${configuration.variant}|${configuration.difficulty}|fake-${configuration.fakeSignalsEnabled ? 'on' : 'off'}`;
}

export function averageReactionTime(aggregate: ReactionAggregate) {
  return aggregate.validReactionCount === 0
    ? null
    : aggregate.reactionTimeTotalMs / aggregate.validReactionCount;
}

export function formatStatisticTime(value: number | null) {
  return value === null ? '--' : `${value.toFixed(2)} ms`;
}

function cloneReaction(value: ReactionAggregate): ReactionAggregate { return { ...value }; }

function cloneState(state: StatisticsState): StatisticsState {
  return {
    ...state,
    overall: cloneReaction(state.overall),
    configurations: Object.fromEntries(Object.entries(state.configurations).map(([key, value]) => [key, cloneReaction(value)])),
    singlePlayer: {
      'one-finger-single': { ...state.singlePlayer['one-finger-single'], reactions: cloneReaction(state.singlePlayer['one-finger-single'].reactions) },
      'two-finger-single': { ...state.singlePlayer['two-finger-single'], reactions: cloneReaction(state.singlePlayer['two-finger-single'].reactions) },
    },
    multiplayer: {
      'one-finger-multiplayer': {
        p1: { ...state.multiplayer['one-finger-multiplayer'].p1, reactions: cloneReaction(state.multiplayer['one-finger-multiplayer'].p1.reactions) },
        p2: { ...state.multiplayer['one-finger-multiplayer'].p2, reactions: cloneReaction(state.multiplayer['one-finger-multiplayer'].p2.reactions) },
      },
      'two-finger-multiplayer': {
        p1: { ...state.multiplayer['two-finger-multiplayer'].p1, reactions: cloneReaction(state.multiplayer['two-finger-multiplayer'].p1.reactions) },
        p2: { ...state.multiplayer['two-finger-multiplayer'].p2, reactions: cloneReaction(state.multiplayer['two-finger-multiplayer'].p2.reactions) },
      },
    },
    multiplayerMatchFormats: Object.fromEntries(
      Object.entries(state.multiplayerMatchFormats).map(([key, value]) => [key, { ...value }])
    ),
    achievements: { ...state.achievements },
    processedEventIds: [...state.processedEventIds],
  };
}

function validReactionTime(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function recordValid(aggregate: ReactionAggregate, reactionTime: number, occurredAt: string) {
  if (!validReactionTime(reactionTime)) return false;
  aggregate.successfulReactions += 1;
  aggregate.validReactionCount += 1;
  aggregate.reactionTimeTotalMs += reactionTime;
  aggregate.fastestReactionMs = aggregate.fastestReactionMs === null
    ? reactionTime
    : Math.min(aggregate.fastestReactionMs, reactionTime);
  aggregate.lastPlayedAt = occurredAt;
  return true;
}

function recordFailure(aggregate: ReactionAggregate, reason: FailureKind, occurredAt: string) {
  aggregate.failedReactions += 1;
  if (reason === 'false-start' || reason === 'cancelled') aggregate.falseStarts += 1;
  if (reason === 'timeout' || reason === 'late') aggregate.timeouts += 1;
  if (reason === 'wrong-finger') aggregate.wrongFingerFailures += 1;
  aggregate.lastPlayedAt = occurredAt;
}

function recordResult(
  aggregate: ReactionAggregate,
  result: { kind: 'valid'; reactionTimeMs: number } | { kind: 'invalid'; reason: FailureKind },
  occurredAt: string
) {
  if (result.kind === 'valid') return recordValid(aggregate, result.reactionTimeMs, occurredAt);
  recordFailure(aggregate, result.reason, occurredAt);
  return false;
}

function unlockAchievements(state: StatisticsState, occurredAt: string) {
  const unlocked: AchievementDefinition[] = [];
  ACHIEVEMENTS.forEach((achievement) => {
    if (state.achievements[achievement.id]) return;
    if (getAchievementProgress(achievement, state) < achievement.target) return;
    state.achievements[achievement.id] = { unlockedAt: occurredAt };
    unlocked.push(achievement);
  });
  return unlocked;
}

export function applyStatisticsEvent(state: StatisticsState, event: StatisticsEvent) {
  if (state.processedEventIds.includes(event.id)) return { state, unlocked: [] as AchievementDefinition[], duplicate: true };
  const next = cloneState(state);
  next.processedEventIds.push(event.id);
  if (next.processedEventIds.length > MAX_PROCESSED_EVENTS) {
    next.processedEventIds = next.processedEventIds.slice(-MAX_PROCESSED_EVENTS);
  }

  if (event.type === 'single-game-started') {
    next.singlePlayer[event.configuration.variant].gamesStarted += 1;
  } else if (event.type === 'single-round-completed') {
    const mode = next.singlePlayer[event.configuration.variant];
    const configKey = configurationKey(event.configuration);
    const config = next.configurations[configKey] ?? createReactionAggregate();
    next.configurations[configKey] = config;
    next.overall.roundsAttempted += 1;
    config.roundsAttempted += 1;
    mode.reactions.roundsAttempted += 1;
    const valid = recordResult(mode.reactions, event.result, event.occurredAt);
    recordResult(next.overall, event.result, event.occurredAt);
    recordResult(config, event.result, event.occurredAt);
    if (valid) {
      mode.zapsAvoided += 1;
      mode.currentStreak += 1;
      mode.longestStreak = Math.max(mode.longestStreak, mode.currentStreak);
      if (event.configuration.fakeSignalsEnabled) next.successfulFakeSignalReactions += 1;
      if (event.configuration.variant === 'two-finger-single') next.successfulTwoFingerReactions += 1;
    } else {
      mode.currentStreak = 0;
    }
    if (event.gameCompleted) mode.gamesCompleted += 1;
  } else if (event.type === 'multiplayer-round-completed') {
    const positions = next.multiplayer[event.configuration.variant];
    const configKey = configurationKey(event.configuration);
    const config = next.configurations[configKey] ?? createReactionAggregate();
    next.configurations[configKey] = config;
    next.overall.roundsAttempted += 1;
    config.roundsAttempted += 1;
    (['p1', 'p2'] as const).forEach((player) => {
      const position = positions[player];
      position.roundsPlayed += 1;
      if (event.outcome.winner === 'draw') position.roundsDrawn += 1;
      else if (event.outcome.winner === player) position.roundsWon += 1;
      else position.roundsLost += 1;
      position.reactions.roundsAttempted += 1;
      const result = event.results[player];
      if (result?.kind === 'valid') {
        const normalized = { kind: 'valid' as const, reactionTimeMs: result.reactionTime };
        const valid = recordResult(position.reactions, normalized, event.occurredAt);
        recordResult(next.overall, normalized, event.occurredAt);
        recordResult(config, normalized, event.occurredAt);
        if (valid && event.configuration.fakeSignalsEnabled) next.successfulFakeSignalReactions += 1;
        if (valid && event.configuration.variant === 'two-finger-multiplayer') next.successfulTwoFingerReactions += 1;
      } else if (result?.kind === 'invalid') {
        const normalized = { kind: 'invalid' as const, reason: result.reason };
        recordResult(position.reactions, normalized, event.occurredAt);
        recordResult(next.overall, normalized, event.occurredAt);
        recordResult(config, normalized, event.occurredAt);
      }
    });
  } else {
    const positions = next.multiplayer[event.configuration.variant];
    const formatKey = `${event.configuration.variant}|${event.configuration.matchFormat}`;
    const formatStats = next.multiplayerMatchFormats[formatKey] ?? {
      matchesPlayed: 0, player1Wins: 0, player2Wins: 0, draws: 0,
    };
    next.multiplayerMatchFormats[formatKey] = formatStats;
    formatStats.matchesPlayed += 1;
    if (event.winner === 'p1') formatStats.player1Wins += 1;
    else if (event.winner === 'p2') formatStats.player2Wins += 1;
    else formatStats.draws += 1;
    (['p1', 'p2'] as const).forEach((player) => {
      const position = positions[player];
      position.matchesPlayed += 1;
      if (event.winner === 'draw') position.matchesDrawn += 1;
      else if (event.winner === player) position.matchesWon += 1;
      else position.matchesLost += 1;
    });
  }

  return { state: next, unlocked: unlockAchievements(next, event.occurredAt), duplicate: false };
}

export function totalForVariant(state: StatisticsState, variant: GameVariant) {
  if (variant === 'one-finger-single' || variant === 'two-finger-single') return state.singlePlayer[variant].reactions;
  const mode = state.multiplayer[variant];
  return {
    ...createReactionAggregate(),
    roundsAttempted: mode.p1.roundsPlayed,
    successfulReactions: mode.p1.reactions.successfulReactions + mode.p2.reactions.successfulReactions,
    failedReactions: mode.p1.reactions.failedReactions + mode.p2.reactions.failedReactions,
    validReactionCount: mode.p1.reactions.validReactionCount + mode.p2.reactions.validReactionCount,
    reactionTimeTotalMs: mode.p1.reactions.reactionTimeTotalMs + mode.p2.reactions.reactionTimeTotalMs,
    fastestReactionMs: [mode.p1.reactions.fastestReactionMs, mode.p2.reactions.fastestReactionMs]
      .filter((value): value is number => value !== null)
      .reduce<number | null>((best, value) => best === null ? value : Math.min(best, value), null),
    falseStarts: mode.p1.reactions.falseStarts + mode.p2.reactions.falseStarts,
    timeouts: mode.p1.reactions.timeouts + mode.p2.reactions.timeouts,
    wrongFingerFailures: mode.p1.reactions.wrongFingerFailures + mode.p2.reactions.wrongFingerFailures,
    lastPlayedAt: mode.p1.reactions.lastPlayedAt ?? mode.p2.reactions.lastPlayedAt,
  };
}

