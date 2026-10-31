/**
 * Motion-система LexBear.
 *
 * Единые длительности и кривые, чтобы движение «звучало» одинаково на всех
 * экранах. Правила:
 *
 *  1. Анимируются только `transform` и `opacity` — они идут на UI-поток
 *     Reanimated и не вызывают пересчёт layout.
 *  2. При включённом reduce-motion длительности становятся 0 (см.
 *     `useReducedMotion`), а декоративные эффекты (confetti, прыжки) не
 *     запускаются — но все действия остаются доступными.
 *  3. Анимация никогда не блокирует действие: обработчик нажатия срабатывает
 *     сразу, даже если элемент ещё «едет».
 */

import { Easing } from 'react-native-reanimated';

export const duration = {
  instant: 0,
  press: 90,
  pressOut: 220,
  enter: 260,
  feedback: 320,
  step: 300,
  celebrate: 600,
  celebrateLong: 900,
};

export const easing = {
  enter: Easing.out(Easing.cubic),
  exit: Easing.in(Easing.cubic),
  step: Easing.inOut(Easing.quad),
  linear: Easing.linear,
};

export const spring = {
  press: { damping: 6, stiffness: 300 },
  feedback: { damping: 12, stiffness: 180 },
  celebrate: { damping: 8, stiffness: 140 },
  settle: { damping: 18, stiffness: 120 },
};

/**
 * Задержка каскадного появления списка: элементы «входят» друг за другом.
 * Верхняя граница — чтобы длинный список не «въезжал» секундами.
 */
export const stagger = 40;
export const staggerMax = 6;

/** Появление элемента списка с задержкой по индексу. */
export function enterDelay(index = 0) {
  return Math.min(index, staggerMax) * stagger;
}

export default { duration, easing, spring, stagger, staggerMax, enterDelay };
