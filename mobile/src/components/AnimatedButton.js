/**
 * Главная кнопка приложения — «клавиша на подошве».
 *
 * Кнопка выглядит как физическая: верхний слой сдвигается вниз на глубину
 * подошвы и возвращается пружиной. Переписана ради плавности:
 *
 * 1. Нажатие больше не хранится в React-состоянии. Раньше `setPressed` на
 *    pressIn вызывал ре-рендер всего экрана в момент касания — на списках это
 *    заметно как залипание. Теперь всё живёт в shared value на UI-потоке.
 * 2. Сдвиг вниз — `withTiming` на 90 мс (палец ждёт мгновенной реакции),
 *    возврат — пружина с лёгким перелётом, чтобы «клавиша» щёлкнула.
 * 3. Появление/исчезновение disabled-состояния плавное: раньше opacity
 *    менялась скачком прямо в style.
 * 4. Уважается reduce-motion: при отключённых анимациях сдвиг происходит
 *    мгновенно, но кнопка остаётся такой же нажимаемой.
 */

import React, { useEffect } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { duration as durations, easing } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

const PRESS_DEPTH = 6;

export const AnimatedButton = ({
  title,
  onPress,
  loading,
  disabled,
  style,
  variant = 'primary',
  haptic = true,
}) => {
  const reduced = useReducedMotion();
  const isDisabled = Boolean(loading || disabled);
  const press = useSharedValue(0);

  // Плавное притухание при блокировке — вместо скачка opacity в style.
  const opacity = useSharedValue(isDisabled ? 0.55 : 1);
  useEffect(() => {
    opacity.value = withTiming(isDisabled ? 0.55 : 1, {
      duration: reduced ? 0 : durations.pressOut,
      easing: easing.enter,
    });
  }, [isDisabled, opacity, reduced]);

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: press.value * PRESS_DEPTH },
      // Верхний слой чуть «сплющивается» — вместе со сдвигом это читается как
      // настоящее нажатие клавиши, а не как картинка, уехавшая вниз.
      { scaleY: interpolate(press.value, [0, 1], [1, 0.965]) },
    ],
  }));

  const wrapperStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const handlePressIn = () => {
    if (isDisabled) return;
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    press.value = reduced
      ? 1
      : withTiming(1, { duration: durations.press, easing: easing.enter });
  };

  const handlePressOut = () => {
    press.value = reduced
      ? 0
      : withSpring(0, {
          damping: 12,
          stiffness: 320,
          mass: 0.5,
        });
  };

  const isOutline = variant === 'outline';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      style={[styles.wrapper, style]}
    >
      <Animated.View
        style={[
          styles.bottomLayer,
          isOutline ? styles.outlineBottom : styles.primaryBottom,
        ]}
      />
      <Animated.View
        style={[
          wrapperStyle,
          styles.topLayer,
          isOutline ? styles.outlineTop : styles.primaryTop,
          topStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FCF8F0" />
        ) : (
          <Text style={[styles.text, isOutline && { color: colors.text }]}>
            {title}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: { height: 64, justifyContent: 'flex-end' },
  bottomLayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 58,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
  },
  // Лаковый красный из фирменной палитры LexBear (док: основной CTA — #C9362B)
  primaryBottom: { backgroundColor: '#99241B' },
  outlineBottom: { backgroundColor: '#E4D9C8' },
  topLayer: {
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  primaryTop: { backgroundColor: colors.error }, // лаковый красный #C9362B
  outlineTop: { backgroundColor: colors.card },
  text: { fontSize: 18, fontWeight: '700', color: '#FCF8F0' },
});

export default AnimatedButton;
