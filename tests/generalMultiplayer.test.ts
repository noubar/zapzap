import assert from 'node:assert/strict';
import test from 'node:test';

import {
  areGeneralPlayersReady,
  beginGeneralRound,
  cancelGeneralRound,
  createGeneralMultiplayerSession,
  fillGeneralTimeouts,
  getGeneralPlayer,
  isGeneralRoundComplete,
  prepareNextGeneralRound,
  rankGeneralRound,
  recordGeneralRoundResult,
  resetGeneralMultiplayerSession,
  setGeneralPlayerHolding,
  settleGeneralRound,
  startGeneralSignal,
  type GeneralMultiplayerSession,
  type GeneralPlayerId,
} from '../gameplay/multiplayerEngine.ts';
import type { PlayerRoundResult } from '../gameplay/multiplayer.ts';
import type { MatchFormat } from '../settings/gameSettings.ts';
import {
  calculateOneFingerPlayerCapacity,
  calculateEffectivePlayerCapacity,
  clampPlayerCount,
  getOneFingerMultiplayerHref,
  parseStoredPlayerCount,
} from '../settings/playerCount.ts';

const valid = (reactionTime: number): PlayerRoundResult => ({ kind: 'valid', reactionTime });
const invalid = (reason: 'false-start' | 'timeout' | 'cancelled'): PlayerRoundResult => ({
  kind: 'invalid', reason,
});

function readySession(playerCount: number, format: MatchFormat = 'three-lives') {
  let session = createGeneralMultiplayerSession(playerCount, format);
  session.players.forEach((player) => {
    session = setGeneralPlayerHolding(session, player.id, true);
  });
  return session;
}

function waitingSession(playerCount: number, format: MatchFormat = 'three-lives') {
  return beginGeneralRound(readySession(playerCount, format), 7);
}

function recordResults(session: GeneralMultiplayerSession, results: PlayerRoundResult[]) {
  results.forEach((result, index) => {
    session = recordGeneralRoundResult(session, `p${index + 1}` as GeneralPlayerId, result);
  });
  return session;
}

test('generalized sessions initialize dynamic 2, 3, 4, and 8 player arrays', () => {
  for (const count of [2, 3, 4, 8]) {
    const session = createGeneralMultiplayerSession(count, 'three-lives');
    assert.equal(session.players.length, count);
    assert.deepEqual(session.players.map((player) => player.id),
      Array.from({ length: count }, (_, index) => `p${index + 1}`));
    assert.ok(session.players.every((player) => player.lives === 3 && player.isActive));
  }
  assert.throws(() => createGeneralMultiplayerSession(9, 'three-lives'), RangeError);
});

test('every active player must be independently ready', () => {
  let session = createGeneralMultiplayerSession(4, 'three-lives');
  ['p1', 'p2', 'p3'].forEach((id) => {
    session = setGeneralPlayerHolding(session, id as GeneralPlayerId, true);
  });
  assert.equal(areGeneralPlayersReady(session), false);
  session = setGeneralPlayerHolding(session, 'p4', true);
  assert.equal(areGeneralPlayersReady(session), true);
});

test('waiting and GO use one authoritative round id and signal timestamp', () => {
  const waiting = waitingSession(3);
  assert.equal(waiting.phase, 'waiting');
  assert.equal(waiting.roundId, 7);
  const signaled = startGeneralSignal(waiting, 1_234.5);
  assert.equal(signaled.phase, 'go');
  assert.equal(signaled.signalTimestamp, 1_234.5);
  assert.ok(signaled.players.every((player) => player.roundResult === null));
});

test('independent results accept simultaneous releases and reject duplicates', () => {
  let session = startGeneralSignal(waitingSession(4), 1_000);
  session = recordGeneralRoundResult(session, 'p1', valid(120));
  session = recordGeneralRoundResult(session, 'p2', valid(120));
  session = recordGeneralRoundResult(session, 'p3', valid(140));
  session = recordGeneralRoundResult(session, 'p4', valid(160));
  session = recordGeneralRoundResult(session, 'p1', valid(10));
  assert.equal(getGeneralPlayer(session, 'p1')?.reactionTimeMs, 120);
  assert.equal(isGeneralRoundComplete(session), true);
});

