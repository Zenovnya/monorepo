/**
 * Иконка нижней навигации в духе Duolingo.
 *
 * Активная вкладка: красная иконка, чуть больше размера, с пружинным
 * «подбросом» — как в Duolingo, где выбранный элемент явно выделяется.
 * Неактивная — приглушённый оттенок, возвращается в покой без резкости.
 *
 * Прыжок делается через отрицательный translateY с пружиной: элементы не
 * смещают соседей (в отличие от изменения lineHeight или margin).
 */

import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/colors';

export const TabBarIcon = ({ glyph, focused }) => {
  const reduced = useReducedMotion();
  const lift = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      lift.value = focused ? 1 : 0;
      return;
    }
    if (focused) {
      lift.value = withSequence(
        withSpring(1.4, { damping: 9, stiffness: 260 }),
        withSpring(1, { damping: 12, stiffness: 180 })
      );
    } else {
      lift.value = withSpring(0, { damping: 16, stiffness: 200 });
    }
  }, [focused, lift, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -4 * lift.value },
      { scale: 1 + 0.16 * lift.value },
    ],
  }));

  return (
    <Animated.View style={[styles.wrap, style]}>
      <Text
        style={[styles.glyph, focused && styles.glyphActive]}
        allowFontScaling={false}
      >
        {glyph}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 24, color: colors.subtext },
  glyphActive: { color: colors.error },
});

export default TabBarIcon;
