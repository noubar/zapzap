import type { GeneralPlayerId } from './multiplayerEngine';
import { hitTestRadialSector, type RadialArenaGeometry } from './radialGeometry';

export interface RadialPointerOwnership {
  generation: number;
  pointerToPlayer: ReadonlyMap<number, GeneralPlayerId>;
  playerToPointer: ReadonlyMap<GeneralPlayerId, number>;
}

export function createRadialPointerOwnership(generation = 0): RadialPointerOwnership {
  return {
    generation,
    pointerToPlayer: new Map(),
    playerToPointer: new Map(),
  };
}

export function assignRadialPointer(
  state: RadialPointerOwnership,
  generation: number,
  pointerId: number,
  x: number,
  y: number,
  geometry: RadialArenaGeometry,
  playerIds: readonly GeneralPlayerId[],
  activePlayerIds: ReadonlySet<GeneralPlayerId>
) {
  if (generation !== state.generation || state.pointerToPlayer.has(pointerId)) {
    return { state, playerId: null } as const;
  }
  const sectorIndex = hitTestRadialSector(geometry, x, y);
  const playerId = sectorIndex === null ? null : playerIds[sectorIndex] ?? null;
  if (!playerId || !activePlayerIds.has(playerId) || state.playerToPointer.has(playerId)) {
    return { state, playerId: null } as const;
  }
  const pointerToPlayer = new Map(state.pointerToPlayer);
  const playerToPointer = new Map(state.playerToPointer);
  pointerToPlayer.set(pointerId, playerId);
  playerToPointer.set(playerId, pointerId);
  return {
    state: { ...state, pointerToPlayer, playerToPointer },
    playerId,
  } as const;
}

export function releaseRadialPointer(
  state: RadialPointerOwnership,
  generation: number,
  pointerId: number
) {
  if (generation !== state.generation) return { state, playerId: null } as const;
  const playerId = state.pointerToPlayer.get(pointerId) ?? null;
  if (!playerId) return { state, playerId: null } as const;
  const pointerToPlayer = new Map(state.pointerToPlayer);
  const playerToPointer = new Map(state.playerToPointer);
  pointerToPlayer.delete(pointerId);
  playerToPointer.delete(playerId);
  return {
    state: { ...state, pointerToPlayer, playerToPointer },
    playerId,
  } as const;
}

export function invalidateRadialPointers(state: RadialPointerOwnership) {
  return createRadialPointerOwnership(state.generation + 1);
}
