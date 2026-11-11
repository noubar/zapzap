import { useEffect, useRef, type PropsWithChildren } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { getVisualFeedbackPlan, type VisualFeedbackKind } from '../feedback/visualFeedback';

type ResultFeedbackViewProps = PropsWithChildren<{
  enabled: boolean;
  kind: VisualFeedbackKind;
  style?: StyleProp<ViewStyle>;
}>;

export default function ResultFeedbackView({ children, enabled, kind, style }: ResultFeedbackViewProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.stopAnimation();
    scale.stopAnimation();
    translateX.stopAnimation();
    opacity.setValue(1);
    scale.setValue(1);
    translateX.setValue(0);
    if (!getVisualFeedbackPlan(kind, enabled, reducedMotion).animate) return;

    const animation = kind === 'failure'
      ? Animated.sequence([
          Animated.timing(translateX, { toValue: -5, duration: 45, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 5, duration: 70, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0, duration: 45, useNativeDriver: true }),
        ])
      : Animated.parallel([
          Animated.sequence([
            Animated.timing(scale, { toValue: kind === 'victory' ? 1.06 : 1.035, duration: 120, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration: 160, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.72, duration: 70, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]),
        ]);
    animation.start();
    return () => animation.stop();
  }, [enabled, kind, opacity, reducedMotion, scale, translateX]);

  return (
    <Animated.View pointerEvents="none" style={[style, { opacity, transform: [{ translateX }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

