/**
 * Полоса прогресса с анимацией роста.
 *
 * Используется для компетенций, XP и общего прогресса. Ширина анимируется через
 * `transform: scaleX`, а не через `width`, чтобы не пересчитывать layout на
 * каждом кадре. При reduce-motion значение просто выставляется сразу.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { colors } from '../theme/tokens';
import { duration as durations, easing } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * @param {number} value   0..1
 * @param {string} [color]
 * @param {number} [height]
 * @param {number} [delay] мс — чтобы полосы заполнялись каскадом
 */
export const ProgressBar = ({ value = 0, color = colors.success, height = 10, delay = 0 }) => {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const progress = useSharedValue(reduced ? clamped : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = clamped;
      return;
    }
    progress.value = withDelay(
      delay,
      withTiming(clamped, { duration: durations.enter + 200, easing: easing.enter })
    );
  }, [clamped, delay, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            height,
            borderRadius: height / 2,
            backgroundColor: color,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.track,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    // Абсолютное позиционирование от левого края: scaleX растёт вправо,
    // `transformOrigin` не нужен и не зависит от версии RN.
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
  },
});

export default ProgressBar;
