import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SinglePlayerTutorialAnimation from '../components/SinglePlayerTutorialAnimation';
import {
  arcadeColors,
  arcadeMetrics,
  arcadeTypography,
} from '../constants/ArcadeTheme';

export default function TutorialScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={arcadeTypography.eyebrow}>TRAINING MODE</Text>
          <Text accessibilityRole="header" style={styles.title}>HOW TO PLAY</Text>
          <Text style={styles.subtitle}>White is the only GO signal.</Text>
        </View>

        <SinglePlayerTutorialAnimation />

        <View style={styles.instructions}>
          <Text style={styles.instructionNumber}>01</Text>
          <Text style={styles.instructionsText}>Press and keep holding through the random wait.</Text>
          <Text style={styles.instructionNumber}>02</Text>
          <Text style={styles.instructionsText}>Release immediately when the box turns white.</Text>
          <Text style={styles.instructionNumber}>03</Text>
          <Text style={styles.instructionsText}>Releasing early or after the deadline ends the run.</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => router.push('/')}
          accessibilityRole="button"
          accessibilityLabel="Back to main menu"
        >
          <Text style={styles.buttonText}>BACK TO MENU</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: arcadeColors.background,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: arcadeMetrics.maxContentWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: arcadeMetrics.spacing.md,
    paddingVertical: arcadeMetrics.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: arcadeMetrics.spacing.lg,
  },
  title: {
    ...arcadeTypography.title,
    marginTop: arcadeMetrics.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...arcadeTypography.body,
    marginTop: arcadeMetrics.spacing.sm,
    color: arcadeColors.textMuted,
    textAlign: 'center',
  },
  instructions: {
    marginTop: arcadeMetrics.spacing.lg,
    padding: arcadeMetrics.spacing.md,
    borderWidth: 2,
    borderColor: arcadeColors.outline,
    borderRadius: arcadeMetrics.radius,
    backgroundColor: arcadeColors.surface,
    gap: arcadeMetrics.spacing.sm,
  },
  instructionNumber: {
    ...arcadeTypography.eyebrow,
    color: arcadeColors.success,
  },
  instructionsText: {
    ...arcadeTypography.body,
    color: arcadeColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: arcadeMetrics.spacing.lg,
    borderRadius: arcadeMetrics.radiusSmall,
    backgroundColor: arcadeColors.outline,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  buttonText: {
    ...arcadeTypography.body,
    color: arcadeColors.signalText,
    fontWeight: '900',
  },
});
