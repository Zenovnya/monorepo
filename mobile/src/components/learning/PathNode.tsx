/**
 * PathNode — один узел змейки уроков.
 *
 * Три состояния:
 * - completed — акцентная заливка и галочка;
 * - active    — пульсирующее внешнее кольцо (Reanimated withRepeat),
 *               приподнятие и вибрация при появлении;
 * - locked    — приглушенная фигура, замок и подсказка «Пройдите
 *               предыдущий шаг» (shake + tooltip).
 *
 * Все анимации живут на UI-потоке.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import type { StepState } from './mockRoadmap';

const NODE_SIZE = 56;
const HALF = NODE_SIZE / 2;

interface PathNodeProps {
  /** Индекс узла по дорожной карте — задаёт фазу появления. */
  index: number;
  title: string;
  state: StepState;
  /** Нажатие на активный узел — переходит к уроку. */
  onPress?: () => void;
}

export function PathNode({ index, title, state, onPress }: PathNodeProps) {
  const isActive = state === 'active';
  const isCompleted = state === 'completed';

  const appear = useSharedValue(0);
  const pulse = useSharedValue(0);
  const shake = useSharedValue(0);
  const tipVisible = useSharedValue(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) {
      return;
    }
    mounted.current = true;

    appear.value = withDelay(
      index * 60,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }),
    );

    if (isActive) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 750, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: 750, easing: Easing.inOut(Easing.cubic) }),
        ),
        2,
        true,
      );
    }

    if (state === 'locked') {
      shake.value = withSequence(
        withTiming(10, { duration: 90 }),
        withTiming(-10, { duration: 90 }),
        withTiming(10, { duration: 90 }),
        withTiming(-10, { duration: 90 }),
        withTiming(0, { duration: 90 }),
      );
      tipVisible.value = withDelay(320, withTiming(1, { duration: 240 }));
    }
  }, [appear, index, isActive, pulse, shake, tipVisible, state]);

  const nodeStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: (1 - appear.value) * 28 },
        { scale: 0.5 + 0.5 * appear.value },
        { translateX: shake.value },
      ],
      opacity: appear.value,
      // Активный узел приподнят над линией.
      elevation: isActive ? 10 : 0,
      zIndex: isActive ? 2 : 1,
    }),
    [appear, isActive, shake],
  );

  const pulseStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: 0.9 + 0.25 * pulse.value }],
      opacity: 0.65 * (1 - pulse.value * 0.45),
    }),
    [pulse],
  );

  const tooltipStyle = useAnimatedStyle(
    () => ({
      opacity: tipVisible.value,
      transform: [
        { translateY: (1 - tipVisible.value) * -8 },
        { scale: 0.85 + 0.15 * tipVisible.value },
      ],
    }),
    [tipVisible],
  );

  const handlePress = useCallback(() => {
    if (isActive && onPress) {
      onPress();
    }
  }, [isActive, onPress]);

  const body = (
    <View style={styles.body} pointerEvents="none">
      <Animated.View style={[styles.nodeWrap, nodeStyle]}>
        {isActive && (
          <Animated.View style={[styles.pulseRing, pulseStyle]} pointerEvents="none">
            <Svg width={NODE_SIZE} height={NODE_SIZE}>
              <Circle
                cx={HALF}
                cy={HALF}
                r={HALF - 3}
                fill="none"
                stroke={colors.success}
                strokeWidth={5}
              />
            </Svg>
          </Animated.View>
        )}

        <Svg width={NODE_SIZE} height={NODE_SIZE}>
          <Circle
            cx={HALF}
            cy={HALF}
            r={HALF - 3}
            fill={
              isCompleted ? colors.success : isActive ? colors.paper : colors.locked
            }
            stroke={
              isCompleted
                ? colors.successDark
                : isActive
                  ? colors.success
                  : colors.locked
            }
            strokeWidth={3}
          />
          {isCompleted ? <CheckMark /> : state === 'locked' ? <LockMark /> : null}
        </Svg>
      </Animated.View>

      {state === 'locked' && (
        <Animated.View
          pointerEvents="none"
          style={[styles.tooltip, tooltipStyle]}
        >
          <Text style={styles.tooltipText}>Пройдите предыдущий шаг</Text>
        </Animated.View>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={!isActive}
      hitSlop={14}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      accessibilityRole={isActive ? 'button' : undefined}
      accessibilityLabel={title}
    >
      {body}
    </Pressable>
  );
}

function CheckMark() {
  return (
    <Path
      d="M20 30 L27 38 L40 22"
      fill="none"
      stroke={colors.paper}
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function LockMark() {
  return (
    <>
      <Path
        d="M22 33 V27 A10 10 0 0 1 40 27 V33"
        fill="none"
        stroke={colors.locked}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <Path
        d="M24 33 H40 V42 A3 3 0 0 1 37 45 H27 A3 3 0 0 1 24 42 Z"
        fill={colors.locked}
        stroke={colors.border}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
    width: NODE_SIZE + 28,
    marginBottom: 24,
  },
  pressed: {
    opacity: 0.8,
  },
  body: {
    alignItems: 'center',
  },
  nodeWrap: {
    zIndex: 1,
  },
  pulseRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
  },
  tooltip: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.text,
    borderRadius: 12,
    maxWidth: 230,
  },
  tooltipText: {
    color: colors.paper,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
