/**
 * Хук reduce-motion: уважает системную настройку «уменьшить движение».
 *
 * Используется вместе с `theme/motion.js`: если пользователь отключил анимации
 * (или это требование доступности), длительности становятся 0, а декоративные
 * эффекты (конфетти, прыжки маскота) не запускаются. Функциональность при этом
 * полностью сохраняется — экран просто появляется сразу.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let cached = null;
const listeners = new Set();

function publish(value) {
  cached = value;
  listeners.forEach((listener) => listener(value));
}

/**
 * Возвращает `true`, если систему просили уменьшить движение.
 *
 * Первый вызов подписывается на изменения настройки; значение кешируется, чтобы
 * десятки компонентов не поднимали собственные подписки.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(cached ?? false);

  useEffect(() => {
    listeners.add(setReduced);

    if (cached === null) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then(publish)
        .catch(() => publish(false));

      // changeReduceMotion — актуальное имя события в RN 0.7x+.
      const subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        publish
      );

      return () => {
        listeners.delete(setReduced);
        subscription?.remove?.();
      };
    }

    return () => listeners.delete(setReduced);
  }, []);

  return reduced;
}

/** Длительность с учётом reduce-motion: 0, если движение отключено. */
export function durationOrInstant(ms, reduced) {
  return reduced ? 0 : ms;
}

export default useReducedMotion;
