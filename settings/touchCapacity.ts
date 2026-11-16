export const TOUCH_CAPACITY_STORAGE_KEY = 'zapzap.observed-touch-capacity';
export const MAX_OBSERVED_TOUCH_CAPACITY = 8;

export function normalizeObservedTouchCapacity(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 2) return null;
  return Math.min(MAX_OBSERVED_TOUCH_CAPACITY, Math.floor(numeric));
}

export interface TouchCalibrationState {
  activePointerIds: ReadonlySet<number>;
  highestObserved: number;
}

export function createTouchCalibrationState(highestObserved = 0): TouchCalibrationState {
  return { activePointerIds: new Set(), highestObserved };
}

export function addCalibrationPointers(
  state: TouchCalibrationState,
  pointerIds: readonly number[]
): TouchCalibrationState {
  const activePointerIds = new Set(state.activePointerIds);
  pointerIds.forEach((id) => activePointerIds.add(id));
  return {
    activePointerIds,
    highestObserved: Math.max(state.highestObserved, activePointerIds.size),
  };
}

export function removeCalibrationPointers(
  state: TouchCalibrationState,
  pointerIds: readonly number[]
): TouchCalibrationState {
  const activePointerIds = new Set(state.activePointerIds);
  pointerIds.forEach((id) => activePointerIds.delete(id));
  return { ...state, activePointerIds };
}
