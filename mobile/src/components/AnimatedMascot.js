import React, { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

export const AnimatedMascot = ({ celebrate, error }) => {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (celebrate) {
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
  }, [celebrate]);

  useEffect(() => {
    if (error) {
      rotate.value = withSequence(
        withTiming(-4, { duration: 80 }),
        withTiming(4, { duration: 80 }),
        withTiming(-3, { duration: 80 }),
        withTiming(0, { duration: 80 })
      );
    }
  }, [error]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Image source={require('../../assets/bear.png')} style={styles.bear} resizeMode="contain" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bear: { width: 220, height: 220 },
});