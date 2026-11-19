/**
 * TactilePressable — переиспользуемый 3D-элемент с «физикой» нажатия.
 *
 * Зачем отдельный компонент (редизайн по техзаданию UI/UX, §0.2):
 * - Кнопки и карточки должны выглядеть тактильно: borderWidth: 1.5,
 *   borderBottomWidth: 5 (нижняя грань на 15–20% темнее), пружинистое
 *   нажатие с translateY, виброотклик через expo-haptics.
 * - Нажатие живёт на UI-потоке Reanimated: элемент «проседает» под пальцем
 *   и мягко возвращается, без ре-рендера в JS.
 *
 * `style` принимается и объектом, и функцией `({ pressed }) => style`.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { duration as durations, easing } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

// createAnimatedComponent вне компонента: иначе Reanimated пересоздаёт
// обёртку на каждый рендер и сбрасывает анимацию.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * @param {number}  scale        До какого масштаба проседать (0.97 — карточки, 0.94 — кнопки).
 * @param {number}  pressDepth   Дополнительный сдвиг вниз в px (для «кнопок на подошве»).
 * @param {'none'|'light'|'medium'|'heavy'} hapticStyle  Виброотклик при нажатии.
 * @param {boolean} haptic       Дать тактильный отклик.
 * @param {number}  borderDepth  Толщина нижней грани в ненажатом состоянии (5 для кнопок).
 */
export const TactilePressable = ({
  children,
  onPress,
  onPressIn,
  onPressOut,
  style,
  scale = 0.97,
  pressDepth = 3,
  haptic = false,
  hapticStyle = 'light',
  borderDepth = 5,
  disabled,
  ...rest
}) => {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const press = useSharedValue(0);

  const inactive = Boolean(disabled) || !onPress;

  const hapticAsync = (styleName) => {
    const map = {
      none: () => {},
      light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
      heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    };
    map[styleName]?.().catch(() => {});
  };

  const animatedStyle = useAnimatedStyle(() => {
    const depth = pressDepth * press.value;
    return {
      transform: [
        { scale: 1 - (1 - scale) * press.value },
        { translateY: depth },
      ],
    };
  });

  const handlePressIn = (event) => {
    if (inactive) return;
    setPressed(true);
    if (haptic) hapticAsync(hapticStyle);
    if (reduced) {
      press.value = 1;
    } else {
      press.value = withTiming(1, {
        duration: durations.press,
        easing: easing.enter,
      });
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event) => {
    if (inactive) return;
    setPressed(false);
    press.value = reduced
      ? 0
      : withSpring(0, {
          damping: 15,
          stiffness: 260,
          mass: 0.6,
          overshootClamping: false,
        });
    onPressOut?.(event);
  };

  const resolvedStyle = typeof style === 'function' ? style({ pressed }) : style;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={inactive}
      style={[styles.base, { borderBottomWidth: borderDepth }, resolvedStyle, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
  },
});

export default TactilePressable;
