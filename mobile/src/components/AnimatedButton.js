import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';

const PRESS_DEPTH = 6;

export const AnimatedButton = ({ title, onPress, loading, style, variant = 'primary' }) => {
  const translateY = useSharedValue(0);
  const [pressed, setPressed] = useState(false);

  const topStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed ? PRESS_DEPTH : translateY.value }],
  }));

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateY.value = withTiming(PRESS_DEPTH, { duration: 80 });
    setPressed(true);
  };

  const handlePressOut = () => {
    translateY.value = withSpring(0, { damping: 6, stiffness: 300 });
    setPressed(false);
  };

  const isOutline = variant === 'outline';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={loading}
      style={[styles.wrapper, style]}
    >
      <Animated.View
        style={[styles.bottomLayer, isOutline ? styles.outlineBottom : styles.primaryBottom]}
      />
      <Animated.View style={[styles.topLayer, isOutline ? styles.outlineTop : styles.primaryTop, topStyle]}>
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={[styles.text, isOutline && { color: colors.text }]}>{title}</Text>
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
  primaryBottom: { backgroundColor: colors.accentPressed },
  outlineBottom: { backgroundColor: '#E4D9C8' },
  topLayer: {
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  primaryTop: { backgroundColor: colors.accent },
  outlineTop: { backgroundColor: colors.card },
  text: { fontSize: 18, fontWeight: '700', color: colors.text },
});