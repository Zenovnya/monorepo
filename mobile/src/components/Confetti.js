import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const COLORS = ['#F3A737', '#D64545', '#4CAF50', '#3B82F6', '#B5502A', '#FFD54F'];
const PARTICLE_COUNT = 40;

const ConfettiPiece = ({ color, startX, delay, active, isCircle }) => {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      opacity.value = 1;
      translateY.value = withDelay(
        delay,
        withTiming(600 + Math.random() * 200, {
          duration: 2000 + Math.random() * 800,
          easing: Easing.out(Easing.quad),
        })
      );
      translateX.value = withDelay(
        delay,
        withTiming((Math.random() - 0.5) * 150, { duration: 2000, easing: Easing.out(Easing.quad) })
      );
      rotate.value = withDelay(
        delay,
        withTiming(360 * (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 2), { duration: 2000 })
      );
      opacity.value = withDelay(1600, withTiming(0, { duration: 500 }));
    } else {
      translateY.value = -20;
      translateX.value = 0;
      rotate.value = 0;
      opacity.value = 0;
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { left: startX, backgroundColor: color, borderRadius: isCircle ? 6 : 2 },
        style,
      ]}
    />
  );
};

export const Confetti = ({ active }) => {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
        color: COLORS[i % COLORS.length],
        startX: Math.random() * width,
        delay: Math.random() * 300,
        isCircle: i % 3 === 0,
      })),
    []
  );

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <ConfettiPiece key={i} {...p} active={active} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  particle: {
    position: 'absolute',
    top: 0,
    width: 10,
    height: 10,
  },
});