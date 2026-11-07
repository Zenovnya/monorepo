import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BearLawyerMascot, MASCOT_ASPECT } from './mascot/BearLawyerMascot';

/**
 * MascotSprite — рендер векторного маскота Lex с crossfade между эмоциями.
 *
 * Раньше это была растровая заглушка (bear.png, масштаб/поворот как имитация
 * настроения). Теперь внутри полноценный векторный «Мишка-Юрист», а переданная
 * эмоция мапится на одну из 5 анимационных состояний рига.
 *
 * Поддерживаемые эмоции: idle | happy | sad | cheer | think | wave.
 */
const EMOTION_TO_RIG = {
  idle: 'neutral',
  happy: 'joyful',
  cheer: 'joyful',
  sad: 'sad',
  think: 'thoughtful',
  wave: 'joyful',
  strict: 'strict',
};

export const MascotSprite = ({ emotion = 'idle', size = 120 }) => {
  const fade = useSharedValue(1);
  const [currentEmotion, setCurrentEmotion] = useState(emotion);

  useEffect(() => {
    if (emotion === currentEmotion) return;
    // Сначала плавно скрываем текущую эмоцию, затем показываем новую.
    fade.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.quad) }, (finished) => {
      if (!finished) return;
      setCurrentEmotion(emotion);
      fade.value = withTiming(1, { duration: 180, easing: Easing.in(Easing.quad) });
    });
  }, [emotion, currentEmotion, fade]);

  const style = useAnimatedStyle(() => ({ opacity: fade.value }));

  const rigEmotion = EMOTION_TO_RIG[currentEmotion] || 'neutral';

  return (
    <Animated.View style={[{ width: size, height: size * MASCOT_ASPECT }, style]}>
      <View style={{ width: '100%', height: '100%' }}>
        <BearLawyerMascot
          emotion={rigEmotion}
          size={size}
          isTalking={currentEmotion === 'happy' || currentEmotion === 'wave'}
        />
      </View>
    </Animated.View>
  );
};

export default MascotSprite;
