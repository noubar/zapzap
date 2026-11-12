import { Award } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGlobalSettings } from '../app/GlobalSettings';
import { arcadeColors, arcadeMetrics, arcadeTypography } from '../constants/ArcadeTheme';
import type { AchievementDefinition } from '../statistics/achievements';
import ResultFeedbackView from './ResultFeedbackView';

type AchievementNotificationProps = {
  achievement: AchievementDefinition | null;
  onFinished: () => void;
};

export default function AchievementNotification({ achievement, onFinished }: AchievementNotificationProps) {
  const { settings } = useGlobalSettings();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(onFinished, 2_400);
    return () => clearTimeout(timer);
  }, [achievement, onFinished]);

  if (!achievement) return null;
  return (
    <View pointerEvents="none" accessibilityLiveRegion="polite" style={[styles.host, { top: insets.top + 8 }]}>
      <ResultFeedbackView enabled={settings.visualEffectsEnabled} kind="victory" style={styles.card}>
        <Award size={24} color={arcadeColors.victory} />
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>ACHIEVEMENT UNLOCKED</Text>
          <Text style={styles.title}>{achievement.title.toUpperCase()}</Text>
          <Text style={styles.description}>{achievement.description}</Text>
        </View>
      </ResultFeedbackView>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 12, right: 12, zIndex: 100, alignItems: 'center' },
  card: {
    width: '100%', maxWidth: 520, minHeight: 86, flexDirection: 'row', alignItems: 'center',
    gap: arcadeMetrics.spacing.md, padding: arcadeMetrics.spacing.md,
    borderWidth: 2, borderColor: arcadeColors.victory, borderRadius: arcadeMetrics.radiusSmall,
    backgroundColor: arcadeColors.surface,
  },
  copy: { flex: 1 },
  eyebrow: { ...arcadeTypography.eyebrow, color: arcadeColors.victory, fontSize: 10 },
  title: { ...arcadeTypography.body, marginTop: 2, color: arcadeColors.victory, fontWeight: '900' },
  description: { ...arcadeTypography.caption, marginTop: 2, color: arcadeColors.text },
});

