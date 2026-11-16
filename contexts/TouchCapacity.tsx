import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  normalizeObservedTouchCapacity,
  TOUCH_CAPACITY_STORAGE_KEY,
} from '../settings/touchCapacity';

interface TouchCapacityContextValue {
  observedCapacity: number | null;
  setObservedCapacity: (capacity: number) => Promise<void>;
}

const TouchCapacityContext = createContext<TouchCapacityContextValue | null>(null);

export function TouchCapacityProvider({ children }: PropsWithChildren) {
  const [observedCapacity, setObservedCapacityState] = useState<number | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(TOUCH_CAPACITY_STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        setObservedCapacityState(normalizeObservedTouchCapacity(raw));
        setIsHydrated(true);
      })
      .catch(() => {
        if (mounted) setIsHydrated(true);
      });
    return () => { mounted = false; };
  }, []);

  const setObservedCapacity = useCallback(async (capacity: number) => {
    const normalized = normalizeObservedTouchCapacity(capacity);
    if (normalized === null) return;
    setObservedCapacityState(normalized);
    await AsyncStorage.setItem(TOUCH_CAPACITY_STORAGE_KEY, String(normalized));
  }, []);

  const value = useMemo(() => ({ observedCapacity, setObservedCapacity }), [
    observedCapacity,
    setObservedCapacity,
  ]);
  if (!isHydrated) return null;
  return <TouchCapacityContext.Provider value={value}>{children}</TouchCapacityContext.Provider>;
}

export function useTouchCapacity() {
  const context = useContext(TouchCapacityContext);
  if (!context) throw new Error('useTouchCapacity must be used inside TouchCapacityProvider');
  return context;
}
