import assert from 'node:assert/strict';
import test from 'node:test';

import { ACHIEVEMENTS, getAchievementProgress, nextAchievementNotification } from '../statistics/achievements.ts';
import {
  applyStatisticsEvent,
  averageReactionTime,
  configurationKey,
  createEmptyStatistics,
  formatStatisticTime,
} from '../statistics/statisticsEngine.ts';
import type { Difficulty, MatchFormat } from '../settings/gameSettings.ts';
import type { StatisticsEvent, StatisticsState } from '../statistics/types.ts';

const at = '2026-11-11T12:00:00.000Z';
type SingleConfiguration = Extract<StatisticsEvent, { type: 'single-round-completed' }>['configuration'];

const singleConfig: SingleConfiguration = {
  variant: 'one-finger-single' as const,
  difficulty: 'easy' as const,
  fakeSignalsEnabled: false,
};

function singleEvent(id: string, result: Extract<StatisticsEvent, { type: 'single-round-completed' }>['result'], configuration: SingleConfiguration = singleConfig): StatisticsEvent {
  return { id, type: 'single-round-completed', occurredAt: at, configuration, result, gameCompleted: result.kind === 'invalid' };
}

function apply(state: StatisticsState, event: StatisticsEvent) {
  return applyStatisticsEvent(state, event).state;
}

test('initial statistics are empty and averages have an explicit empty state', () => {
  const state = createEmptyStatistics();
  assert.equal(state.overall.roundsAttempted, 0);
  assert.equal(state.overall.fastestReactionMs, null);
  assert.equal(averageReactionTime(state.overall), null);
  assert.equal(formatStatisticTime(null), '--');
});

test('valid reactions update count, exact average, fastest time, streak, and display rounding', () => {
  let state = createEmptyStatistics();
  state = apply(state, singleEvent('r1', { kind: 'valid', reactionTimeMs: 212.345 }));
  state = apply(state, singleEvent('r2', { kind: 'valid', reactionTimeMs: 187.111 }));
  const mode = state.singlePlayer['one-finger-single'];
  assert.equal(mode.zapsAvoided, 2);
  assert.equal(mode.currentStreak, 2);
  assert.equal(mode.longestStreak, 2);
  assert.equal(state.overall.fastestReactionMs, 187.111);
  assert.equal(averageReactionTime(state.overall), (212.345 + 187.111) / 2);
  assert.equal(formatStatisticTime(187.111), '187.11 ms');
});

test('failures are excluded from averages and reset only the current streak', () => {
  let state = createEmptyStatistics();
  state = apply(state, singleEvent('r1', { kind: 'valid', reactionTimeMs: 200 }));
  state = apply(state, singleEvent('r2', { kind: 'invalid', reason: 'false-start' }));
  const mode = state.singlePlayer['one-finger-single'];
  assert.equal(mode.currentStreak, 0);
  assert.equal(mode.longestStreak, 1);
  assert.equal(mode.reactions.falseStarts, 1);
  assert.equal(mode.gamesCompleted, 1);
  assert.equal(averageReactionTime(mode.reactions), 200);
});

test('timeout and wrong-finger failures are classified separately', () => {
  let state = createEmptyStatistics();
  state = apply(state, singleEvent('timeout', { kind: 'invalid', reason: 'timeout' }));
  state = apply(state, singleEvent('wrong', { kind: 'invalid', reason: 'wrong-finger' }, {
    ...singleConfig, variant: 'two-finger-single' as const,
  }));
  assert.equal(state.overall.timeouts, 1);
  assert.equal(state.overall.wrongFingerFailures, 1);
  assert.equal(state.singlePlayer['two-finger-single'].reactions.wrongFingerFailures, 1);
});

test('invalid reaction values never become records or averages', () => {
  let state = createEmptyStatistics();
  state = apply(state, singleEvent('negative', { kind: 'valid', reactionTimeMs: -1 }));
  state = apply(state, singleEvent('nan', { kind: 'valid', reactionTimeMs: Number.NaN }));
  assert.equal(state.overall.validReactionCount, 0);
  assert.equal(state.overall.fastestReactionMs, null);
});

test('records remain separate by mode, difficulty, and Fake Signals setting', () => {
  let state = createEmptyStatistics();
  const configurations = [
    singleConfig,
    { ...singleConfig, difficulty: 'hard' as const },
    { ...singleConfig, fakeSignalsEnabled: true },
    { ...singleConfig, variant: 'two-finger-single' as const },
  ];
  configurations.forEach((configuration, index) => {
    state = apply(state, singleEvent(`config-${index}`, { kind: 'valid', reactionTimeMs: 200 + index }, configuration));
  });
  configurations.forEach((configuration) => {
    assert.equal(state.configurations[configurationKey(configuration)]?.validReactionCount, 1);
  });
  assert.equal(Object.keys(state.configurations).length, 4);
});

