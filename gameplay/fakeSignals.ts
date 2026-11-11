import { RoundTimerManager } from './RoundTimerManager';
import { signalColors } from '../constants/SignalColors';

export const FAKE_SIGNAL_COLORS = [
  { name: 'blue', value: signalColors.fake.blue },
  { name: 'purple', value: signalColors.fake.purple },
  { name: 'amber', value: signalColors.fake.amber },
] as const;

export type FakeSignalName = (typeof FAKE_SIGNAL_COLORS)[number]['name'];
export type FakeSignalColor = (typeof FAKE_SIGNAL_COLORS)[number]['value'];

export type FakeSignalEvent = {
  id: number;
  startMs: number;
  durationMs: number;
  color: FakeSignalColor;
  colorName: FakeSignalName;
};

const INITIAL_GAP_MIN_MS = 250;
const INITIAL_GAP_RANGE_MS = 250;
const FLASH_DURATION_MIN_MS = 100;
const FLASH_DURATION_RANGE_MS = 100;
const FLASH_SEPARATION_MIN_MS = 225;
const FLASH_SEPARATION_RANGE_MS = 375;
const REAL_SIGNAL_SAFETY_GAP_MS = 250;
const MAX_FAKE_SIGNALS = 3;

const clampRandom = (value: number) => Math.max(0, Math.min(0.999_999, value));

export function createFakeSignalSchedule(
  realSignalDelayMs: number,
  random: () => number = Math.random
) {
  const events: FakeSignalEvent[] = [];
  const latestEndMs = realSignalDelayMs - REAL_SIGNAL_SAFETY_GAP_MS;
  const desiredCount = 1 + Math.floor(clampRandom(random()) * MAX_FAKE_SIGNALS);
  let cursor = INITIAL_GAP_MIN_MS + clampRandom(random()) * INITIAL_GAP_RANGE_MS;

  for (let index = 0; index < desiredCount; index += 1) {
    const durationMs = FLASH_DURATION_MIN_MS + clampRandom(random()) * FLASH_DURATION_RANGE_MS;
    if (cursor + durationMs > latestEndMs) break;

    const color = FAKE_SIGNAL_COLORS[
      Math.floor(clampRandom(random()) * FAKE_SIGNAL_COLORS.length)
    ];
    events.push({
      id: index,
      startMs: cursor,
      durationMs,
      color: color.value,
      colorName: color.name,
    });

    cursor += durationMs + FLASH_SEPARATION_MIN_MS +
      clampRandom(random()) * FLASH_SEPARATION_RANGE_MS;
  }

  return { realSignalDelayMs, events };
}

export function selectFakeTarget<T>(first: T, second: T, random: () => number = Math.random) {
  return random() < 0.5 ? first : second;
}

export function isReleaseBeforeRealSignal(roundState: string) {
  return roundState === 'waiting';
}

export function scheduleFakeSignalEvents<T extends FakeSignalEvent>(
  timers: RoundTimerManager,
  roundId: number,
  events: readonly T[],
  onStart: (event: T) => void,
  onEnd: (event: T) => void
) {
  events.forEach((event) => {
    timers.schedule(roundId, () => onStart(event), event.startMs);
    timers.schedule(roundId, () => onEnd(event), event.startMs + event.durationMs);
  });
}