test('invalid phase transitions are ignored', () => {
  const idle = readySession(3);
  assert.equal(startGeneralSignal(idle, 100), idle);
  assert.equal(recordGeneralRoundResult(idle, 'p1', valid(10)), idle);
  const notReady = createGeneralMultiplayerSession(3, 'three-lives');
  assert.equal(beginGeneralRound(notReady, 1), notReady);
});

test('valid reactions rank ascending and exact times share placement', () => {
  const session = recordResults(startGeneralSignal(waitingSession(4), 1_000), [
    valid(180), valid(120), valid(120), valid(220),
  ]);
  assert.deepEqual(rankGeneralRound(session.players), [
    { rank: 1, playerIds: ['p2', 'p3'], reactionTimeMs: 120 },
    { rank: 2, playerIds: ['p1'], reactionTimeMs: 180 },
    { rank: 3, playerIds: ['p4'], reactionTimeMs: 220 },
  ]);
});

test('three valid players penalize only the slowest valid reaction', () => {
  const session = recordResults(startGeneralSignal(waitingSession(3), 1_000), [
    valid(100), valid(150), valid(200),
  ]);
  const settled = settleGeneralRound(session);
  assert.ok(settled);
  assert.deepEqual(settled.outcome.winnerIds, ['p1']);
  assert.deepEqual(settled.outcome.penalizedIds, ['p3']);
  assert.deepEqual(settled.session.players.map((player) => player.lives), [3, 3, 2]);
});

test('exactly tied slowest players receive the same life penalty', () => {
  const session = recordResults(startGeneralSignal(waitingSession(4), 1_000), [
    valid(100), valid(130), valid(200), valid(200),
  ]);
  const settled = settleGeneralRound(session);
  assert.ok(settled);
  assert.deepEqual(settled.outcome.penalizedIds, ['p3', 'p4']);
});

test('one or more invalid players are penalized without penalizing valid players', () => {
  for (const results of [
    [invalid('false-start'), valid(120), valid(180)],
    [invalid('false-start'), invalid('timeout'), valid(180)],
  ]) {
    const session = recordResults(startGeneralSignal(waitingSession(3), 1_000), results);
    const settled = settleGeneralRound(session);
    assert.ok(settled);
    assert.deepEqual(settled.outcome.penalizedIds,
      results.flatMap((result, index) => result.kind === 'invalid' ? [`p${index + 1}`] : []));
  }
});

test('a false starter is excluded while remaining players stay ready for the shared GO', () => {
  let session = waitingSession(3);
  session = recordGeneralRoundResult(session, 'p1', invalid('false-start'));
  assert.equal(areGeneralPlayersReady(session), true);
  assert.equal(session.phase, 'waiting');
  session = startGeneralSignal(session, 2_000);
  assert.equal(session.phase, 'go');
  assert.equal(getGeneralPlayer(session, 'p1')?.roundResult?.kind, 'invalid');
});

test('deadline filling marks every unresolved active player timeout once', () => {
  let session = startGeneralSignal(waitingSession(4), 1_000);
  session = recordGeneralRoundResult(session, 'p1', valid(100));
  session = fillGeneralTimeouts(session);
  session = fillGeneralTimeouts(session);
  assert.equal(getGeneralPlayer(session, 'p1')?.roundResult?.kind, 'valid');
  assert.ok(session.players.slice(1).every((player) =>
    player.roundResult?.kind === 'invalid' && player.roundResult.reason === 'timeout'));
});

test('eliminated players are removed from later readiness requirements', () => {
  let session = startGeneralSignal(waitingSession(3), 1_000);
  session = {
    ...session,
    players: session.players.map((player) => player.id === 'p3' ? { ...player, lives: 1 } : player),
  };
  session = recordResults(session, [valid(100), valid(150), valid(220)]);
  const settled = settleGeneralRound(session);
  assert.ok(settled);
  assert.equal(getGeneralPlayer(settled.session, 'p3')?.isEliminated, true);
  let next = prepareNextGeneralRound(settled.session);
  next = setGeneralPlayerHolding(next, 'p1', true);
  next = setGeneralPlayerHolding(next, 'p2', true);
  assert.equal(areGeneralPlayersReady(next), true);
});

