import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

type GlobalSettings = {
  vibrationEnabled: boolean;
};

type GlobalSettingsContextValue = {
  settings: GlobalSettings;
  setSetting: <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => void;
};

const defaultSettings: GlobalSettings = {
  vibrationEnabled: true,
};

const GlobalSettingsContext = createContext<GlobalSettingsContextValue | null>(null);

export function GlobalSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<GlobalSettings>(defaultSettings);

  const value = useMemo(
    () => ({
      settings,
      setSetting: <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
      },
    }),
    [settings]
  );

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
