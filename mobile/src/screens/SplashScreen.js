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
 */

import React, { useEffect } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { colors } from '../theme/colors';
import { brand } from '../components/KhokhlomaOrnament';

/** Минимальная продолжительность приветствия, чтобы оно не мелькнуло. */
const MIN_MS = 1400;

/**
 * Экран загрузки с анимацией маскота.
 *
 * `onDone` вызывается после того, как гидратация завершена (и прошло
 * MIN_MS), и приложение переходит к навигации.
 */
export default function SplashScreen({ onDone }) {
  // Текущее значение анимации: 0 = до входа, 1 = маскот на месте.
  const progress = React.useRef(new Animated.Value(0)).current;
  // onDone в рефре: callback создаётся заново при каждом рендере, и если
  // положить его в deps useEffect, анимация перезапускалась бы заново.
  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let timer;
    const start = Date.now();

    // Enter: маскот входит на экран (поднимается снизу + наклон).
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Если гидратация уже готова раньше MIN_MS — держим приветствие
    // до MIN_MS, чтобы оно было видно.
    timer = setTimeout(() => {
      // Плавный выход: опускаем маскота и затем уходим.
      Animated.timing(progress, {
        toValue: 0,
        duration: 450,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        doneRef.current?.();
      });
      void start;
    }, MIN_MS);

    return () => {
      clearTimeout(timer);
      progress.stopAnimation();
    };
  }, [progress]);

  // Трансформации: маскот входит снизу, плавно поворачивается, и лапа
  // (wave) даёт пять — это эффект приветствия.
  const enterStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.6, 1],
      outputRange: [0, 0.6, 1],
    }),
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [80, 0],
        }),
      },
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.7, 1],
        }),
      },
      {
        rotate: progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['-6deg', '0deg'],
        }),
      },
    ],
  };

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
        <Animated.Text
          style={[
            styles.caption,
            {
              opacity: progress.interpolate({
                inputRange: [0.4, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
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
