/**
 * Иконка нижней навигации с живым откликом на выбор вкладки.
 *
 * Раньше `tabBarIcon` отдавал просто `<Text>🎓</Text>` — переключение вкладки
 * выглядело как мгновенная замена картинки. Теперь активная иконка мягко
 * «подпрыгивает» и увеличивается, а неактивная плавно возвращается в покой:
 * это самый частый переход в приложении, и именно он задаёт ощущение
 * отзывчивости.
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
        withSpring(1.35, { damping: 9, stiffness: 260 }),
        withSpring(1, { damping: 12, stiffness: 180 })
      );
    } else {
      lift.value = withSpring(0, { damping: 16, stiffness: 200 });
    }
  }, [focused, lift, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -3 * lift.value },
      { scale: 1 + 0.12 * lift.value },
    ],
  }));

  return (
    <Animated.View style={[styles.wrap, style]}>
      <Text style={styles.glyph} allowFontScaling={false}>
        {glyph}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 22 },
});

export default TabBarIcon;
