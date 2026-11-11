import assert from 'node:assert/strict';
import test from 'node:test';

import { createRandomWait, evaluateReaction, isCorrectTarget } from '../gameplay/core.ts';
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
  type MultiplayerRoundResults,
} from '../gameplay/multiplayer.ts';
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

const valid = (reactionTime: number) => ({ kind: 'valid', reactionTime } as const);
const invalid = (reason: 'false-start' | 'timeout' | 'wrong-finger') =>
  ({ kind: 'invalid', reason } as const);

test('both players must satisfy their hold requirements before a round is ready', () => {
  assert.equal(areBothPlayersReady({ p1: [true], p2: [true] }), true);
  assert.equal(areBothPlayersReady({ p1: [true], p2: [false] }), false);
  assert.equal(areBothPlayersReady({ p1: [true, true], p2: [true, false] }), false);
  assert.equal(areBothPlayersReady({ p1: [true, true], p2: [true, true] }), true);
});

test('one shared randomized wait produces one shared signal timestamp', () => {
  const scheduler = new FakeScheduler();
  const timers = new RoundTimerManager(scheduler);
  const observed: number[] = [];
  const round = timers.beginRound();
  timers.schedule(round, () => {
    timers.scheduleFrame(round, (frameTime) => {
      const signal = createSharedSignal(frameTime);
      observed.push(signal.signalTime, signal.signalTime);
    });
  }, createRandomWait(() => 0.5));

  scheduler.advance(2_999);
  assert.deepEqual(observed, []);
  scheduler.advance(17);
  assert.equal(observed.length, 2);
  assert.equal(observed[0], observed[1]);
});

test('player reactions are captured independently and duplicate releases are ignored', () => {
  let results: MultiplayerRoundResults = { p1: null, p2: null };
  results = recordRoundResult(results, 'p1', valid(201));
  results = recordRoundResult(results, 'p2', valid(189));
  results = recordRoundResult(results, 'p1', valid(100));
  assert.deepEqual(results, { p1: valid(201), p2: valid(189) });
});

test('player 1 and player 2 wins are determined only by measured reactions', () => {
  assert.deepEqual(settleCompletedRound({ p1: valid(150), p2: valid(175) }), {
    winner: 'p1', losers: ['p2'], reason: 'faster-reaction',
  });
  assert.deepEqual(settleCompletedRound({ p1: valid(220), p2: valid(180) }), {
    winner: 'p2', losers: ['p1'], reason: 'faster-reaction',
  });
});

test('exactly equal reactions are a draw without an arbitrary tolerance', () => {
  assert.deepEqual(settleCompletedRound({ p1: valid(200), p2: valid(200) }), {
    winner: 'draw', losers: [], reason: 'equal-reaction',
  });
  assert.equal(settleCompletedRound({ p1: valid(200), p2: valid(200.001) })?.winner, 'p1');
});

test('one false start forfeits to the other player', () => {
  assert.deepEqual(settleSingleFailure('p1'), {
    winner: 'p2', losers: ['p1'], reason: 'single-failure',
  });
});

test('one invalid result loses to a valid result regardless of callback order', () => {
  const p1First = settleCompletedRound({ p1: invalid('timeout'), p2: valid(300) });
  const p2First = settleCompletedRound({ p1: valid(300), p2: invalid('timeout') });
  assert.equal(p1First?.winner, 'p2');
  assert.equal(p2First?.winner, 'p1');
});

test('both failures and both timeouts deduct one life from each player', () => {
  for (const results of [
    { p1: invalid('false-start'), p2: invalid('wrong-finger') },
    { p1: invalid('timeout'), p2: invalid('timeout') },
  ]) {
    const outcome = settleCompletedRound(results);
    assert.ok(outcome);
    assert.equal(outcome.winner, 'draw');
    assert.deepEqual(applyRoundOutcome({ p1: 3, p2: 3 }, outcome), { p1: 2, p2: 2 });
  }
});

test('deadline boundaries remain valid through exactly the deadline', () => {
  assert.equal(evaluateReaction(1_000, 1_499.999, 500).kind, 'valid');
  assert.equal(evaluateReaction(1_000, 1_500, 500).kind, 'valid');
  assert.equal(evaluateReaction(1_000, 1_500.001, 500).kind, 'late');
});

test('wrong-finger releases are invalid and targets are independently randomized', () => {
  const values = [0.1, 0.9];
  const targets = selectIndependentTargets(() => values.shift() ?? 0);
  assert.deepEqual(targets, { p1: 0, p2: 1 });
  assert.equal(isCorrectTarget(targets.p1, 1), false);
  assert.equal(isCorrectTarget(targets.p2, 1), true);
});

test('four simultaneous holds are represented independently at the logic level', () => {
  const holds = { p1: [false, false], p2: [false, false] };
  holds.p2[1] = true;
  holds.p1[0] = true;
  holds.p2[0] = true;
  assert.equal(areBothPlayersReady(holds), false);
  holds.p1[1] = true;
  assert.equal(areBothPlayersReady(holds), true);
});

test('life deductions clamp at zero and match completion is deterministic', () => {
  const p1Wins = settleCompletedRound({ p1: valid(100), p2: invalid('timeout') });
  assert.ok(p1Wins);
  const lives = applyRoundOutcome({ p1: 2, p2: 0 }, p1Wins);
  assert.deepEqual(lives, { p1: 2, p2: 0 });
  assert.equal(getMatchWinner(lives), 'p1');
  assert.equal(getMatchWinner({ p1: 0, p2: 0 }), 'draw');
  assert.equal(getMatchWinner({ p1: 1, p2: 1 }), null);
});

test('play again creates fresh lives and reaction records', () => {
  const first = createInitialMultiplayerState();
  first.lives.p1 = 0;
  first.results.p2 = valid(123);
  const reset = createInitialMultiplayerState();
  assert.deepEqual(reset, {
    lives: { p1: 3, p2: 3 },
    results: { p1: null, p2: null },
  });
});

test('multiplayer timer invalidation prevents an old deadline from settling', () => {
  const scheduler = new FakeScheduler();
  const timers = new RoundTimerManager(scheduler);
  let settlements = 0;
  const oldRound = timers.beginRound();
  timers.schedule(oldRound, () => { settlements += 1; }, 500);
  timers.beginRound();
  scheduler.advance(500);
  assert.equal(settlements, 0);
});

test('ten consecutive multiplayer rounds preserve exact one-life penalties', () => {
  let lives = { p1: 20, p2: 20 };
  for (let round = 0; round < 10; round += 1) {
    const p1Wins = round % 2 === 0;
    const outcome = settleCompletedRound({
      p1: valid(p1Wins ? 100 : 200),
      p2: valid(p1Wins ? 200 : 100),
    });
    assert.ok(outcome);
    lives = applyRoundOutcome(lives, outcome);
  }
  assert.deepEqual(lives, { p1: 15, p2: 15 });
});
