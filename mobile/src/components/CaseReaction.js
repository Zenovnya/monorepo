/**
 * Игровая реакция на ответ в кейсе: всплеск, тряска, искры.
 *
 * Зачем свой компонент, а не общий `Confetti`:
 *
 * 1. **Реакция должна быть короткой.** Конфетти на 2.5 с уместно на финише
 *    уровня, но не после каждого кейса — это задерживает следующее задание.
 *    Здесь всё укладывается в ~600 мс.
 * 2. **Реакция привязана к исходу.** Верно — золотые искры вверх, неверно —
 *    короткая тряска карточки и мягкое «проседание». Одна и та же анимация на
 *    оба исхода была бы ложным сигналом: человек ждёт, что приложение отличит
 *    его ответ.
 * 3. **Не блокирует интерфейс.** Всё в `pointerEvents="none"` и только на
 *    UI-потоке Reanimated: нажатие на «Следующий кейс» работает сразу.
 * 4. **Reduce-motion уважается.** При включённой настройке остаётся статичный
 *    значок, без движения — доступность важнее зрелищности.
 *
 * Важно: ни одна анимация не сообщает правильный ответ раньше, чем он пришёл с
 * сервера. Компонент получает уже известный исход (`correct: true/false/null`).
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { brand } from './KhokhlomaOrnament';
import { useReducedMotion } from '../hooks/useReducedMotion';

/** Число искр при верном ответе. 8 — заметно, но не заслоняет текст. */
const SPARKS = 8;

function Spark({ index, progress, reduced }) {
  // Искры разлетаются веером: угол равномерно по кругу, но верхняя половина
  // шире — так движение читается как «вверх», а не как взрыв.
  const angle = (index / SPARKS) * Math.PI * 2;
  const distance = 46 + (index % 3) * 14;
  const dx = Math.cos(angle) * distance;
  const dy = -Math.abs(Math.sin(angle)) * distance;

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: 1 - t,
      transform: [
        { translateX: dx * t },
        { translateY: dy * t },
        { scale: 1 - 0.5 * t },
      ],
    };
  });

  if (reduced) return null;
  return <Animated.View style={[styles.spark, style]} pointerEvents="none" />;
}

/**
 * @param {'correct'|'wrong'|null} outcome  Исход ответа.
 * @param {React.ReactNode} children        Карточка, к которой применяется тряска.
 * @param {number} seed                     Меняется при новом кейсе — перезапускает анимацию.
 */
export function CaseReaction({ outcome, children, seed = 0 }) {
  const reduced = useReducedMotion();
  const burst = useSharedValue(0);
  const shake = useSharedValue(0);

  useEffect(() => {
    // Сброс перед новой реакцией: иначе вторая вспышка начинается с середины.
    burst.value = 0;
    shake.value = 0;
    if (!outcome || reduced) return;

    if (outcome === 'correct') {
      burst.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) });
    } else if (outcome === 'wrong') {
      // Три коротких сдвига: заметно, но не раздражает. Амплитуда маленькая —
      // тряска всего экрана на телефоне читается как сбой приложения.
      shake.value = withSequence(
        withTiming(-7, { duration: 60 }),
        withTiming(6, { duration: 60 }),
        withTiming(-4, { duration: 55 }),
        withTiming(3, { duration: 55 }),
        withTiming(0, { duration: 70 })
      );
    }
  }, [outcome, seed, reduced, burst, shake]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={wrapStyle}>
        {children}
        {outcome === 'correct' ? (
          <View style={styles.burstOrigin} pointerEvents="none">
            {Array.from({ length: SPARKS }, (_, index) => (
              <Spark key={index} index={index} progress={burst} reduced={reduced} />
            ))}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/**
 * Значок исхода: галочка или крестик. Появляется пружиной.
 *
 * Нужен отдельно от искр: искры — украшение, а значок — информация. При
 * reduce-motion искры выключены, а значок остаётся.
 */
export function OutcomeBadge({ outcome, seed = 0 }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    scale.value = reduced ? 1 : 0;
    if (!outcome || reduced) return;
    scale.value = withDelay(40, withSpring(1, { damping: 11, stiffness: 220, mass: 0.6 }));
  }, [outcome, seed, reduced, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!outcome) return null;
  const good = outcome === 'correct';
  return (
    <Animated.View
      style={[styles.badge, good ? styles.badgeGood : styles.badgeBad, style]}
      pointerEvents="none"
    >
      <Animated.Text style={[styles.badgeText, good ? styles.badgeTextGood : styles.badgeTextBad]}>
        {good ? '✓' : '✕'}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative' },
  burstOrigin: {
    position: 'absolute',
    left: '50%',
    top: 24,
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: brand.gold,
  },
  badge: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeGood: { backgroundColor: brand.pine, borderColor: brand.pineDark },
  badgeBad: { backgroundColor: brand.red, borderColor: brand.redDark },
  badgeText: { fontSize: 18, fontWeight: '900' },
  badgeTextGood: { color: brand.goldLight },
  badgeTextBad: { color: '#FFF' },
});

export default CaseReaction;
