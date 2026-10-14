import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { TextInput, View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';

export const AnimatedInput = forwardRef(
  ({ label, error, secure, onFocus, onBlur, ...rest }, ref) => {
    const translateX = useSharedValue(0);
    const rotate = useSharedValue(0);
    const scale = useSharedValue(1);
    const [hidden, setHidden] = useState(!!secure);

    useImperativeHandle(ref, () => ({
      shake: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        translateX.value = withSequence(
          withTiming(-10, { duration: 60 }),
          withTiming(10, { duration: 60 }),
          withTiming(-8, { duration: 60 }),
          withTiming(8, { duration: 60 }),
          withTiming(0, { duration: 60 })
        );
        rotate.value = withSequence(
          withTiming(-2, { duration: 60 }),
          withTiming(2, { duration: 60 }),
          withTiming(0, { duration: 60 })
        );
      },
    }));

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { rotate: `${rotate.value}deg` },
        { scale: scale.value },
      ],
    }));

    const handleFocus = (e) => {
      scale.value = withSpring(1.02, { damping: 8, stiffness: 250 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onFocus && onFocus(e);
    };

    const handleBlur = (e) => {
      scale.value = withSpring(1, { damping: 8, stiffness: 250 });
      onBlur && onBlur(e);
    };

    return (
      <View style={{ marginBottom: 18 }}>
        <Text style={styles.label}>{label}</Text>
        <Animated.View
          style={[styles.inputWrapper, animatedStyle, error ? { borderColor: colors.error } : null]}
        >
          <TextInput
            style={styles.input}
            placeholderTextColor="#B7AA9A"
            secureTextEntry={hidden}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...rest}
          />
          {secure && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setHidden((v) => !v);
              }}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={hidden ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={colors.text}
              />
            </Pressable>
          )}
        </Animated.View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  label: { fontSize: 14, color: colors.text, marginBottom: 8, fontWeight: '500' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
  },
  input: { flex: 1, fontSize: 16, color: colors.text },
  eyeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: colors.error, fontSize: 12, marginTop: 6 },
});