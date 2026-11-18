/**
 * Переключатель с ходящим подпружиненным ползунком.
 *
 * Раньше состояние показывалось сменой стиля: `switchKnobOn` просто делал
 * `alignSelf: 'flex-end'`, то есть ползунок телепортировался вправо на один
 * кадр, а фон менялся скачком. Для такого частого элемента это самое заметное
 * «дёрганое» место в интерфейсе.
 *
 * Здесь положение, цвет и лёгкое «дыхание» ползунка живут на UI-потоке
 * Reanimated, переключатель доступен как switch для скринридеров, а при
 * reduce-motion меняет состояние мгновенно.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { brand } from './KhokhlomaOrnament';
import { useReducedMotion } from '../hooks/useReducedMotion';

const TRACK_W = 46;
const TRACK_H = 27;
const PAD = 3;
const KNOB = TRACK_H - PAD * 2;
const TRAVEL = TRACK_W - PAD * 2 - KNOB;

export const AnimatedSwitch = ({ value, onValueChange, disabled }) => {
  const reduced = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const target = value ? 1 : 0;
    if (reduced) {
      progress.value = target;
      return;
    }
    // Пружина, а не timing: ползунок чуть «переезжает» и садится — это и
    // читается как физический тумблер. overshootClamping не нужен, выход за
    // край всего пара десятых пикселя и он скрыт padding'ом.
    progress.value = withSpring(target, {
      damping: 18,
      stiffness: 220,
      mass: 0.7,
    });
  }, [progress, reduced, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.track, brand.pine]
    ),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: TRAVEL * progress.value },
      // На середине пути ползунок чуть шире — как у настоящего тумблера.
      { scaleX: 1 + 0.12 * Math.sin(progress.value * Math.PI) },
    ],
  }));

  const handlePress = () => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    onValueChange?.(!value);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="switch"
      accessibilityState={{ checked: Boolean(value), disabled: Boolean(disabled) }}
      style={styles.press}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  press: { justifyContent: 'center' },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: PAD,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.card,
    // Мягкая тень: ползунок отделяется от трека, а не «нарисован» на нём.
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});

export default AnimatedSwitch;
