import * as Haptics from 'expo-haptics';
import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
  type AudioPlayer,
} from 'expo-audio';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import { AppState, Platform } from 'react-native';

import { useGlobalSettings } from '../app/GlobalSettings';
import {
  FeedbackEventGate,
  getFeedbackPlan,
  type FeedbackEvent,
  type HapticName,
  type SoundName,
} from './feedbackPolicy';
import { AudioPlaybackCoordinator } from './audioPlayback';

type EmitOptions = {
  fakeSignalsEnabled?: boolean;
  eventId?: string;
  session?: number;
};

type FeedbackContextValue = {
  beginFeedbackSession: () => number;
  cancelFeedback: () => void;
  emitFeedback: (event: FeedbackEvent, options?: EmitOptions) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function runHaptic(name: HapticName) {
  if (Platform.OS === 'android') {
    const androidType = {
      signal: Haptics.AndroidHaptics.Virtual_Key,
      success: Haptics.AndroidHaptics.Confirm,
      error: Haptics.AndroidHaptics.Reject,
      'round-win': Haptics.AndroidHaptics.Confirm,
      'match-win': Haptics.AndroidHaptics.Confirm,
      selection: Haptics.AndroidHaptics.Segment_Tick,
    }[name];
    return Haptics.performAndroidHapticsAsync(androidType);
  }
  if (name === 'signal') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  if (name === 'success') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  if (name === 'error') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  if (name === 'match-win') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  if (name === 'selection') return Haptics.selectionAsync();
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function FeedbackProvider({ children }: PropsWithChildren) {
  const { settings } = useGlobalSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const gateRef = useRef(new FeedbackEventGate());

  const go = useAudioPlayer(require('../assets/sounds/go.wav'), { downloadFirst: true });
  const success = useAudioPlayer(require('../assets/sounds/success.wav'), { downloadFirst: true });
  const error = useAudioPlayer(require('../assets/sounds/error.wav'), { downloadFirst: true });
  const timeout = useAudioPlayer(require('../assets/sounds/timeout.wav'), { downloadFirst: true });
  const wrong = useAudioPlayer(require('../assets/sounds/wrong.wav'), { downloadFirst: true });
  const roundWin = useAudioPlayer(require('../assets/sounds/roundWin.wav'), { downloadFirst: true });
  const matchWin = useAudioPlayer(require('../assets/sounds/matchWin.wav'), { downloadFirst: true });
  const draw = useAudioPlayer(require('../assets/sounds/draw.wav'), { downloadFirst: true });
  const menu = useAudioPlayer(require('../assets/sounds/menu.wav'), { downloadFirst: true });

  const players = useMemo<Record<SoundName, AudioPlayer>>(() => ({
    go, success, error, timeout, wrong, roundWin, matchWin, draw, menu,
  }), [draw, error, go, matchWin, menu, roundWin, success, timeout, wrong]);
  const audio = useMemo(() => new AudioPlaybackCoordinator(players), [players]);

  useEffect(() => {
    const gate = gateRef.current;
    void setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    }).catch(() => undefined);
    void setIsAudioActiveAsync(AppState.currentState === 'active').catch(() => undefined);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        gate.invalidate();
        audio.cancelAll();
      }
      void setIsAudioActiveAsync(state === 'active').catch(() => undefined);
    });
    return () => {
      subscription.remove();
      gate.invalidate();
      audio.cancelAll();
      void setIsAudioActiveAsync(false).catch(() => undefined);
    };
  }, [audio]);

  const cancelFeedback = useCallback(() => {
    gateRef.current.invalidate();
    audio.cancelAll();
  }, [audio]);

  const beginFeedbackSession = useCallback(() => {
    audio.cancelAll();
    return gateRef.current.beginSession();
  }, [audio]);

  const emitFeedback = useCallback((event: FeedbackEvent, options: EmitOptions = {}) => {
    const gate = gateRef.current;
    const session = options.session ?? gate.beginSession();
    if (!gate.accept(session, options.eventId)) return;
    const plan = getFeedbackPlan(event, settingsRef.current, options.fakeSignalsEnabled ?? false);

    if (plan.haptic) void runHaptic(plan.haptic).catch(() => undefined);
    if (!plan.sound) return;

    audio.play(plan.sound, () => {
      const currentPlan = getFeedbackPlan(event, settingsRef.current, options.fakeSignalsEnabled ?? false);
      return (
        gate.isCurrent(session) &&
        currentPlan.sound === plan.sound
      );
    });
  }, [audio]);

  const value = useMemo(() => ({ beginFeedbackSession, cancelFeedback, emitFeedback }), [
    beginFeedbackSession, cancelFeedback, emitFeedback,
  ]);
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider');
  return value;
}

