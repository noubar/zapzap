import { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { arcadeColors, arcadeMetrics, arcadeTypography } from '../constants/ArcadeTheme';
import { clampPlayerCount } from '../settings/playerCount';

interface PlayerCountSliderProps {
  value: number;
  minimum: number;
  maximum: number;
  onChange: (value: number) => void;
}

const THUMB_SIZE = 28;

export default function PlayerCountSlider({
  value,
  minimum,
  maximum,
  onChange,
}: PlayerCountSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const latestWidth = useRef(0);
  const latestValue = useRef(value);
  latestValue.current = value;

  const valueFromX = useCallback((x: number) => {
    const width = latestWidth.current;
    if (width <= 0 || maximum <= minimum) return minimum;
    return clampPlayerCount(minimum + (x / width) * (maximum - minimum), maximum);
  }, [maximum, minimum]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => onChange(valueFromX(event.nativeEvent.locationX)),
    onPanResponderMove: (event) => onChange(valueFromX(event.nativeEvent.locationX)),
    onPanResponderTerminationRequest: () => false,
  }), [onChange, valueFromX]);

  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    latestWidth.current = width;
    setTrackWidth(width);
  };

  const position = maximum === minimum
    ? 0
    : ((value - minimum) / (maximum - minimum)) * Math.max(0, trackWidth - THUMB_SIZE);
  const values = Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Number of players"
      accessibilityValue={{ min: minimum, max: maximum, now: value, text: `${value} players` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const delta = event.nativeEvent.actionName === 'increment' ? 1 : -1;
        onChange(clampPlayerCount(latestValue.current + delta, maximum));
      }}
      style={styles.container}
      testID="player-count-slider"
    >
      <Text style={styles.label}>PLAYERS</Text>
      <View style={styles.trackTouchArea} onLayout={onLayout} {...panResponder.panHandlers}>
        <View style={styles.track} />
        <View pointerEvents="none" style={[styles.thumb, { left: position }]} />
      </View>
      <View style={styles.values}>
        {values.map((candidate) => (
          <Pressable
            key={candidate}
            accessibilityRole="radio"
            accessibilityLabel={`${candidate} players`}
            accessibilityState={{ checked: candidate === value }}
            onPress={() => onChange(candidate)}
            style={styles.valueButton}
          >
            <Text style={[styles.value, candidate === value && styles.valueSelected]}>{candidate}</Text>
          </Pressable>
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.selection}>
        SELECTED: {value} PLAYERS
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: arcadeMetrics.spacing.md,
    borderWidth: 2,
    borderColor: arcadeColors.outline,
    borderRadius: arcadeMetrics.radiusSmall,
    backgroundColor: arcadeColors.surface,
  },
  label: { ...arcadeTypography.eyebrow },
  trackTouchArea: {
    height: 44,
    justifyContent: 'center',
    marginTop: arcadeMetrics.spacing.xs,
  },
  track: { height: 4, borderRadius: 2, backgroundColor: arcadeColors.textMuted },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: arcadeColors.signalText,
    backgroundColor: arcadeColors.outline,
  },
  values: { flexDirection: 'row', justifyContent: 'space-between' },
  valueButton: { minWidth: 44, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  value: { ...arcadeTypography.body, color: arcadeColors.textMuted, fontWeight: '800' },
  valueSelected: { color: arcadeColors.text },
  selection: {
    ...arcadeTypography.caption,
    marginTop: arcadeMetrics.spacing.xs,
    color: arcadeColors.success,
    textAlign: 'center',
    fontWeight: '900',
  },
});
