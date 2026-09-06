import React, { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../theme/colors';

// Единый растровый маскот. Иллюстрированный медведь вместо собранного из ~20
// SVG-слоёв рига — рисуется как одна текстура, поэтому плавно на любом телефоне.
const BEAR = require('../../assets/bear.png');

/**
 * MascotImage — лёгкий маскот: один `<Image>` в круглом медальоне с мягким
 * «покачиванием» (idle) и коротким «попом» на реакцию.
 *
 * Почему так: прежний BearRig собирал медведя из множества независимых
 * react-native-svg слоёв с несколькими бесконечными анимациями — на реальном
 * устройстве это давало просадки кадров. Здесь одна текстура и один трансформ
 * на UI-потоке → стабильно плавно.
 *
 * ``reaction``: 'idle' | 'celebrate' | 'sad'. Круглая рамка скрывает
 * непрозрачный фон исходного PNG и выглядит как аккуратный портрет-медальон.
 */
export function MascotImage({ size = 160, reaction = 'idle' }) {
  const bob = useSharedValue(0);
  const pop = useSharedValue(1);

  // Мягкое «дыхание/покачивание» — бесконечно, но это один дешёвый трансформ.
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-size * 0.03, { duration: 1500 }),
        withTiming(0, { duration: 1500 }),
      ),
      -1,
      true,
    );
  }, [bob, size]);

  // Короткая реакция при смене состояния: радость — подпрыгивание, грусть —
  // лёгкое «проседание».
  useEffect(() => {
    if (reaction === 'celebrate') {
      pop.value = withSequence(
        withTiming(1.12, { duration: 160 }),
        withTiming(1, { duration: 240 }),
      );
    } else if (reaction === 'sad') {
      pop.value = withSequence(
        withTiming(0.94, { duration: 180 }),
        withTiming(1, { duration: 260 }),
      );
    }
  }, [reaction, pop]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }, { scale: pop.value }],
  }));

  const ring = Math.max(3, Math.round(size * 0.028));

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring,
          borderColor: colors.border,
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
        }}
      >
        <Image
          source={BEAR}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>
    </Animated.View>
  );
}

export default MascotImage;
