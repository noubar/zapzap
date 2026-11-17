import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
} from '../settings/gameSettings';
import {
  hydrateGameSettings,
  persistGameSettings,
} from '../settings/persistence';

type GlobalSettingsContextValue = {
  settings: GameSettings;
  setSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
  resetToDefaults: () => void;
};

const GlobalSettingsContext = createContext<GlobalSettingsContextValue | null>(null);

export function GlobalSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_GAME_SETTINGS });
  const [isHydrated, setIsHydrated] = useState(false);
  const lastCanonicalRef = useRef<string | null>(null);
  const persistenceEnabledRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    void hydrateGameSettings(AsyncStorage)
      .then(({ settings: loadedSettings, canonical }) => {
        if (!mounted) return;
        lastCanonicalRef.current = canonical;
        persistenceEnabledRef.current = true;
        setSettings(loadedSettings);
        setIsHydrated(true);
      })
      .catch((error: unknown) => {
        console.warn('Unable to load game settings. Using defaults for this session.', error);
        if (mounted) setIsHydrated(true);
      });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!isHydrated || !persistenceEnabledRef.current) return;
    void persistGameSettings(AsyncStorage, settings, lastCanonicalRef.current)
      .then((canonical) => { lastCanonicalRef.current = canonical; })
      .catch((error: unknown) => {
        console.warn('Unable to save game settings.', error);
      });
  }, [isHydrated, settings]);

  const value = useMemo<GlobalSettingsContextValue>(
    () => ({
      settings,
      setSetting: (key, value) => {
        persistenceEnabledRef.current = true;
        setSettings((previous) => ({ ...previous, [key]: value }));
      },
      resetToDefaults: () => {
        persistenceEnabledRef.current = true;
        setSettings({ ...DEFAULT_GAME_SETTINGS });
      },
    }),
    [settings]
  );

  if (!isHydrated) return null;

  return (
    <GlobalSettingsContext.Provider value={value}>
      {children}
    </GlobalSettingsContext.Provider>
  );
}

export function useGlobalSettings() {
  const context = useContext(GlobalSettingsContext);
  if (!context) {
    throw new Error('useGlobalSettings must be used inside GlobalSettingsProvider');
  }
  return context;
}
