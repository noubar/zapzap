import assert from 'node:assert/strict';
import test from 'node:test';

import { AudioPlaybackCoordinator, type FeedbackAudioPlayer } from '../feedback/audioPlayback.ts';
import {
  FeedbackEventGate,
  getFeedbackPlan,
  type SoundName,
} from '../feedback/feedbackPolicy.ts';
import { getVisualFeedbackPlan } from '../feedback/visualFeedback.ts';

const enabled = { soundEnabled: true, hapticsEnabled: true };

test('sound and haptic preferences independently allow or suppress feedback', () => {
  assert.deepEqual(getFeedbackPlan('success', enabled, false), { sound: 'success', haptic: 'success' });
  assert.deepEqual(getFeedbackPlan('success', { soundEnabled: false, hapticsEnabled: true }, false), {
    sound: null, haptic: 'success',
  });
  assert.deepEqual(getFeedbackPlan('success', { soundEnabled: true, hapticsEnabled: false }, false), {
    sound: 'success', haptic: null,
  });
});

test('feedback events map to distinct result sounds', () => {
  assert.equal(getFeedbackPlan('false-start', enabled, false).sound, 'error');
  assert.equal(getFeedbackPlan('timeout', enabled, false).sound, 'timeout');
  assert.equal(getFeedbackPlan('wrong-finger', enabled, false).sound, 'wrong');
  assert.equal(getFeedbackPlan('round-won', enabled, false).sound, 'roundWin');
  assert.equal(getFeedbackPlan('match-won', enabled, false).sound, 'matchWin');
  assert.equal(getFeedbackPlan('match-draw', enabled, false).sound, 'draw');
});

test('fake signals suppress GO sound and haptic but preserve outcome feedback', () => {
  assert.deepEqual(getFeedbackPlan('go', enabled, true), { sound: null, haptic: null });
  assert.deepEqual(getFeedbackPlan('success', enabled, true), { sound: 'success', haptic: 'success' });
  assert.deepEqual(getFeedbackPlan('go', enabled, false), { sound: 'go', haptic: 'signal' });
});

test('one event identifier is accepted only once per shared multiplayer session', () => {
  const gate = new FeedbackEventGate();
  const session = gate.beginSession();
  assert.equal(gate.accept(session, 'round-4:go'), true);
  assert.equal(gate.accept(session, 'round-4:go'), false);
});

test('stale feedback sessions cannot affect a later round', () => {
  const gate = new FeedbackEventGate();
  const stale = gate.beginSession();
  const current = gate.beginSession();
  assert.equal(gate.accept(stale, 'outcome'), false);
  assert.equal(gate.accept(current, 'outcome'), true);
});

function makePlayers(overrides: Partial<FeedbackAudioPlayer> = {}) {
  const calls = { play: 0, pause: 0, seek: 0 };
  const player: FeedbackAudioPlayer = {
    play: () => { calls.play += 1; },
    pause: () => { calls.pause += 1; },
    seekTo: async () => { calls.seek += 1; },
    ...overrides,
  };
  const names: SoundName[] = ['go', 'success', 'error', 'timeout', 'wrong', 'roundWin', 'matchWin', 'draw', 'menu'];
  return {
    calls,
    players: Object.fromEntries(names.map((name) => [name, player])) as Record<SoundName, FeedbackAudioPlayer>,
  };
}

test('audio playback failures are isolated from gameplay', async () => {
  const { calls, players } = makePlayers({ seekTo: async () => { calls.seek += 1; throw new Error('audio unavailable'); } });
  const audio = new AudioPlaybackCoordinator(players);
  assert.doesNotThrow(() => audio.play('go', () => true));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.play, 0);
});

test('turning sound off while playback prepares suppresses the pending sound', async () => {
  let resolveSeek: (() => void) | undefined;
  const { calls, players } = makePlayers({ seekTo: () => new Promise<void>((resolve) => { resolveSeek = resolve; }) });
  const audio = new AudioPlaybackCoordinator(players);
  let soundEnabled = true;
  audio.play('go', () => soundEnabled);
  soundEnabled = false;
  resolveSeek?.();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.play, 0);
});

test('audio cleanup pauses players and cancels stale prepared playback', async () => {
  let resolveSeek: (() => void) | undefined;
  const { calls, players } = makePlayers({ seekTo: () => new Promise<void>((resolve) => { resolveSeek = resolve; }) });
  const audio = new AudioPlaybackCoordinator(players);
  audio.play('success', () => true);
  audio.cancelAll();
  resolveSeek?.();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.play, 0);
  assert.equal(calls.pause, 9);
});

test('visual effects setting and reduced motion disable only optional animation', () => {
  assert.equal(getVisualFeedbackPlan('success', true, false).animate, true);
  assert.equal(getVisualFeedbackPlan('failure', false, false).animate, false);
  assert.equal(getVisualFeedbackPlan('victory', true, true).animate, false);
  assert.equal(getVisualFeedbackPlan('success', false, false).essentialLabel, 'SUCCESS');
  assert.equal(getVisualFeedbackPlan('failure', false, false).essentialLabel, 'FAILED');
});

