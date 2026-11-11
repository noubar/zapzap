export const DIFFICULTIES = ['easy', 'normal', 'hard', 'insane'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const MATCH_FORMATS = [
  'three-lives',
  'single-round',
  'best-of-three',
  'best-of-five',
  'best-of-seven',
] as const;
export type MatchFormat = (typeof MATCH_FORMATS)[number];

export interface GameSettings {
  difficulty: Difficulty;
  fakeSignalsEnabled: boolean;
  matchFormat: MatchFormat;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  visualEffectsEnabled: boolean;
}

export const DIFFICULTY_PROFILES: Record<
  Difficulty,
  { label: string; reactionDeadlineMs: number }
> = {
  easy: { label: 'Easy', reactionDeadlineMs: 500 },
  normal: { label: 'Normal', reactionDeadlineMs: 350 },
  hard: { label: 'Hard', reactionDeadlineMs: 250 },
  insane: { label: 'Insane', reactionDeadlineMs: 180 },
};

export const MATCH_FORMAT_LABELS: Record<MatchFormat, string> = {
  'three-lives': 'Three Lives',
  'single-round': 'Single Round',
  'best-of-three': 'Best of 3',
  'best-of-five': 'Best of 5',
  'best-of-seven': 'Best of 7',
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  difficulty: 'easy',
  fakeSignalsEnabled: false,
  matchFormat: 'three-lives',
  soundEnabled: true,
  hapticsEnabled: true,
  visualEffectsEnabled: true,
};

export const SETTINGS_VERSION = 1;

const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && DIFFICULTIES.includes(value as Difficulty);

const isMatchFormat = (value: unknown): value is MatchFormat =>
  typeof value === 'string' && MATCH_FORMATS.includes(value as MatchFormat);

const booleanOr = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

export function normalizeGameSettings(value: unknown): GameSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_GAME_SETTINGS };
  const candidate = value as Record<string, unknown>;
  const legacyDifficulty = candidate.difficulty === 'medium' ? 'normal' : candidate.difficulty;

  return {
    difficulty: isDifficulty(legacyDifficulty)
      ? legacyDifficulty
      : DEFAULT_GAME_SETTINGS.difficulty,
    fakeSignalsEnabled: booleanOr(
      candidate.fakeSignalsEnabled,
      DEFAULT_GAME_SETTINGS.fakeSignalsEnabled
    ),
    matchFormat: isMatchFormat(candidate.matchFormat)
      ? candidate.matchFormat
      : DEFAULT_GAME_SETTINGS.matchFormat,
    soundEnabled: booleanOr(candidate.soundEnabled, DEFAULT_GAME_SETTINGS.soundEnabled),
    hapticsEnabled: booleanOr(
      candidate.hapticsEnabled ?? candidate.vibrationEnabled,
      DEFAULT_GAME_SETTINGS.hapticsEnabled
    ),
    visualEffectsEnabled: booleanOr(
      candidate.visualEffectsEnabled,
      DEFAULT_GAME_SETTINGS.visualEffectsEnabled
    ),
  };
}

export function serializeGameSettings(settings: GameSettings) {
  return JSON.stringify({ version: SETTINGS_VERSION, settings: normalizeGameSettings(settings) });
}

export function deserializeGameSettings(raw: string | null) {
  if (raw === null) {
    return { settings: { ...DEFAULT_GAME_SETTINGS }, needsWrite: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { settings: { ...DEFAULT_GAME_SETTINGS }, needsWrite: true };
    }
    const record = parsed as Record<string, unknown>;
    const source = record.settings && typeof record.settings === 'object'
      ? record.settings
      : record;
    const settings = normalizeGameSettings(source);
    return {
      settings,
      needsWrite: record.version !== SETTINGS_VERSION || raw !== serializeGameSettings(settings),
    };
  } catch {
    return { settings: { ...DEFAULT_GAME_SETTINGS }, needsWrite: true };
  }
}

export function getReactionDeadline(difficulty: Difficulty) {
  return DIFFICULTY_PROFILES[difficulty].reactionDeadlineMs;
}
