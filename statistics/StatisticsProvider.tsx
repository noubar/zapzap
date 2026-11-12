import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import AchievementNotification from '../components/AchievementNotification';
import { nextAchievementNotification, type AchievementDefinition } from './achievements';
import { applyStatisticsEvent, createEmptyStatistics } from './statisticsEngine';
import { hydrateStatistics, StatisticsWriteQueue } from './persistence';
import type { StatisticsEvent, StatisticsState } from './types';

type StatisticsContextValue = {
  statistics: StatisticsState;
  recordEvent: (event: StatisticsEvent) => boolean;
  resetStatistics: () => void;
  setGameplayActive: (active: boolean) => void;
};

const StatisticsContext = createContext<StatisticsContextValue | null>(null);

export function createStatisticsSessionId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function StatisticsProvider({ children }: PropsWithChildren) {
  const [statistics, setStatistics] = useState(createEmptyStatistics);
  const [hydrated, setHydrated] = useState(false);
  const [gameplayActive, setGameplayActiveState] = useState(false);
  const [notificationQueue, setNotificationQueue] = useState<AchievementDefinition[]>([]);
  const stateRef = useRef(statistics);
  const writerRef = useRef<StatisticsWriteQueue | null>(null);
  const gameplayActiveRef = useRef(false);
  const persistencePendingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    void hydrateStatistics(AsyncStorage).then(({ statistics: loaded, canonical }) => {
      if (!mounted) return;
      stateRef.current = loaded;
      writerRef.current = new StatisticsWriteQueue(AsyncStorage, canonical);
      setStatistics(loaded);
      setHydrated(true);
    }).catch((error: unknown) => {
      console.warn('Unable to load statistics. Using an empty session.', error);
      if (!mounted) return;
      writerRef.current = new StatisticsWriteQueue(AsyncStorage);
      setHydrated(true);
    });
    return () => { mounted = false; };
  }, []);

  const recordEvent = useCallback((event: StatisticsEvent) => {
    const result = applyStatisticsEvent(stateRef.current, event);
    if (result.duplicate) return false;
    stateRef.current = result.state;
    setStatistics(result.state);
    if (result.unlocked.length > 0) {
      setNotificationQueue((current) => [...current, ...result.unlocked]);
    }
    if (gameplayActiveRef.current) {
      persistencePendingRef.current = true;
    } else {
      void writerRef.current?.enqueue(result.state).catch((error: unknown) => {
        console.warn('Unable to save statistics.', error);
      });
    }
    return true;
  }, []);

  const resetStatistics = useCallback(() => {
    const empty = createEmptyStatistics();
    stateRef.current = empty;
    persistencePendingRef.current = false;
    setStatistics(empty);
    setNotificationQueue([]);
    void writerRef.current?.enqueue(empty, true).catch((error: unknown) => {
      console.warn('Unable to reset statistics.', error);
    });
  }, []);

  const setGameplayActive = useCallback((active: boolean) => {
    gameplayActiveRef.current = active;
    setGameplayActiveState(active);
    if (!active && persistencePendingRef.current) {
      persistencePendingRef.current = false;
      void writerRef.current?.enqueue(stateRef.current).catch((error: unknown) => {
        console.warn('Unable to save deferred statistics.', error);
      });
    }
  }, []);

  const dismissNotification = useCallback(() => {
    setNotificationQueue((current) => current.slice(1));
  }, []);

  const value = useMemo<StatisticsContextValue>(() => ({
    statistics,
    recordEvent,
    resetStatistics,
    setGameplayActive,
  }), [recordEvent, resetStatistics, setGameplayActive, statistics]);

  if (!hydrated) return null;

  return (
    <StatisticsContext.Provider value={value}>
      {children}
      <AchievementNotification
        achievement={nextAchievementNotification(notificationQueue, gameplayActive)}
        onFinished={dismissNotification}
      />
    </StatisticsContext.Provider>
  );
}

export function useStatistics() {
  const value = useContext(StatisticsContext);
  if (!value) throw new Error('useStatistics must be used inside StatisticsProvider');
  return value;
}

