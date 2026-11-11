import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_GAME_SETTINGS,
  DIFFICULTIES,
  getReactionDeadline,
  normalizeGameSettings,
  serializeGameSettings,
  type GameSettings,
} from '../settings/gameSettings.ts';
import {
  hydrateGameSettings,
  persistGameSettings,
  SETTINGS_STORAGE_KEY,
  type SettingsStorage,
} from '../settings/persistence.ts';

class MemoryStorage implements SettingsStorage {
  values = new Map<string, string>();
  writes: { key: string; value: string }[] = [];

  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    this.values.set(key, value);
    this.writes.push({ key, value });
  }
}

test('game settings defaults are complete and safe', () => {
  assert.deepEqual(DEFAULT_GAME_SETTINGS, {
    difficulty: 'easy',
    fakeSignalsEnabled: false,
    matchFormat: 'three-lives',
    soundEnabled: true,
    hapticsEnabled: true,
    visualEffectsEnabled: true,
  });
  assert.equal('randomWaitEnabled' in DEFAULT_GAME_SETTINGS, false);
});

test('valid versioned configuration loads without an unnecessary write', async () => {
  const storage = new MemoryStorage();
  const expected = {
    ...DEFAULT_GAME_SETTINGS,
    difficulty: 'insane' as const,
    matchFormat: 'best-of-five' as const,
    hapticsEnabled: false,
  };
  storage.values.set(SETTINGS_STORAGE_KEY, serializeGameSettings(expected));
  const loaded = await hydrateGameSettings(storage);
  assert.deepEqual(loaded.settings, expected);
  assert.equal(storage.writes.length, 0);
});

test('missing storage data hydrates defaults without overwriting storage', async () => {
  const storage = new MemoryStorage();
  const loaded = await hydrateGameSettings(storage);
  assert.deepEqual(loaded.settings, DEFAULT_GAME_SETTINGS);
  assert.equal(storage.writes.length, 0);
});

test('corrupted storage falls back safely and repairs the stored payload', async () => {
  const storage = new MemoryStorage();
  storage.values.set(SETTINGS_STORAGE_KEY, '{not-json');
  const loaded = await hydrateGameSettings(storage);
  assert.deepEqual(loaded.settings, DEFAULT_GAME_SETTINGS);
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.writes[0]?.value, serializeGameSettings(DEFAULT_GAME_SETTINGS));
});

test('invalid fields fall back individually and invalid fake signals remain off', () => {
  assert.deepEqual(normalizeGameSettings({
    difficulty: 'impossible',
    fakeSignalsEnabled: 'yes',
    matchFormat: 'forever',
    soundEnabled: false,
    hapticsEnabled: 'yes',
    visualEffectsEnabled: false,
  }), {
    ...DEFAULT_GAME_SETTINGS,
    soundEnabled: false,
    visualEffectsEnabled: false,
  });
});

test('fake signals can be enabled and persist through hydration', async () => {
  const storage = new MemoryStorage();
  const enabled = normalizeGameSettings({
    ...DEFAULT_GAME_SETTINGS,
    fakeSignalsEnabled: true,
  });
  assert.equal(enabled.fakeSignalsEnabled, true);
  await persistGameSettings(storage, enabled, null);
  const loaded = await hydrateGameSettings(storage);
  assert.equal(loaded.settings.fakeSignalsEnabled, true);
});

test('sound and visual effects preferences persist without changing other feedback settings', async () => {
  const storage = new MemoryStorage();
  const changed = {
    ...DEFAULT_GAME_SETTINGS,
    soundEnabled: false,
    visualEffectsEnabled: false,
  };
  await persistGameSettings(storage, changed, null);
  const loaded = await hydrateGameSettings(storage);
  assert.equal(loaded.settings.soundEnabled, false);
  assert.equal(loaded.settings.visualEffectsEnabled, false);
  assert.equal(loaded.settings.hapticsEnabled, true);
});

test('changed settings persist once and unchanged settings do not rewrite', async () => {
  const storage = new MemoryStorage();
  const initial = serializeGameSettings(DEFAULT_GAME_SETTINGS);
  const changed = { ...DEFAULT_GAME_SETTINGS, difficulty: 'hard' as const };
  const canonical = await persistGameSettings(storage, changed, initial);
  assert.equal(storage.writes.length, 1);
  await persistGameSettings(storage, changed, canonical);
  assert.equal(storage.writes.length, 1);
});

test('reset to defaults produces and persists the canonical default configuration', async () => {
  const changed = normalizeGameSettings({
    difficulty: 'insane',
    hapticsEnabled: false,
    fakeSignalsEnabled: true,
  });
  assert.notDeepEqual(changed, DEFAULT_GAME_SETTINGS);
  assert.equal(changed.fakeSignalsEnabled, true);
  assert.equal(DEFAULT_GAME_SETTINGS.fakeSignalsEnabled, false);
  assert.deepEqual(normalizeGameSettings(DEFAULT_GAME_SETTINGS), DEFAULT_GAME_SETTINGS);
  const storage = new MemoryStorage();
  const changedCanonical = serializeGameSettings(changed);
  await persistGameSettings(storage, DEFAULT_GAME_SETTINGS, changedCanonical);
  assert.equal(storage.writes[0]?.value, serializeGameSettings(DEFAULT_GAME_SETTINGS));
});

test('legacy medium and vibration settings migrate to normal and haptics', async () => {
  const storage = new MemoryStorage();
  storage.values.set(SETTINGS_STORAGE_KEY, JSON.stringify({
    difficulty: 'medium',
    vibrationEnabled: false,
    matchFormat: 'three-lives',
  }));
  const loaded = await hydrateGameSettings(storage);
  assert.equal(loaded.settings.difficulty, 'normal');
  assert.equal(loaded.settings.hapticsEnabled, false);
  assert.equal(storage.writes.length, 1);
});

test('difficulty profiles expose the required deadlines', () => {
  assert.deepEqual(DIFFICULTIES.map((difficulty) => getReactionDeadline(difficulty)), [500, 350, 250, 180]);
});

test('an active round keeps its captured deadline after settings change', () => {
  let settings: GameSettings = { ...DEFAULT_GAME_SETTINGS, difficulty: 'easy' };
  const capturedDeadline = getReactionDeadline(settings.difficulty);
  settings = { ...settings, difficulty: 'insane' as const };
  assert.equal(capturedDeadline, 500);
  assert.equal(getReactionDeadline(settings.difficulty), 180);
});

test('an active round keeps its captured fake-signal preference', () => {
  let settings: GameSettings = { ...DEFAULT_GAME_SETTINGS, fakeSignalsEnabled: true };
  const capturedFakeSignals = settings.fakeSignalsEnabled;
  settings = { ...settings, fakeSignalsEnabled: false };
  assert.equal(capturedFakeSignals, true);
  assert.equal(settings.fakeSignalsEnabled, false);
});
