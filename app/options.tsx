import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { arcadeColors, arcadeMetrics, arcadeTypography } from '../constants/ArcadeTheme';
import {
  DIFFICULTIES,
  DIFFICULTY_PROFILES,
  MATCH_FORMAT_LABELS,
  MATCH_FORMATS,
} from '../settings/gameSettings';
import { useGlobalSettings } from './GlobalSettings';

type ToggleRowProps = {
  label: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
};

function ToggleRow({ label, description, value, disabled = false, onValueChange }: ToggleRowProps) {
  return (
    <View style={[styles.toggleRow, disabled && styles.disabledRow]}>
      <View style={styles.toggleCopy}>
        <Text style={styles.optionTitle}>{label}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        accessibilityHint={description}
        trackColor={{ false: '#343434', true: arcadeColors.success }}
        thumbColor={arcadeColors.outline}
      />
    </View>
  );
}

export default function GameOptionsScreen() {
  const { settings, setSetting, resetToDefaults } = useGlobalSettings();
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  const confirmReset = () => {
    resetToDefaults();
    setIsConfirmingReset(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={arcadeTypography.eyebrow}>ZAPZAP // CONFIG</Text>
          <Text accessibilityRole="header" style={styles.title}>GAME OPTIONS</Text>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>GAMEPLAY</Text>
            <Text style={styles.fieldLabel}>DIFFICULTY</Text>
            <View style={styles.choiceGrid} accessibilityRole="radiogroup">
              {DIFFICULTIES.map((difficulty) => {
                const selected = settings.difficulty === difficulty;
                const profile = DIFFICULTY_PROFILES[difficulty];
                return (
                  <Pressable
                    key={difficulty}
                    onPress={() => setSetting('difficulty', difficulty)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${profile.label}, ${profile.reactionDeadlineMs} milliseconds`}
                    style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}
                  >
                    <Text style={[styles.choiceTitle, selected && styles.choiceTitleSelected]}>{profile.label}</Text>
                    <Text style={[styles.choiceDetail, selected && styles.choiceDetailSelected]}>{profile.reactionDeadlineMs} MS</Text>
                  </Pressable>
                );
              })}
            </View>
            <ToggleRow
              label="Fake Signals"
              description="Ignore colored flashes. Release only on white."
              value={settings.fakeSignalsEnabled}
              onValueChange={(value) => setSetting('fakeSignalsEnabled', value)}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MULTIPLAYER</Text>
            <Text style={styles.fieldLabel}>MATCH FORMAT</Text>
            <View style={styles.formatList} accessibilityRole="radiogroup">
              {MATCH_FORMATS.map((format) => {
                const selected = settings.matchFormat === format;
                return (
                  <Pressable
                    key={format}
                    onPress={() => setSetting('matchFormat', format)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={({ pressed }) => [styles.formatChoice, selected && styles.formatChoiceSelected, pressed && styles.pressed]}
                  >
                    <Text style={[styles.formatText, selected && styles.formatTextSelected]}>{MATCH_FORMAT_LABELS[format]}</Text>
                    <Text style={[styles.radioMark, selected && styles.radioMarkSelected]}>{selected ? 'SELECTED' : 'SELECT'}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FEEDBACK</Text>
            <ToggleRow
              label="Haptic Feedback"
              description="Vibrate when the valid GO signal appears."
              value={settings.hapticsEnabled}
              onValueChange={(value) => setSetting('hapticsEnabled', value)}
            />
            <ToggleRow
              label="Sound Effects"
              description="Coming Soon — no sound system is installed."
              value={settings.soundEnabled}
              disabled
              onValueChange={() => undefined}
            />
            <ToggleRow
              label="Visual Effects"
              description="Coming Soon — essential gameplay feedback always remains visible."
              value={settings.visualEffectsEnabled}
              disabled
              onValueChange={() => undefined}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>GENERAL</Text>
            {isConfirmingReset ? (
              <View accessibilityRole="alert" style={styles.confirmCard}>
                <Text style={styles.confirmTitle}>RESET GAME OPTIONS?</Text>
                <Text style={styles.optionDescription}>Preferences return to defaults. Gameplay records are not deleted.</Text>
                <View style={styles.confirmActions}>
                  <Pressable
                    onPress={() => setIsConfirmingReset(false)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.cancelText}>CANCEL</Text>
                  </Pressable>
                  <Pressable
                    onPress={confirmReset}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.confirmButtonText}>CONFIRM RESET</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setIsConfirmingReset(true)}
                accessibilityRole="button"
                accessibilityLabel="Reset game options to defaults"
                style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
              >
                <Text style={styles.resetText}>RESET TO DEFAULTS</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => router.replace('/')}
            accessibilityRole="button"
            accessibilityLabel="Return to main menu"
            style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
          >
            <Text style={styles.doneText}>BACK TO MENU</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: arcadeColors.background },
  scrollContent: { flexGrow: 1, alignItems: 'center', padding: arcadeMetrics.spacing.md },
  content: { width: '100%', maxWidth: arcadeMetrics.maxContentWidth },
  title: { ...arcadeTypography.title, marginTop: arcadeMetrics.spacing.sm, marginBottom: arcadeMetrics.spacing.xl },
  section: { marginBottom: arcadeMetrics.spacing.xl },
  sectionLabel: { ...arcadeTypography.eyebrow, color: arcadeColors.success, marginBottom: arcadeMetrics.spacing.md },
  fieldLabel: { ...arcadeTypography.caption, marginBottom: arcadeMetrics.spacing.sm, fontWeight: '800' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: arcadeMetrics.spacing.sm },
  choice: {
    width: '48%', minHeight: 64, flexGrow: 1, justifyContent: 'center', padding: arcadeMetrics.spacing.sm,
    borderWidth: 2, borderColor: arcadeColors.outline, borderRadius: arcadeMetrics.radiusSmall,
    backgroundColor: arcadeColors.surface,
  },
  choiceSelected: { backgroundColor: arcadeColors.outline },
  choiceTitle: { ...arcadeTypography.body, fontWeight: '900', textTransform: 'uppercase' },
  choiceTitleSelected: { color: arcadeColors.signalText },
  choiceDetail: { ...arcadeTypography.caption, marginTop: 2 },
  choiceDetailSelected: { color: '#333333' },
  toggleRow: {
    minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: arcadeMetrics.spacing.md,
    marginTop: arcadeMetrics.spacing.sm, padding: arcadeMetrics.spacing.md,
    borderWidth: 2, borderColor: arcadeColors.outline, borderRadius: arcadeMetrics.radiusSmall,
    backgroundColor: arcadeColors.surface,
  },
  disabledRow: { opacity: 0.58 },
  toggleCopy: { flex: 1 },
  optionTitle: { ...arcadeTypography.body, fontWeight: '900' },
  optionDescription: { ...arcadeTypography.caption, marginTop: 4, lineHeight: 17 },
  formatList: { gap: arcadeMetrics.spacing.sm },
  formatChoice: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: arcadeMetrics.spacing.md, paddingHorizontal: arcadeMetrics.spacing.md,
    borderWidth: 2, borderColor: '#4A4A4A', borderRadius: arcadeMetrics.radiusSmall,
    backgroundColor: arcadeColors.surface,
  },
  formatChoiceSelected: { borderColor: arcadeColors.victory },
  formatText: { ...arcadeTypography.body, fontWeight: '800' },
  formatTextSelected: { color: arcadeColors.victory },
  radioMark: { ...arcadeTypography.caption, fontSize: 10 },
  radioMarkSelected: { color: arcadeColors.victory },
  resetButton: {
    minHeight: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 2,
    borderColor: arcadeColors.failure, borderRadius: arcadeMetrics.radiusSmall,
  },
  resetText: { ...arcadeTypography.body, color: arcadeColors.failure, fontWeight: '900' },
  confirmCard: {
    padding: arcadeMetrics.spacing.md, borderWidth: 2, borderColor: arcadeColors.failure,
    borderRadius: arcadeMetrics.radiusSmall, backgroundColor: arcadeColors.surface,
  },
  confirmTitle: { ...arcadeTypography.body, color: arcadeColors.failure, fontWeight: '900' },
  confirmActions: { flexDirection: 'row', gap: arcadeMetrics.spacing.sm, marginTop: arcadeMetrics.spacing.md },
  cancelButton: {
    flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: arcadeColors.outline, borderRadius: arcadeMetrics.radiusSmall,
  },
  cancelText: { ...arcadeTypography.caption, color: arcadeColors.text, fontWeight: '900' },
  confirmButton: {
    flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: arcadeMetrics.radiusSmall, backgroundColor: arcadeColors.failure,
  },
  confirmButtonText: { ...arcadeTypography.caption, color: arcadeColors.text, fontWeight: '900' },
  doneButton: {
    minHeight: 54, alignItems: 'center', justifyContent: 'center', marginBottom: arcadeMetrics.spacing.lg,
    borderRadius: arcadeMetrics.radiusSmall, backgroundColor: arcadeColors.outline,
  },
  doneText: { ...arcadeTypography.body, color: arcadeColors.signalText, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
