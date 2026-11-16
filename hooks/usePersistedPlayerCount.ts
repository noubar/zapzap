import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import {
  clampPlayerCount,
  DEFAULT_ONE_FINGER_MULTIPLAYER_PLAYERS,
  MAX_ONE_FINGER_MULTIPLAYER_PLAYERS,
  PLAYER_COUNT_STORAGE_KEY,
} from '../settings/playerCount';

export function usePersistedPlayerCount(maximum = MAX_ONE_FINGER_MULTIPLAYER_PLAYERS) {
  const [playerCount, setPlayerCountState] = useState(DEFAULT_ONE_FINGER_MULTIPLAYER_PLAYERS);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(PLAYER_COUNT_STORAGE_KEY)
      .then((raw) => {
        if (mounted) setPlayerCountState(clampPlayerCount(raw, maximum));
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, [maximum]);

  const setPlayerCount = useCallback((value: number) => {
    const next = clampPlayerCount(value, maximum);
    setPlayerCountState(next);
    void AsyncStorage.setItem(PLAYER_COUNT_STORAGE_KEY, String(next)).catch(() => undefined);
  }, [maximum]);

  return [playerCount, setPlayerCount] as const;
}
