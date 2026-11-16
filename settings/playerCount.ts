export const MIN_ONE_FINGER_MULTIPLAYER_PLAYERS = 2;
export const MAX_ONE_FINGER_MULTIPLAYER_PLAYERS = 8;
export const SMARTPHONE_MAX_PLAYERS = 4;
export const DEFAULT_ONE_FINGER_MULTIPLAYER_PLAYERS = 2;
export const PLAYER_COUNT_STORAGE_KEY = 'zapzap.one-finger-multiplayer-players';

const MIN_FOUR_PLAYER_REGION_WIDTH = 140;
const MIN_FOUR_PLAYER_REGION_HEIGHT = 180;
const MIN_THREE_PLAYER_REGION_WIDTH = 130;
const MIN_THREE_PLAYER_REGION_HEIGHT = 130;
const MIN_RADIAL_SHORT_EDGE = 600;
const MIN_RADIAL_LONG_EDGE = 700;
const MIN_RADIAL_DEPTH = 180;
const MIN_MID_ARC_LENGTH = 160;

export function calculateOneFingerPlayerCapacity(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return MIN_ONE_FINGER_MULTIPLAYER_PLAYERS;
  }
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  const fourPlayerFits = shortEdge / 2 >= MIN_FOUR_PLAYER_REGION_WIDTH &&
    longEdge / 2 >= MIN_FOUR_PLAYER_REGION_HEIGHT;
  let rectangularCapacity = SMARTPHONE_MAX_PLAYERS;
  if (!fourPlayerFits) {
    const threePlayerFits = shortEdge / 2 >= MIN_THREE_PLAYER_REGION_WIDTH &&
      longEdge / 3 >= MIN_THREE_PLAYER_REGION_HEIGHT;
    rectangularCapacity = threePlayerFits ? 3 : MIN_ONE_FINGER_MULTIPLAYER_PLAYERS;
  }

  if (shortEdge < MIN_RADIAL_SHORT_EDGE || longEdge < MIN_RADIAL_LONG_EDGE) {
    return rectangularCapacity;
  }
  const outerRadius = shortEdge / 2 - 16;
  const innerRadius = outerRadius * 0.2;
  const radialDepth = outerRadius - innerRadius;
  if (radialDepth < MIN_RADIAL_DEPTH) return rectangularCapacity;
  const midRadius = (outerRadius + innerRadius) / 2;
  for (let count = MAX_ONE_FINGER_MULTIPLAYER_PLAYERS; count >= 5; count -= 1) {
    if ((2 * Math.PI * midRadius) / count >= MIN_MID_ARC_LENGTH) return count;
  }
  return rectangularCapacity;
}

export function calculateEffectivePlayerCapacity(
  screenSpaceCapacity: number,
  observedTouchCapacity: number | null
) {
  const geometryLimit = clampPlayerCount(screenSpaceCapacity, MAX_ONE_FINGER_MULTIPLAYER_PLAYERS);
  if (geometryLimit <= SMARTPHONE_MAX_PLAYERS) return geometryLimit;
  if (observedTouchCapacity === null || observedTouchCapacity <= SMARTPHONE_MAX_PLAYERS) {
    return SMARTPHONE_MAX_PLAYERS;
  }
  return Math.min(geometryLimit, observedTouchCapacity, MAX_ONE_FINGER_MULTIPLAYER_PLAYERS);
}

export function clampPlayerCount(value: unknown, maximum = MAX_ONE_FINGER_MULTIPLAYER_PLAYERS) {
  const supportedMaximum = Math.max(MIN_ONE_FINGER_MULTIPLAYER_PLAYERS, Math.floor(maximum));
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_ONE_FINGER_MULTIPLAYER_PLAYERS;
  return Math.max(
    MIN_ONE_FINGER_MULTIPLAYER_PLAYERS,
    Math.min(supportedMaximum, Math.round(numeric))
  );
}

export function parseStoredPlayerCount(raw: string | null, maximum?: number) {
  return clampPlayerCount(raw, maximum);
}

export function getOneFingerMultiplayerHref(
  value: unknown,
  maximum?: number,
  useGeneralizedTwoPlayer = false
) {
  const playerCount = clampPlayerCount(value, maximum);
  return playerCount === 2 && !useGeneralizedTwoPlayer
    ? '/OneFingerTwoPlayerGame'
    : `/OneFingerMultiplayerGame?players=${playerCount}`;
}
