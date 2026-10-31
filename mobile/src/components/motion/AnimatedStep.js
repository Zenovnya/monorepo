/**
 * Анимированный переход между шагами (онбординг, кейс, оценка).
 *
 * Уходящий шаг уезжает влево и гаснет, входящий идёт справа. Направление
 * инвертируется при движении назад, чтобы «отмена» ощущалась как отмена.
 *
 * При reduce-motion смена происходит мгновенно — контент меняется, но без
 * перемещения по экрану.
 */

import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { duration as durations, easing } from '../../theme/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const OFFSET_X = 28;

/**
 * @param {number} step       Текущий шаг (обычно индекс).
 * @param {string} direction  'forward' | 'backward'.
 * @param {boolean} active    Если false — шаг скрыт (display: none).
 */
export const AnimatedStep = ({
  children,
  step = 0,
  direction = 'forward',
  active = true,
  style,
  ...rest
}) => {
  const reduced = useReducedMotion();
  const progress = useSharedValue(active && !reduced ? 0 : 1);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }

    progress.value = withTiming(1, {
      duration: durations.step,
      easing: easing.step,
    });
  }, [progress, step, reduced]);

  const animatedStyle = useAnimatedStyle(() => {
    const sign = direction === 'backward' ? -1 : 1;
    return {
      opacity: progress.value,
      transform: [{ translateX: (1 - progress.value) * OFFSET_X * sign }],
    };
  });

  if (!active) {
    return null;
  }

  return (
    <Animated.View style={[style, animatedStyle]} {...rest}>
      {children}
    </Animated.View>
  );
};

export default AnimatedStep;
