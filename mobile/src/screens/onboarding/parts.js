/**
 * Мелкие части онбординга: индикатор шагов и карточки выбора.
 *
 * Вынесены отдельно, чтобы сам экран читался как сценарий, а не как набор
 * стилей. Вся анимация — через токены `theme/motion` и с учётом reduce-motion.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { spring, duration as durations } from '../../theme/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/** Точки прогресса: активная точка растягивается пружиной. */
export const StepDots = ({ step, count = 3 }) => (
  <View style={styles.dots} accessibilityLabel={`Шаг ${step + 1} из ${count}`}>
    {Array.from({ length: count }).map((_, i) => (
      <Dot key={i} active={i === step} passed={i < step} />
    ))}
  </View>
);

const Dot = ({ active, passed }) => {
  const reduced = useReducedMotion();
  const width = useSharedValue(active ? 32 : 16);

  useEffect(() => {
    const target = active ? 32 : 16;
    width.value = reduced ? target : withSpring(target, spring.press);
  }, [active, reduced, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: active || passed ? colors.accent : colors.track },
        animatedStyle,
      ]}
    />
  );
};

/** Общий хук «нажатие сжимает карточку». */
function usePressScale() {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const onPressIn = () => {
    scale.value = reduced ? 1 : withTiming(0.97, { duration: durations.press });
  };
  const onPressOut = () => {
    scale.value = reduced ? 1 : withSpring(1, spring.press);
  };

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { animatedStyle, onPressIn, onPressOut };
}

/** Карточка цели: выбранное состояние — золотая рамка и тинт. */
export const GoalCard = ({ icon, label, selected, onPress }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={animatedStyle}>
      <Text
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.goalCard, selected && styles.selected]}
      >
        <Text style={styles.goalIcon}>{icon}</Text>
        <Text style={styles.goalLabel}>{label}</Text>
      </Text>
    </Animated.View>
  );
};

/** Карточка «N минут в день». */
export const MinuteCard = ({ value, selected, onPress }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={animatedStyle}>
      <Text
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${value} минут в день`}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.minCard, selected && styles.selected]}
      >
        <Text style={styles.minValue}>{value}</Text>
        <Text style={styles.minLabel}>мин</Text>
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingTop: spacing.xl,
  },
  dot: { height: spacing.sm, borderRadius: radius.pill },
  goalCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.track,
    borderRadius: radius.lg,
    padding: spacing.base,
  },
  selected: {
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: colors.goldTint,
  },
  goalIcon: { fontSize: 28 },
  goalLabel: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.xs + 2,
  },
  minCard: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.track,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  minValue: { ...typography.display, color: colors.text },
  minLabel: { ...typography.caption, fontWeight: '600', color: colors.subtext },
});