test('ten consecutive single-player successes preserve progression and unlock Survivor', () => {
  let state = createEmptyStatistics();
  for (let index = 0; index < 10; index += 1) {
    state = apply(state, singleEvent(`streak-${index}`, { kind: 'valid', reactionTimeMs: 300 }));
  }
  assert.equal(state.singlePlayer['one-finger-single'].currentStreak, 10);
  assert.ok(state.achievements.survivor);
});

function multiplayerRound(id: string, winner: 'p1' | 'p2' | 'draw', difficulty: Difficulty = 'normal'): StatisticsEvent {
  return {
    id,
    type: 'multiplayer-round-completed',
    occurredAt: at,
    configuration: { variant: 'two-finger-multiplayer', difficulty, fakeSignalsEnabled: false, matchFormat: 'three-lives' },
    results: {
      p1: winner === 'p2' ? { kind: 'invalid', reason: 'wrong-finger' } : { kind: 'valid', reactionTime: 180 },
      p2: winner === 'p1' ? { kind: 'invalid', reason: 'timeout' } : { kind: 'valid', reactionTime: 210 },
    },
    outcome: { winner, losers: winner === 'draw' ? [] : [winner === 'p1' ? 'p2' : 'p1'], reason: winner === 'draw' ? 'equal-reaction' : 'single-failure' },
  };
}

test('multiplayer rounds track Player 1, Player 2, and draw results independently', () => {
  let state = createEmptyStatistics();
  state = apply(state, multiplayerRound('p1', 'p1'));
  state = apply(state, multiplayerRound('p2', 'p2'));
  state = apply(state, multiplayerRound('draw', 'draw'));
  const players = state.multiplayer['two-finger-multiplayer'];
  assert.deepEqual([players.p1.roundsWon, players.p1.roundsLost, players.p1.roundsDrawn], [1, 1, 1]);
  assert.deepEqual([players.p2.roundsWon, players.p2.roundsLost, players.p2.roundsDrawn], [1, 1, 1]);
});

test('completed matches record wins, losses, and draws for every match format', () => {
  let state = createEmptyStatistics();
  const formats: MatchFormat[] = ['three-lives', 'single-round', 'best-of-three', 'best-of-five', 'best-of-seven'];
  formats.forEach((matchFormat, index) => {
    state = apply(state, {
      id: `match-${matchFormat}`,
      type: 'multiplayer-match-completed',
      occurredAt: at,
      configuration: { variant: 'one-finger-multiplayer', difficulty: 'easy', fakeSignalsEnabled: false, matchFormat },
      winner: index === formats.length - 1 ? 'draw' : index % 2 === 0 ? 'p1' : 'p2',
    });
  });
  const players = state.multiplayer['one-finger-multiplayer'];
  assert.equal(players.p1.matchesPlayed, 5);
  assert.deepEqual([players.p1.matchesWon, players.p1.matchesLost, players.p1.matchesDrawn], [2, 2, 1]);
  assert.deepEqual([players.p2.matchesWon, players.p2.matchesLost, players.p2.matchesDrawn], [2, 2, 1]);
  formats.forEach((matchFormat) => {
    assert.equal(state.multiplayerMatchFormats[`one-finger-multiplayer|${matchFormat}`]?.matchesPlayed, 1);
  });
});

test('statistics events are processed exactly once', () => {
  const event = singleEvent('stable-round-id', { kind: 'valid', reactionTimeMs: 220 });
  const first = applyStatisticsEvent(createEmptyStatistics(), event);
  const duplicate = applyStatisticsEvent(first.state, event);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.state.overall.roundsAttempted, 1);
  assert.equal(duplicate.state.overall.validReactionCount, 1);
});

test('achievements unlock once, retain timestamps, and expose measurable progress', () => {
  let state = createEmptyStatistics();
  const first = applyStatisticsEvent(state, singleEvent('first', { kind: 'valid', reactionTimeMs: 199 }));
  state = first.state;
  assert.ok(first.unlocked.some((achievement) => achievement.id === 'first-zap'));
  assert.equal(state.achievements['first-zap']?.unlockedAt, at);
  const second = applyStatisticsEvent(state, singleEvent('second', { kind: 'valid', reactionTimeMs: 210 }));
  assert.equal(second.unlocked.some((achievement) => achievement.id === 'first-zap'), false);
  const gettingStarted = ACHIEVEMENTS.find((achievement) => achievement.id === 'getting-started');
  assert.equal(gettingStarted ? getAchievementProgress(gettingStarted, second.state) : -1, 2);
});

test('achievement notifications defer during competitive gameplay', () => {
  assert.equal(nextAchievementNotification([ACHIEVEMENTS[0]!], true), null);
  assert.equal(nextAchievementNotification([ACHIEVEMENTS[0]!], false)?.id, 'first-zap');
});