test('last survivor wins and simultaneous elimination is a draw', () => {
  let victory = startGeneralSignal(waitingSession(3), 1_000);
  victory = {
    ...victory,
    players: victory.players.map((player) => player.id === 'p1' ? player : { ...player, lives: 1 }),
  };
  victory = recordResults(victory, [valid(100), invalid('timeout'), invalid('timeout')]);
  const won = settleGeneralRound(victory);
  assert.ok(won);
  assert.equal(won.outcome.isMatchComplete, true);
  assert.deepEqual(won.outcome.matchWinnerIds, ['p1']);

  let draw = startGeneralSignal(waitingSession(3), 1_000);
  draw = { ...draw, players: draw.players.map((player) => ({ ...player, lives: 1 })) };
  draw = recordResults(draw, [invalid('timeout'), invalid('timeout'), invalid('timeout')]);
  const drawn = settleGeneralRound(draw);
  assert.ok(drawn);
  assert.equal(drawn.outcome.isMatchDraw, true);
  assert.deepEqual(drawn.outcome.matchWinnerIds, []);
});

test('legacy two-player equal valid reactions preserve no-penalty draw behavior', () => {
  const session = recordResults(startGeneralSignal(waitingSession(2), 1_000), [valid(100), valid(100)]);
  const settled = settleGeneralRound(session);
  assert.ok(settled);
  assert.deepEqual(settled.outcome.penalizedIds, []);
  assert.deepEqual(settled.session.players.map((player) => player.lives), [3, 3]);
});

test('single round supports wins, exact ties, and all-invalid draws for 3 and 4 players', () => {
  for (const count of [3, 4]) {
    const winResults = Array.from({ length: count }, (_, index) => valid(100 + index * 10));
    const win = settleGeneralRound(recordResults(startGeneralSignal(waitingSession(count, 'single-round'), 1), winResults));
    assert.ok(win);
    assert.deepEqual(win.outcome.matchWinnerIds, ['p1']);

    const tieResults = Array.from({ length: count }, (_, index) => valid(index < 2 ? 100 : 150));
    const tie = settleGeneralRound(recordResults(startGeneralSignal(waitingSession(count, 'single-round'), 1), tieResults));
    assert.ok(tie);
    assert.equal(tie.outcome.isMatchDraw, true);

    const invalidResults = Array.from({ length: count }, () => invalid('timeout'));
    const allInvalid = settleGeneralRound(recordResults(startGeneralSignal(waitingSession(count, 'single-round'), 1), invalidResults));
    assert.ok(allInvalid);
    assert.equal(allInvalid.outcome.isMatchDraw, true);
  }
});

test('best-of formats use first-to-two, three, and four wins for 3 and 4 players', () => {
  const formats = [
    ['best-of-three', 2], ['best-of-five', 3], ['best-of-seven', 4],
  ] as const;
  for (const count of [3, 4]) {
    for (const [format, target] of formats) {
      let session = startGeneralSignal(waitingSession(count, format), 1);
      session = {
        ...session,
        players: session.players.map((player) =>
          player.id === 'p1' ? { ...player, roundWins: target - 1 } : player),
      };
      session = recordResults(session, Array.from({ length: count }, (_, index) => valid(100 + index * 10)));
      const settled = settleGeneralRound(session);
      assert.ok(settled);
      assert.equal(getGeneralPlayer(settled.session, 'p1')?.roundWins, target);
      assert.deepEqual(settled.outcome.matchWinnerIds, ['p1']);
    }
  }
});

test('best-of tied fastest results award no win and cannot finish', () => {
  const session = recordResults(startGeneralSignal(waitingSession(4, 'best-of-three'), 1), [
    valid(100), valid(100), valid(140), invalid('timeout'),
  ]);
  const settled = settleGeneralRound(session);
  assert.ok(settled);
  assert.ok(settled.session.players.every((player) => player.roundWins === 0));
  assert.equal(settled.outcome.isMatchComplete, false);
});

test('round cancellation and match reset clear transient input without stale results', () => {
  let session = startGeneralSignal(waitingSession(4), 1_000);
  session = recordGeneralRoundResult(session, 'p1', valid(100));
  const cancelled = cancelGeneralRound(session);
  assert.equal(cancelled.phase, 'idle');
  assert.ok(cancelled.players.every((player) => !player.isHolding && player.roundResult === null));
  const reset = resetGeneralMultiplayerSession(cancelled);
  assert.equal(reset.roundsPlayed, 0);
  assert.ok(reset.players.every((player) => player.lives === 3 && player.roundWins === 0));
});

