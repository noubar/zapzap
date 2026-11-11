import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { arcadeColors, arcadeMetrics, arcadeTypography } from '../constants/ArcadeTheme';

const STEPS = [
  { label: 'Touch & hold the box', status: 'TOUCH & HOLD' },
  { label: 'Wait for the zap', status: 'WAITING...' },
  { label: 'Lift fast on zap', status: 'ZAP! LIFT NOW' },
  { label: 'Too slow = lose', status: 'TIMEOUT = LOSE' },
];

const STEP_TIMINGS_MS = [0, 1200, 2600, 3800];
const CYCLE_DURATION_MS = 5200;

export default function SinglePlayerTutorialAnimation() {
  const [stepIndex, setStepIndex] = useState(0);
  const fingerProgress = useRef(new Animated.Value(0)).current;
  const fillProgress = useRef(new Animated.Value(0)).current;
  const zapOpacity = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const fingerTranslate = fingerProgress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-40, 0, 26],
  });

  const boxFillColor = fillProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,1)'],
  });

  const step = useMemo(() => STEPS[stepIndex], [stepIndex]);

  useEffect(() => {
    const animate = () => {
      fingerProgress.setValue(0);
      fillProgress.setValue(0);
      zapOpacity.setValue(0);
      hintOpacity.setValue(0);

      animationRef.current = Animated.sequence([
        Animated.timing(fingerProgress, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(fillProgress, {
            toValue: 1,
            duration: 650,
            useNativeDriver: false,
          }),
          Animated.sequence([
            Animated.timing(zapOpacity, {
              toValue: 1,
              duration: 280,
              useNativeDriver: false,
            }),
            Animated.delay(360),
            Animated.timing(zapOpacity, {
              toValue: 0,
              duration: 280,
              useNativeDriver: false,
            }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(fingerProgress, {
            toValue: -1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(hintOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
        ]),
        Animated.delay(700),
      ]);
      animationRef.current.start();
    };

    animate();
    const interval = setInterval(animate, CYCLE_DURATION_MS);

    return () => {
      clearInterval(interval);
      animationRef.current?.stop();
    };
  }, [fingerProgress, fillProgress, hintOpacity, zapOpacity]);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const scheduleSteps = () => {
      STEP_TIMINGS_MS.forEach((timing, index) => {
        timeouts.push(setTimeout(() => setStepIndex(index), timing));
      });
    };

    scheduleSteps();

    const interval = setInterval(() => {
      scheduleSteps();
    }, CYCLE_DURATION_MS);

    return () => {
      timeouts.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.statusText,
          stepIndex === 3 && styles.failureText,
          stepIndex === 2 && styles.signalStatusText,
        ]}
      >
        {step.status}
      </Text>

      <View style={styles.rectangleWrapper}>
        <Animated.View style={[styles.rectangle, { backgroundColor: boxFillColor }]} />
        <View style={styles.rectangleBorder} />

        <Animated.Text style={[styles.zapText, { opacity: zapOpacity }]}>ZAP!</Animated.Text>
        <Animated.Text style={[styles.hintText, { opacity: hintOpacity }]}>
          Lift before timeout
        </Animated.Text>

        <Animated.View style={[styles.finger, { transform: [{ translateY: fingerTranslate }] }]} />
      </View>

      <Text style={styles.stepText}>{step.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 480,
  },
  statusText: {
    ...arcadeTypography.heading,
    color: arcadeColors.text,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 18,
    textAlign: 'center',
  },
  rectangleWrapper: {
    width: '100%',
    height: 270,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  rectangle: {
    width: '90%',
    height: 150,
    borderRadius: arcadeMetrics.radius,
    position: 'absolute',
    bottom: 0,
  },
  rectangleBorder: {
    position: 'absolute',
    width: '90%',
    height: 150,
    borderRadius: arcadeMetrics.radius,
    borderWidth: arcadeMetrics.borderWidth,
    borderColor: arcadeColors.outline,
    backgroundColor: arcadeColors.surface,
    bottom: 0,
  },
  zapText: {
    position: 'absolute',
    color: arcadeColors.signalText,
    fontFamily: 'SpaceMono',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
    bottom: 62,
  },
  hintText: {
    position: 'absolute',
    bottom: 20,
    color: arcadeColors.signalText,
    fontFamily: 'SpaceMono',
    fontSize: 14,
    fontWeight: '700',
  },
  finger: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: arcadeColors.text,
    bottom: 118,
    borderWidth: 3,
    borderColor: arcadeColors.background,
  },
  stepText: {
    marginTop: 18,
    ...arcadeTypography.body,
    color: arcadeColors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  failureText: {
    color: arcadeColors.failure,
  },
  signalStatusText: {
    color: arcadeColors.text,
  },
});
