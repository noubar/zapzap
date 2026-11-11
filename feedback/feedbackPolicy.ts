export type FeedbackEvent =
  | 'go'
  | 'success'
  | 'false-start'
  | 'timeout'
  | 'wrong-finger'
  | 'round-won'
  | 'match-won'
  | 'match-draw'
  | 'menu';

export type SoundName =
  | 'go'
  | 'success'
  | 'error'
  | 'timeout'
  | 'wrong'
  | 'roundWin'
  | 'matchWin'
  | 'draw'
  | 'menu';

export type HapticName = 'signal' | 'success' | 'error' | 'round-win' | 'match-win' | 'selection';

export type FeedbackPreferences = {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
};

const SOUND_BY_EVENT: Record<FeedbackEvent, SoundName> = {
  go: 'go',
  success: 'success',
  'false-start': 'error',
  timeout: 'timeout',
  'wrong-finger': 'wrong',
  'round-won': 'roundWin',
  'match-won': 'matchWin',
  'match-draw': 'draw',
  menu: 'menu',
};

const HAPTIC_BY_EVENT: Record<FeedbackEvent, HapticName> = {
  go: 'signal',
  success: 'success',
  'false-start': 'error',
  timeout: 'error',
  'wrong-finger': 'error',
  'round-won': 'round-win',
  'match-won': 'match-win',
  'match-draw': 'round-win',
  menu: 'selection',
};

export function getFeedbackPlan(
  event: FeedbackEvent,
  preferences: FeedbackPreferences,
  fakeSignalsEnabled: boolean
) {
  const signalSuppressed = event === 'go' && fakeSignalsEnabled;
  return {
    sound: preferences.soundEnabled && !signalSuppressed ? SOUND_BY_EVENT[event] : null,
    haptic: preferences.hapticsEnabled && !signalSuppressed ? HAPTIC_BY_EVENT[event] : null,
  } as const;
}

export class FeedbackEventGate {
  private generation = 0;
  private seen = new Set<string>();

  beginSession() {
    this.generation += 1;
    this.seen.clear();
    return this.generation;
  }

  isCurrent(generation: number) {
    return generation === this.generation;
  }

  accept(generation: number, eventId?: string) {
    if (!this.isCurrent(generation)) return false;
    if (!eventId) return true;
    if (this.seen.has(eventId)) return false;
    this.seen.add(eventId);
    return true;
  }

  invalidate() {
    this.generation += 1;
    this.seen.clear();
  }
}

