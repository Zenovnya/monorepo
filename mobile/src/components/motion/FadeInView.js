/**
 * Появление элемента с каскадом.
 *
 * Базовый примитив motion-системы: карточки, строки списков и блоки «въезжают»
 * снизу на 12px и проявляются. При reduce-motion элемент появляется сразу, без
 * анимации, но с той же геометрией — layout не «прыгает» между режимами.
 */

import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { duration as durations, easing, enterDelay } from '../../theme/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const OFFSET_Y = 12;

export const FadeInView = ({
  children,
  index = 0,
  delay,
  distance = OFFSET_Y,
  style,
  ...rest
}) => {
  const reduced = useReducedMotion();
  const entered = useSharedValue(0);

  const pause = delay ?? enterDelay(index);

  useEffect(() => {
    if (reduced) {
      entered.value = 1;
      return;
    }

    entered.value = withDelay(
      pause,
      withTiming(1, { duration: durations.enter, easing: easing.enter })
    );
  }, [entered, pause, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: entered.value,
    transform: [{ translateY: (1 - entered.value) * distance }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]} {...rest}>
      {children}
    </Animated.View>
  );
};

export default FadeInView;
