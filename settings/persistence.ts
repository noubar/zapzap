import {
  deserializeGameSettings,
  serializeGameSettings,
  type GameSettings,
} from './gameSettings';

export const SETTINGS_STORAGE_KEY = 'zapzap.game-settings';

export interface SettingsStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export async function hydrateGameSettings(storage: SettingsStorage) {
  const raw = await storage.getItem(SETTINGS_STORAGE_KEY);
  const loaded = deserializeGameSettings(raw);
  const canonical = serializeGameSettings(loaded.settings);

  if (loaded.needsWrite) {
    await storage.setItem(SETTINGS_STORAGE_KEY, canonical);
  }

  return { settings: loaded.settings, canonical };
}

export async function persistGameSettings(
  storage: SettingsStorage,
  settings: GameSettings,
  previousCanonical: string | null
) {
  const canonical = serializeGameSettings(settings);
  if (canonical !== previousCanonical) {
    await storage.setItem(SETTINGS_STORAGE_KEY, canonical);
  }
  return canonical;
}
