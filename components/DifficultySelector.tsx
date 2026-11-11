import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { arcadeColors, arcadeMetrics, arcadeTypography } from '../constants/ArcadeTheme';

interface DifficultyLevel {
  label: string;
  value: 'easy' | 'medium' | 'hard';
}

interface DifficultySelectorProps {
  difficulty: 'easy' | 'medium' | 'hard';
  setDifficulty: (level: 'easy' | 'medium' | 'hard') => void;
  hasTouchedToStart: boolean;
  levels: DifficultyLevel[];
}

export default function DifficultySelector({ difficulty, setDifficulty, hasTouchedToStart, levels }: DifficultySelectorProps) {
  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      {levels.map(level => (
        <Pressable
          key={level.value}
          style={({ pressed }) => [
            styles.option,
            difficulty === level.value && styles.optionSelected,
            hasTouchedToStart && styles.optionDisabled,
            pressed && !hasTouchedToStart && styles.optionPressed,
          ]}
          onPress={() => setDifficulty(level.value)}
          disabled={hasTouchedToStart}
          accessibilityRole="radio"
          accessibilityLabel={`${level.label} difficulty`}
          accessibilityState={{ checked: difficulty === level.value, disabled: hasTouchedToStart }}
        >
          <Text style={[styles.optionText, difficulty === level.value && styles.optionTextSelected]}>
            {level.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: arcadeMetrics.spacing.sm,
    paddingHorizontal: arcadeMetrics.spacing.md,
  },
  option: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: arcadeColors.outline,
    borderRadius: arcadeMetrics.radiusSmall,
    backgroundColor: arcadeColors.surface,
  },
  optionSelected: {
    backgroundColor: arcadeColors.outline,
  },
  optionDisabled: {
    opacity: 0.45,
  },
  optionPressed: {
    backgroundColor: arcadeColors.surfaceHeld,
  },
  optionText: {
    ...arcadeTypography.caption,
    color: arcadeColors.text,
    fontWeight: '900',
  },
  optionTextSelected: {
    color: arcadeColors.signalText,
  },
});