test('capacity and persisted selection reject unsupported player counts', () => {
  assert.equal(calculateOneFingerPlayerCapacity(430, 932), 4);
  assert.equal(calculateOneFingerPlayerCapacity(614, 1_000), 6);
  assert.equal(calculateOneFingerPlayerCapacity(768, 1_024), 8);
  assert.equal(calculateOneFingerPlayerCapacity(270, 600), 3);
  assert.equal(calculateOneFingerPlayerCapacity(220, 400), 2);
  assert.equal(calculateOneFingerPlayerCapacity(Number.NaN, 800), 2);
  assert.equal(calculateEffectivePlayerCapacity(8, null), 4);
  assert.equal(calculateEffectivePlayerCapacity(8, 6), 6);
  assert.equal(calculateEffectivePlayerCapacity(6, 8), 6);
  assert.equal(clampPlayerCount(9), 8);
  assert.equal(clampPlayerCount(4, 3), 3);
  assert.equal(parseStoredPlayerCount('3'), 3);
  assert.equal(parseStoredPlayerCount('bad'), 2);
  assert.equal(getOneFingerMultiplayerHref(2), '/OneFingerTwoPlayerGame');
  assert.equal(getOneFingerMultiplayerHref(2, 8, true), '/OneFingerMultiplayerGame?players=2');
  assert.equal(getOneFingerMultiplayerHref(3), '/OneFingerMultiplayerGame?players=3');
  assert.equal(getOneFingerMultiplayerHref(8), '/OneFingerMultiplayerGame?players=8');
  assert.equal(getOneFingerMultiplayerHref(8, 4), '/OneFingerMultiplayerGame?players=4');
});

test('eight-player match settles and transitions to a fresh remaining-player round', () => {
  let session = startGeneralSignal(waitingSession(8), 1_000);
  session = recordResults(session, Array.from({ length: 8 }, (_, index) => valid(100 + index * 10)));
  const settled = settleGeneralRound(session);
  assert.ok(settled);
  assert.deepEqual(settled.outcome.winnerIds, ['p1']);
  assert.deepEqual(settled.outcome.penalizedIds, ['p8']);
  assert.equal(getGeneralPlayer(settled.session, 'p8')?.lives, 2);

  let next = prepareNextGeneralRound(settled.session);
  next.players.forEach((player) => { next = setGeneralPlayerHolding(next, player.id, true); });
  assert.equal(areGeneralPlayersReady(next), true);
  const waiting = beginGeneralRound(next, 8);
  assert.equal(waiting.phase, 'waiting');
  assert.equal(waiting.roundId, 8);
});

test('eight-player rounds support missing readiness, invalid groups, and exact ties', () => {
  let sevenReady = createGeneralMultiplayerSession(8, 'three-lives');
  sevenReady.players.slice(0, 7).forEach((player) => {
    sevenReady = setGeneralPlayerHolding(sevenReady, player.id, true);
  });
  assert.equal(areGeneralPlayersReady(sevenReady), false);

  const results = [
    valid(100), valid(100), valid(130), valid(140),
    invalid('false-start'), invalid('timeout'), valid(180), valid(200),
  ];
  const settled = settleGeneralRound(recordResults(startGeneralSignal(waitingSession(8), 1), results));
  assert.ok(settled);
  assert.deepEqual(settled.outcome.winnerIds, ['p1', 'p2']);
  assert.deepEqual(settled.outcome.penalizedIds, ['p5', 'p6']);
  assert.equal(settled.outcome.isRoundDraw, true);
});

test('all five formats settle correctly with eight-player data', () => {
  const formats: MatchFormat[] = [
    'three-lives', 'single-round', 'best-of-three', 'best-of-five', 'best-of-seven',
  ];
  for (const format of formats) {
    const session = recordResults(
      startGeneralSignal(waitingSession(8, format), 1),
      Array.from({ length: 8 }, (_, index) => valid(100 + index * 10))
    );
    const settled = settleGeneralRound(session);
    assert.ok(settled);
    assert.deepEqual(settled.outcome.winnerIds, ['p1']);
    if (format === 'three-lives') assert.deepEqual(settled.outcome.penalizedIds, ['p8']);
    if (format === 'single-round') assert.deepEqual(settled.outcome.matchWinnerIds, ['p1']);
  }
});
