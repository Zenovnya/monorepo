import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';

export const AnimatedCheckbox = ({ checked, onChange, label }) => {
  const iconStyle = useAnimatedStyle(() => ({
    opacity: withSpring(checked ? 1 : 0, { damping: 12 }),
    transform: [{ scale: withSpring(checked ? 1 : 0.3, { damping: 6, stiffness: 300 }) }],
  }));

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(checked ? 1.1 : 1, { damping: 5, stiffness: 300 }) }],
    backgroundColor: checked ? colors.accent : colors.card,
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange(!checked);
  };

  return (
    <Pressable style={styles.row} onPress={handlePress}>
      <Animated.View style={[styles.box, boxStyle]}>
        <Animated.View style={iconStyle}>
          <Ionicons name="checkmark" size={16} color={colors.text} />
        </Animated.View>
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  label: { fontSize: 14, color: colors.text },
});