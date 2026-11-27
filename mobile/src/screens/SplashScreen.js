/**
 * Запускная анимация: маскот LexBear выходит на экран и даёт пять
 * своей лапкой, пока идёт загрузка приложения (гидратациония токенов).
 *
 * Почему анимация вместо спиннера: первое впечатление — это всё. Пульс
 * спиннера выглядит как «приложение висит», а выходиящий мишка, который
 * приветствует, даёт понять, что приложение живое и готово к работе.
 *
 * Анимация ограничена по времени: гидратация токенов — локальное
 * чтение из хранилища (быстрее 100 мс), но чтобы человек успел увидеть
 * приветствие, экран держится не меньше MIN_MS, а затем уходит, когда
 * навигация уже готова.
 *
 * Анимация живёт полностью на UI-потоке Reanimated (скилл rn-juicy-gamification,
 * §1): никакого React Native Animated / Animated.timing.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { colors } from '../theme/colors';
import { brand } from '../components/KhokhlomaOrnament';
import { useReducedMotion } from '../hooks/useReducedMotion';

/** Минимальная продолжительность приветствия, чтобы оно не мелькнуло. */
const MIN_MS = 1400;

/**
 * Экран загрузки с анимацией маскота.
 *
 * `onDone` вызывается после того, как гидратация завершена (и прошло
 * MIN_MS), и приложение переходит к навигации.
 */
export default function SplashScreen({ onDone }) {
  const reduced = useReducedMotion();
  // 0 = до входа, 1 = маскот на месте, 0 (после MIN_MS) = ушёл.
  const progress = useSharedValue(0);

  // onDone в рефре: callback создаётся заново при каждом рендере, и если
  // положить его в deps useEffect, анимация перезапускалась бы заново.
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;
  // Сtable-ref-амнемоник для вызова из worklet-callback: на выходе
  // проверяем `done` (анимация не прервана) и вызываем callback на JS-потоке.
  const finishRef = React.useRef((done) => {
    if (done) doneRef.current?.();
  });

  useEffect(() => {
    let timer;

    // Enter: маскот входит на экран (поднимается снизу + наклон).
    // При reduce-motion — значение сразу, без промежуточных кадров.
    progress.value = withTiming(1, {
      duration: reduced ? 0 : 700,
      easing: reduced ? Easing.linear : Easing.out(Easing.cubic),
    });

    // Если гидратация уже готова раньше MIN_MS — держим приветствие
    // до MIN_MS, чтобы оно было видно.
    timer = setTimeout(() => {
      // Плавный выход: опускаем маскота и затем уходим.
      progress.value = withTiming(
        0,
        {
          duration: reduced ? 0 : 450,
          easing: reduced ? Easing.linear : Easing.in(Easing.cubic),
        },
        (done) => {
          runOnJS(finishRef.current)(done);
        }
      );
    }, MIN_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [progress, reduced]);

  // Трансформации: маскот входит снизу, плавно поворачивается, и лапа
  // (wave) даёт пять — это эффект приветствия.
  const enterStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.6 ? p / 0.6 * 0.6 : p,
      transform: [
        { translateY: (1 - p) * 80 },
        { scale: 0.7 + 0.3 * p },
        { rotate: `${-6 + 6 * p}deg` },
      ],
    };
  });

  const captionStyle = useAnimatedStyle(() => ({
    opacity: progress.value >= 0.4 ? (progress.value - 0.4) / 0.6 : 0,
  }));

  return (
    <View style={styles.container}>
      {/* Позади — мягкий фон с лёгким сиянием, как у заглавного экрана. */}
      <View style={styles.glow} pointerEvents="none" />
      <Animated.View style={[styles.mascotWrap, enterStyle]}>
        <AnimatedMascot
          size={240}
          emotion="neutral"
          wave
        />
        {/* Подпись под мишкой — «Приветствую» в стиле проекта. */}
        <Animated.Text style={[styles.caption, captionStyle]}>
          Приветствую! Готов к работе
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: brand.goldSoft,
    opacity: 0.35,
  },
  mascotWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  caption: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
