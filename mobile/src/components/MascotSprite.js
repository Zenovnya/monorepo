import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';

/**
 * MascotSprite — рендер маскота Lex с crossfade между эмоциями.
 *
 * Поддерживает эмоции: idle | happy | sad | cheer | think.
 * При смене emotion плавно скрывает текущую картинку и показывает новую
 * (crossfade). Для MVP использует один ассет bear.png, меняя только
 * масштаб/прозрачность для передачи настроения. При наличии отдельных
 * PNG-эмоций достаточно добавить их в require-маппинг.
 */
const EMOTION_STYLE = {
  idle: { scale: 1, rotate: '0deg' },
  happy: { scale: 1.08, rotate: '0deg' },
  cheer: { scale: 1.15, rotate: '-6deg' },
  sad: { scale: 0.92, rotate: '0deg' },
  think: { scale: 1, rotate: '4deg' },
};

export const MascotSprite = ({ emotion = 'idle', size = 120 }) => {
  const fade = useRef(new Animated.Value(1)).current;
  const [currentEmotion, setCurrentEmotion] = useState(emotion);

  useEffect(() => {
    if (emotion === currentEmotion) return;
    // Сначала плавно скрываем текущий спрайт, затем показываем новый.
    Animated.timing(fade, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setCurrentEmotion(emotion);
      Animated.timing(fade, {
        toValue: 1,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [emotion, currentEmotion, fade]);

  const style = EMOTION_STYLE[currentEmotion] || EMOTION_STYLE.idle;

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        opacity: fade,
        transform: [{ scale: style.scale }, { rotate: style.rotate }],
      }}
    >
      <Image
        source={require('../../assets/bear.png')}
        style={styles.bear}
        resizeMode="contain"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bear: { width: '100%', height: '100%' },
});