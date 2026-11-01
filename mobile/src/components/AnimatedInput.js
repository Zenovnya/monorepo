import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { TextInput, View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radius, sizes, spacing, typography } from '../theme/tokens';

/**
 * Поле ввода с приятной реакцией на фокус.
 *
 * Раньше фокус анимировал `scale` всей обёртки. На вебе трансформация
 * контейнера вместе с внутренним `TextInput` приводила к тому, что браузер
 * рисовал вокруг текста широкую полосу цвета фокуса — визуально «коричневые
 * полосы». Теперь анимируется только толщина акцентной рамки самой обёртки:
 * рамка всегда принадлежит полю, а не тексту.
 */
export const AnimatedInput = forwardRef(
  ({ label, error, secure, onFocus, onBlur, ...rest }, ref) => {
    const translateX = useSharedValue(0);
    const focus = useSharedValue(0); // 0 — покой, 1 — фокус
    const [hidden, setHidden] = useState(!!secure);

    useImperativeHandle(ref, () => ({
      shake: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        // Трясём только сдвигом: поворот и масштаб давали «пляшущий» текст
        // и артефакты отрисовки на вебе.
        translateX.value = withSequence(
          withTiming(-8, { duration: 60 }),
          withTiming(8, { duration: 60 }),
          withTiming(-6, { duration: 60 }),
          withTiming(6, { duration: 60 }),
          withTiming(0, { duration: 60 })
        );
      },
    }));

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
      borderWidth: 2 + focus.value,
      borderColor: interpolateColor(
        focus.value,
        [0, 1],
        [colors.border, colors.accent]
      ),
      backgroundColor: interpolateColor(
        focus.value,
        [0, 1],
        [colors.surfaceRaised, colors.goldTint]
      ),
    }));

    const handleFocus = (e) => {
      focus.value = withSpring(1, { damping: 16, stiffness: 180 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onFocus && onFocus(e);
    };

    const handleBlur = (e) => {
      focus.value = withSpring(0, { damping: 16, stiffness: 180 });
      onBlur && onBlur(e);
    };

    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <Animated.View
          style={[styles.inputWrapper, animatedStyle, error ? styles.inputWrapperError : null]}
        >
          <TextInput
            style={styles.input}
            placeholderTextColor={colors.subtext}
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
  field: { marginBottom: spacing.lg },
  label: {
    ...typography.caption,
    color: colors.subtext,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    height: sizes.button,
  },
  inputWrapperError: { borderColor: colors.error },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    // На вебе браузер рисует собственный outline вокруг input — убираем его,
    // чтобы фокус показывала только рамка поля.
    outlineStyle: 'none',
  },
  eyeBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
});
