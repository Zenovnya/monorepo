/**
 * Нажимаемая поверхность с «пружинным» откликом.
 *
 * Зачем отдельный компонент: в приложении 60+ мест, где нажатие показывалось
 * через `pressed && styles.xxx` — это смена стиля в JS, то есть ре-рендер и
 * мгновенный «щелчок» без движения. На глаз интерфейс от этого кажется резким:
 * палец давит, а карточка просто темнеет на один кадр.
 *
 * Здесь нажатие живёт на UI-потоке Reanimated: масштаб едет пружиной, поэтому
 * элемент «проседает» под пальцем и мягко возвращается. JS-состояние `pressed`
 * остаётся только для тех мест, где нужен именно сменный стиль.
 *
 * `style` принимается и объектом, и функцией `({ pressed }) => style` —
 * существующие экраны продолжают работать без переписывания.
 */

import React, { useState } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { duration as durations, easing } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * @param {number}  scale       До какого масштаба проседать (0.97 — карточки, 0.94 — кнопки).
 * @param {boolean} haptic      Дать тактильный отклик (для главных действий).
 * @param {number}  pressDepth  Дополнительный сдвиг вниз в px (для «кнопок на подошве»).
 */
// createAnimatedComponent вне компонента: иначе Reanimated пересоздаёт обёртку
// на каждый рендер и сбрасывает анимацию.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const PressableScale = ({
  children,
  onPress,
  onPressIn,
  onPressOut,
  style,
  scale = 0.97,
  pressDepth = 0,
  haptic = false,
  disabled,
  ...rest
}) => {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const press = useSharedValue(0);
  // Без onPress нажатие не интерактивно: подсвечивать «нажимаемым» статичную
  // строку — ложный сигнал, пользователь ждёт перехода, которого не будет.
  const inactive = Boolean(disabled) || !onPress;

  const animatedStyle = useAnimatedStyle(() => {
    // translateY округляем не мы: Reanimated сам держит это на UI-потоке.
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
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (reduced) {
      press.value = 1;
    } else {
      // Нажатие должно быть быстрее отпускания: палец ждёт мгновенной реакции,
      // а возврат — уже «анимация», ей можно дать пружину.
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
      style={[resolvedStyle, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};

export default PressableScale;
