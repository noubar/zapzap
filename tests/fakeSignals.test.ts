import assert from 'node:assert/strict';
import test from 'node:test';

import { signalColors } from '../constants/SignalColors.ts';
import { createRandomWait, evaluateReaction } from '../gameplay/core.ts';
import {
  FAKE_SIGNAL_COLORS,
  createFakeSignalSchedule,
  isReleaseBeforeRealSignal,
  scheduleFakeSignalEvents,
  selectFakeTarget,
} from '../gameplay/fakeSignals.ts';
import { createInitialMultiplayerState } from '../gameplay/multiplayer.ts';
import { RoundTimerManager, type TimerScheduler } from '../gameplay/RoundTimerManager.ts';

class FakeScheduler implements TimerScheduler {
  private now = 0;
  private nextId = 1;
  private jobs = new Map<number, { at: number; callback: () => void }>();

  setTimeout = (callback: () => void, delay: number) => {
    const id = this.nextId++;
    this.jobs.set(id, { at: this.now + delay, callback });
    return id;
  };
  clearTimeout = (handle: unknown) => { this.jobs.delete(handle as number); };
  requestFrame = (callback: (timestamp: number) => void) =>
    this.setTimeout(() => callback(this.now), 16);
  cancelFrame = (handle: unknown) => this.clearTimeout(handle);

  advance(milliseconds: number) {
    const target = this.now + milliseconds;
    while (true) {
      const next = [...this.jobs.entries()]
        .filter(([, job]) => job.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      const [id, job] = next;
      this.jobs.delete(id);
      this.now = job.at;
      job.callback();
    }
    this.now = target;
  }
}

function sequenceRandom(values: number[]) {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

test('fake scheduling preserves the mandatory randomized real-signal delay', () => {
  const realDelay = createRandomWait(() => 0.625);
  const schedule = createFakeSignalSchedule(realDelay, () => 0.5);
  assert.equal(realDelay, 3_500);
  assert.equal(schedule.realSignalDelayMs, realDelay);
});

test('fake signal count changes with randomness and available waiting time', () => {
  const one = createFakeSignalSchedule(5_000, () => 0);
  const three = createFakeSignalSchedule(5_000, () => 0.999_999);
  const none = createFakeSignalSchedule(300, () => 0.5);
  assert.equal(one.events.length, 1);
  assert.equal(three.events.length, 3);
  assert.equal(none.events.length, 0);
});

test('fake colors are selected only from blue, purple, and amber', () => {
  const random = sequenceRandom([0.99, 0, 0, 0, 0, 0.4, 0, 0, 0.9]);
  const schedule = createFakeSignalSchedule(5_000, random);
  const allowed = new Set<string>(FAKE_SIGNAL_COLORS.map((color) => color.value));
  assert.ok(schedule.events.length > 0);
  schedule.events.forEach((event) => assert.equal(allowed.has(event.color), true));
  assert.equal(allowed.has(signalColors.real), false);
});

test('fake color selection changes with the injected random source', () => {
  const blue = createFakeSignalSchedule(5_000, sequenceRandom([0, 0, 0, 0]));
  const purple = createFakeSignalSchedule(5_000, sequenceRandom([0, 0, 0, 0.5]));
  assert.equal(blue.events[0]?.colorName, 'blue');
  assert.equal(purple.events[0]?.colorName, 'purple');
});

test('fake flashes never overlap each other or the real GO safety gap', () => {
  const schedule = createFakeSignalSchedule(5_000, sequenceRandom([0.99, 0.1, 0.8, 0.5]));
  schedule.events.forEach((event, index) => {
    assert.ok(event.startMs + event.durationMs <= 4_750);
    const next = schedule.events[index + 1];
    if (next) assert.ok(event.startMs + event.durationMs < next.startMs);
  });
});

test('scheduled fake callbacks stop after round invalidation', () => {
  const scheduler = new FakeScheduler();
  const timers = new RoundTimerManager(scheduler);
  const seen: string[] = [];
  const round = timers.beginRound();
  const events = createFakeSignalSchedule(5_000, () => 0.5).events;
  scheduleFakeSignalEvents(timers, round, events, () => seen.push('start'), () => seen.push('end'));
  timers.invalidate();
  scheduler.advance(5_000);
  assert.deepEqual(seen, []);
});

test('no fake callback occurs after the real GO time', () => {
  const scheduler = new FakeScheduler();
  const timers = new RoundTimerManager(scheduler);
  const realDelay = 2_000;
  const seen: string[] = [];
  const round = timers.beginRound();
  const events = createFakeSignalSchedule(realDelay, () => 0.5).events;
  scheduleFakeSignalEvents(timers, round, events, () => seen.push('fake'), () => undefined);
  timers.schedule(round, () => seen.push('GO'), realDelay);
  scheduler.advance(realDelay);
  assert.equal(seen.at(-1), 'GO');
});

test('blue, purple, amber, and ordinary waiting all remain false-start phases', () => {
  FAKE_SIGNAL_COLORS.forEach(() => assert.equal(isReleaseBeforeRealSignal('waiting'), true));
  assert.equal(isReleaseBeforeRealSignal('waiting'), true);
  assert.equal(isReleaseBeforeRealSignal('zap'), false);
});

test('a visible fake flash cannot activate the valid-release path', () => {
  const fake = createFakeSignalSchedule(2_000, () => 0).events[0];
  assert.ok(fake);
  const roundState = 'waiting';
  assert.equal(isReleaseBeforeRealSignal(roundState), true);
  assert.equal(isReleaseBeforeRealSignal('zap'), false);
});

test('only white GO starts reaction evaluation and deadline rules remain exact', () => {
  assert.equal(evaluateReaction(1_000, 1_200, 500).kind, 'valid');
  assert.equal(evaluateReaction(1_000, 1_500, 500).kind, 'valid');
  assert.equal(evaluateReaction(1_000, 1_501, 500).kind, 'late');
});

test('two-finger fake targets can vary independently from each other and real targets', () => {
  const random = sequenceRandom([0.1, 0.9, 0.9]);
  const firstPlayerFake = selectFakeTarget(0, 1, random);
  const secondPlayerFake = selectFakeTarget(0, 1, random);
  const laterRealTarget = selectFakeTarget(0, 1, random);
  assert.deepEqual([firstPlayerFake, secondPlayerFake, laterRealTarget], [0, 1, 1]);
});

test('shared multiplayer flashes do not change scores or lives', () => {
  const state = createInitialMultiplayerState();
  const sharedEvent = createFakeSignalSchedule(2_000, () => 0).events[0];
  const playerViews = { p1: sharedEvent, p2: sharedEvent };
  assert.equal(playerViews.p1, playerViews.p2);
  assert.deepEqual(state.lives, { p1: 3, p2: 3 });
  assert.deepEqual(state.roundWins, { p1: 0, p2: 0 });
});

test('fake schedules are fresh across consecutive rounds', () => {
  const first = createFakeSignalSchedule(5_000, sequenceRandom([0, 0, 0, 0]));
  const second = createFakeSignalSchedule(5_000, sequenceRandom([0.99, 0.8, 0.5, 0.9]));
  assert.notDeepEqual(first.events, second.events);
});
