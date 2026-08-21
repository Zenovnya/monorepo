import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MascotSprite } from './MascotSprite';
import { colors } from '../theme/colors';

/**
 * LexEntrance — анимация въезда персонажа Lex в кейс типа lex_entrance.
 * Показывает подсказку (hint) после анимации и вибрацию.
 */
export const LexEntrance = ({ hint, onDone }) => {
  const translateX = useSharedValue(-300);
  const opacity = useSharedValue(0);
  const [emotion, setEmotion] = useState('happy');

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackStyle.Medium);
    // Crossfade эмоций: сначала happy, затем think (въезжает и задумывается).
    setEmotion('cheer');
    translateX.value = withSequence(
      withTiming(0, {
        duration: 700,
        easing: Easing.out(Easing.back(1.5)),
      }),
      withDelay(300, withTiming(0, { duration: 100 }))
    );
    const t = setTimeout(() => setEmotion('think'), 800);
    opacity.value = withDelay(900, withTiming(1, { duration: 400 }));
    return () => clearTimeout(t);
  }, [translateX, opacity]);

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={mascotStyle}>
        <MascotSprite emotion={emotion} size={180} />
      </Animated.View>
      {hint ? (
        <Animated.View style={[styles.hint, hintStyle]}>
          <Text style={styles.hintText}>{hint}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 20 },
  hint: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    maxWidth: 300,
  },
  hintText: { fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'center' },
});