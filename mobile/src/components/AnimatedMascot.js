import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { MascotSprite } from './MascotSprite';

/**
 * AnimatedMascot — анимированный маскот Lex.
 *
 * Поддерживает:
 * - режимы celebrate (празднование) и error (ошибка) для форм;
 * - пропс emotion для crossfade эмоций (idle/happy/sad/cheer/think).
 */
export const AnimatedMascot = ({ celebrate, error, emotion, size = 220 }) => {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const [effectiveEmotion, setEffectiveEmotion] = useState(
    emotion || (celebrate ? 'cheer' : 'idle')
  );

  // Постоянное «дыхание» маскота.
  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [translateY]);

  // Режим празднования.
  useEffect(() => {
    if (celebrate) {
      setEffectiveEmotion('cheer');
      scale.value = withSequence(
        withSpring(1.15, { damping: 4, stiffness: 200 }),
        withSpring(1, { damping: 5, stiffness: 200 })
      );
      rotate.value = withSequence(
        withTiming(-8, { duration: 100 }),
        withTiming(8, { duration: 100 }),
        withTiming(0, { duration: 100 })
      );
    }
  }, [celebrate, scale, rotate]);

  // Режим ошибки.
  useEffect(() => {
    if (error) {
      setEffectiveEmotion('sad');
      rotate.value = withSequence(
        withTiming(-4, { duration: 80 }),
        withTiming(4, { duration: 80 }),
        withTiming(-3, { duration: 80 }),
        withTiming(0, { duration: 80 })
      );
    }
  }, [error, rotate]);

  // Внешняя эмоция (если передана) — синхронизируем.
  useEffect(() => {
    if (emotion && !celebrate && !error) {
      setEffectiveEmotion(emotion);
    }
  }, [emotion, celebrate, error]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[style, { width: size, height: size }]}>
      <MascotSprite emotion={effectiveEmotion} size={size} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bear: { width: '100%', height: '100%' },
});