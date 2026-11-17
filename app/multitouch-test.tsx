/* eslint-disable react-hooks/refs -- Gesture callbacks update calibration state outside render. */
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { arcadeColors, arcadeMetrics, arcadeTypography } from '../constants/ArcadeTheme';
import {
  addCalibrationPointers,
  createTouchCalibrationState,
  removeCalibrationPointers,
  type TouchCalibrationState,
} from '../settings/touchCapacity';
import { useTouchCapacity } from '../contexts/TouchCapacity';

export default function MultitouchTestScreen() {
  const router = useRouter();
  const { observedCapacity, setObservedCapacity } = useTouchCapacity();
  const [calibration, setCalibration] = useState<TouchCalibrationState>(() =>
    createTouchCalibrationState(observedCapacity ?? 0)
  );
  const calibrationRef = useRef(calibration);

  const update = useCallback((next: TouchCalibrationState) => {
    calibrationRef.current = next;
    setCalibration(next);
  }, []);
  const addPointer = useCallback((pointerId: number) => {
    update(addCalibrationPointers(calibrationRef.current, [pointerId]));
  }, [update]);
  const removePointer = useCallback((pointerId: number) => {
    update(removeCalibrationPointers(calibrationRef.current, [pointerId]));
  }, [update]);
  const gesture = Gesture.Manual()
    .onTouchesDown((event, manager) => {
      manager.activate();
      event.changedTouches.forEach((touch) => scheduleOnRN(addPointer, touch.id));
    })
    .onTouchesUp((event, manager) => {
      event.changedTouches.forEach((touch) => scheduleOnRN(removePointer, touch.id));
      if (event.allTouches.length === 0) manager.end();
    })
    .onTouchesCancelled((event, manager) => {
      event.changedTouches.forEach((touch) => scheduleOnRN(removePointer, touch.id));
      if (event.allTouches.length === 0) manager.end();
    });

  const finish = async () => {
    if (calibration.highestObserved >= 2) {
      await setObservedCapacity(
        Math.max(observedCapacity ?? 0, calibration.highestObserved)
      ).catch(() => undefined);
    }
    router.back();
  };

  return (
    <GestureHandlerRootView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={arcadeTypography.eyebrow}>MULTITOUCH CALIBRATION</Text>
          <Text style={styles.title}>TEST MULTITOUCH</Text>
          <Text style={styles.help}>
            Place as many fingers as you can on the surface at the same time. This records an observed count, not a guaranteed hardware specification.
          </Text>
        </View>
        <GestureDetector gesture={gesture}>
          <View style={styles.surface} testID="multitouch-test-surface">
            <Text style={styles.count}>{calibration.activePointerIds.size}</Text>
            <Text style={styles.countLabel}>FINGERS NOW</Text>
            <Text accessibilityLiveRegion="polite" style={styles.highest}>
              HIGHEST OBSERVED: {calibration.highestObserved}
            </Text>
          </View>
        </GestureDetector>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            onPress={() => update(createTouchCalibrationState(0))}
          >
            <Text style={styles.secondaryText}>REPEAT TEST</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            onPress={() => void finish()}
          >
            <Text style={styles.primaryText}>SAVE & RETURN</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: arcadeColors.background },
  safeArea: { flex: 1, padding: arcadeMetrics.spacing.md, gap: arcadeMetrics.spacing.md },
  header: { alignItems: 'center' },
  title: { ...arcadeTypography.title, marginTop: arcadeMetrics.spacing.xs, textAlign: 'center' },
  help: { ...arcadeTypography.caption, marginTop: arcadeMetrics.spacing.sm, maxWidth: 620, textAlign: 'center' },
  surface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: arcadeMetrics.borderWidth,
    borderColor: arcadeColors.outline,
    borderRadius: arcadeMetrics.radius,
    backgroundColor: arcadeColors.surface,
  },
  count: { ...arcadeTypography.reaction, fontSize: 72 },
  countLabel: { ...arcadeTypography.eyebrow, color: arcadeColors.text },
  highest: { ...arcadeTypography.body, marginTop: arcadeMetrics.spacing.lg, color: arcadeColors.success, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: arcadeMetrics.spacing.sm },
  primary: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: arcadeMetrics.radiusSmall, backgroundColor: arcadeColors.outline },
  secondary: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: arcadeColors.outline, borderRadius: arcadeMetrics.radiusSmall },
  primaryText: { ...arcadeTypography.body, color: arcadeColors.signalText, fontWeight: '900' },
  secondaryText: { ...arcadeTypography.body, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
