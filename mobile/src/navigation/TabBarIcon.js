/**
 * Иконка нижней навигации в духе Duolingo.
 *
 * Активная вкладка: красная иконка на мягком терракотовом кругу, чуть
 * больше размера, с пружинным «подбросом» — круг появляется не резко,
 * а с лёгкой анимацией. Так выбранный раздел явно и изящно выделяется,
 * и пользователь сразу видит, на каком экране он находится.
 * Неактивная — приглушённый оттенок, без круга, возвращается в покой
 * без резкости.
 *
 * Прыжок делается через отрицательный translateY с пружиной: элементы
 * не смещают соседей (в отличие от изменения lineHeight или margin).
 */

import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/colors';

export const TabBarIcon = ({ glyph, focused }) => {
  const reduced = useReducedMotion();
  const lift = useSharedValue(focused ? 1 : 0);
  const disc = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      lift.value = focused ? 1 : 0;
      disc.value = focused ? 1 : 0;
      return;
    }
    if (focused) {
      lift.value = withSequence(
        withSpring(1.4, { damping: 9, stiffness: 260 }),
        withSpring(1, { damping: 12, stiffness: 180 })
      );
      disc.value = withSpring(1, { damping: 14, stiffness: 220 });
    } else {
      lift.value = withSpring(0, { damping: 16, stiffness: 200 });
      disc.value = withTiming(0, { duration: 180 });
    }
  }, [focused, lift, disc, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -4 * lift.value },
      { scale: 1 + 0.16 * lift.value },
    ],
  }));

  const discStyle = useAnimatedStyle(() => ({
    opacity: disc.value,
    transform: [{ scale: 0.7 + 0.3 * disc.value }],
  }));

  return (
    <Animated.View style={[styles.wrap, style]}>
      <Animated.View style={[styles.disc, discStyle]} />
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
  disc: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.errorTint,
  },
  glyph: { fontSize: 24, color: colors.subtext },
  glyphActive: { color: colors.error },
});

export default TabBarIcon;
