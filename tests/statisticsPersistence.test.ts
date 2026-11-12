import assert from 'node:assert/strict';
import test from 'node:test';

import { applyStatisticsEvent, createEmptyStatistics } from '../statistics/statisticsEngine.ts';
import {
  deserializeStatistics,
  hydrateStatistics,
  serializeStatistics,
  STATISTICS_STORAGE_KEY,
  StatisticsWriteQueue,
  type StatisticsStorage,
} from '../statistics/persistence.ts';

class MemoryStorage implements StatisticsStorage {
  values = new Map<string, string>();
  writes: string[] = [];
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); this.writes.push(value); }
}

function progressed() {
  return applyStatisticsEvent(createEmptyStatistics(), {
    id: 'persisted-round', type: 'single-round-completed', occurredAt: '2026-11-11T12:00:00.000Z',
    configuration: { variant: 'one-finger-single', difficulty: 'easy', fakeSignalsEnabled: false },
    result: { kind: 'valid', reactionTimeMs: 201.25 }, gameCompleted: false,
  }).state;
}

test('statistics save and reload with full measurement precision', async () => {
  const storage = new MemoryStorage();
  const expected = progressed();
  await storage.setItem(STATISTICS_STORAGE_KEY, serializeStatistics(expected));
  const loaded = await hydrateStatistics(storage);
  assert.equal(loaded.statistics.overall.fastestReactionMs, 201.25);
  assert.equal(loaded.statistics.overall.reactionTimeTotalMs, 201.25);
});

test('corrupted and structurally invalid payloads recover safely', () => {
  assert.deepEqual(deserializeStatistics('{bad').statistics, createEmptyStatistics());
  const invalid = deserializeStatistics(JSON.stringify({ version: 1, statistics: { overall: { fastestReactionMs: -5, reactionTimeTotalMs: 'bad' } } }));
  assert.equal(invalid.statistics.overall.fastestReactionMs, null);
  assert.equal(invalid.statistics.overall.reactionTimeTotalMs, 0);
});

test('legacy unversioned statistics migrate to the current schema', () => {
  const legacy = JSON.stringify({ overall: { roundsAttempted: 3, validReactionCount: 2, reactionTimeTotalMs: 410 } });
  const loaded = deserializeStatistics(legacy);
  assert.equal(loaded.needsWrite, true);
  assert.equal(loaded.statistics.overall.roundsAttempted, 3);
});

test('rapid writes are serialized and an older write cannot overwrite a newer result', async () => {
  const storage = new MemoryStorage();
  const queue = new StatisticsWriteQueue(storage);
  const first = progressed();
  const second = applyStatisticsEvent(first, {
    id: 'second-round', type: 'single-round-completed', occurredAt: '2026-11-11T12:01:00.000Z',
    configuration: { variant: 'one-finger-single', difficulty: 'easy', fakeSignalsEnabled: false },
    result: { kind: 'valid', reactionTimeMs: 190 }, gameCompleted: false,
  }).state;
  void queue.enqueue(first);
  void queue.enqueue(second);
  await queue.flush();
  const final = deserializeStatistics(storage.values.get(STATISTICS_STORAGE_KEY) ?? null).statistics;
  assert.equal(final.overall.validReactionCount, 2);
  assert.equal(final.overall.fastestReactionMs, 190);
});

test('reset queued after a pending update remains the final persisted state', async () => {
  const storage = new MemoryStorage();
  const queue = new StatisticsWriteQueue(storage);
  void queue.enqueue(progressed());
  void queue.enqueue(createEmptyStatistics(), true);
  await queue.flush();
  const final = deserializeStatistics(storage.values.get(STATISTICS_STORAGE_KEY) ?? null).statistics;
  assert.deepEqual(final, createEmptyStatistics());
});

test('statistics reset uses a separate key and cannot alter settings', async () => {
  const storage = new MemoryStorage();
  storage.values.set('zapzap.game-settings', 'preserve-me');
  const queue = new StatisticsWriteQueue(storage);
  await queue.enqueue(createEmptyStatistics(), true);
  assert.equal(storage.values.get('zapzap.game-settings'), 'preserve-me');
});

test('a completed gameplay event is persisted exactly once across reload', async () => {
  const storage = new MemoryStorage();
  const event = {
    id: 'integration-round-1', type: 'single-round-completed' as const,
    occurredAt: '2026-11-11T12:00:00.000Z',
    configuration: { variant: 'one-finger-single' as const, difficulty: 'normal' as const, fakeSignalsEnabled: false },
    result: { kind: 'valid' as const, reactionTimeMs: 199.5 }, gameCompleted: false,
  };
  const first = applyStatisticsEvent(createEmptyStatistics(), event);
  const duplicate = applyStatisticsEvent(first.state, event);
  const queue = new StatisticsWriteQueue(storage);
  await queue.enqueue(duplicate.state);
  const reloaded = await hydrateStatistics(storage);
  assert.equal(reloaded.statistics.overall.roundsAttempted, 1);
  assert.equal(reloaded.statistics.overall.validReactionCount, 1);
  assert.equal(reloaded.statistics.overall.fastestReactionMs, 199.5);
});

