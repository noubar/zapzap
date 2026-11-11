import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareReactionTimes,
  createRandomWait,
  evaluateReaction,
  isCorrectTarget,
  isHeldAfterInput,
  RANDOM_WAIT_MIN_MS,
  RANDOM_WAIT_RANGE_MS,
  recordPlayerReaction,
} from '../gameplay/core.ts';
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

  clearTimeout = (handle: unknown) => {
    this.jobs.delete(handle as number);
  };

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

test('random waiting is always between one and five seconds', () => {
  assert.equal(createRandomWait(() => 0), RANDOM_WAIT_MIN_MS);
  assert.equal(
    createRandomWait(() => 0.999_999),
    RANDOM_WAIT_MIN_MS + RANDOM_WAIT_RANGE_MS * 0.999_999
  );
  assert.ok(createRandomWait(() => 0.5) > 0);
});

test('reaction evaluation covers false starts and deadline boundaries', () => {
  assert.equal(evaluateReaction(1_000, 999, 500).kind, 'false-start');
  assert.deepEqual(evaluateReaction(1_000, 1_499, 500), {
    kind: 'valid',
    reactionTime: 499,
  });
  assert.deepEqual(evaluateReaction(1_000, 1_500, 500), {
    kind: 'valid',
    reactionTime: 500,
  });
  assert.deepEqual(evaluateReaction(1_000, 1_501, 500), {
    kind: 'late',
    reactionTime: 501,
  });
});

test('two-player reactions compare consistently, including ties', () => {
  assert.equal(compareReactionTimes(150, 175), 'first');
  assert.equal(compareReactionTimes(200, 175), 'second');
  assert.equal(compareReactionTimes(180, 180), 'draw');
});

test('near-simultaneous player reactions are recorded independently once', () => {
  let reactions: {
    p1: number | null;
    p2: number | null;
  } = { p1: null, p2: null };
  reactions = recordPlayerReaction(reactions, 'p1', 200);
  reactions = recordPlayerReaction(reactions, 'p2', 200.1);
  reactions = recordPlayerReaction(reactions, 'p1', 190);

  assert.deepEqual(reactions, { p1: 200, p2: 200.1 });
  assert.equal(compareReactionTimes(reactions.p1, reactions.p2), 'first');
});

test('wrong-finger releases are rejected', () => {
  assert.equal(isCorrectTarget('left', 'left'), true);
  assert.equal(isCorrectTarget('left', 'right'), false);
});

test('holding survives the random wait and never releasing triggers the deadline', () => {
  const scheduler = new FakeScheduler();
  const timers = new RoundTimerManager(scheduler);
  let signalActive = false;
  let timedOut = false;
  const round = timers.beginRound();
  timers.schedule(round, () => {
    signalActive = true;
    timers.schedule(round, () => {
      timedOut = true;
    }, 500);
  }, createRandomWait(() => 0));

  scheduler.advance(999);
  assert.equal(signalActive, false);
  scheduler.advance(1);
  assert.equal(signalActive, true);
  scheduler.advance(499);
  assert.equal(timedOut, false);
  scheduler.advance(1);
  assert.equal(timedOut, true);
});

test('gesture cancellation clears held state just like a release', () => {
  assert.equal(isHeldAfterInput('press'), true);
  assert.equal(isHeldAfterInput('release'), false);
  assert.equal(isHeldAfterInput('cancel'), false);
});

test('a successful round can be followed by a fresh independent round', () => {
  const scheduler = new FakeScheduler();
  const timers = new RoundTimerManager(scheduler);
  const events: string[] = [];
  const firstRound = timers.beginRound();
  timers.schedule(firstRound, () => events.push('first'), 100);
  scheduler.advance(100);

  const secondRound = timers.beginRound();
  timers.schedule(secondRound, () => events.push('second'), 100);
  scheduler.advance(100);

  assert.deepEqual(events, ['first', 'second']);
});

test('reset cancels timers and prevents old rounds from changing a new round', () => {
  const scheduler = new FakeScheduler();
  const timers = new RoundTimerManager(scheduler);
  const events: string[] = [];
  const oldRound = timers.beginRound();
  timers.schedule(oldRound, () => events.push('stale'), 100);

  timers.invalidate();
  const newRound = timers.beginRound();
  timers.schedule(newRound, () => events.push('current'), 200);
  scheduler.advance(100);
  assert.deepEqual(events, []);
  scheduler.advance(100);
  assert.deepEqual(events, ['current']);
});

test('invalidating a round cancels a pending deadline', () => {
  const scheduler = new FakeScheduler();
  const timers = new RoundTimerManager(scheduler);
  let deadlineExpired = false;
  const round = timers.beginRound();
  timers.schedule(round, () => {
    deadlineExpired = true;
  }, 500);
  timers.invalidate();
  scheduler.advance(500);
  assert.equal(deadlineExpired, false);
});

test('invalidating a round cancels a pending animation frame', () => {
  const scheduler = new FakeScheduler();
  const timers = new RoundTimerManager(scheduler);
  const round = timers.beginRound();
  let frameRan = false;
  timers.scheduleFrame(round, () => {
    frameRan = true;
  });

  timers.invalidate();
  scheduler.advance(16);
  assert.equal(frameRan, false);
});
