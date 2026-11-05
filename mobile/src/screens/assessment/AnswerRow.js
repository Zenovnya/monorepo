/**
 * Строка варианта ответа — общий элемент для диагностики и кейсов.
 *
 * Все состояния (обычное / выбранное / верное / неверное / заблокированное)
 * описаны токенами, поэтому Assessment и Case flow выглядят одинаково.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { spring, duration as durations } from '../../theme/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * @param {'idle'|'selected'|'correct'|'incorrect'} status
 */
export const AnswerRow = ({ index = 0, text, selected, disabled, status = 'idle', onPress }) => {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const onPressIn = () => {
    if (disabled) return;
    scale.value = reduced ? 1 : withTiming(0.985, { duration: durations.press });
  };
  const onPressOut = () => {
    scale.value = reduced ? 1 : withSpring(1, spring.press);
  };

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const effective = selected && status === 'idle' ? 'selected' : status;
  const tone = TONES[effective];

  return (
    <Animated.View style={animatedStyle}>
      <Text
        accessibilityRole="radio"
        accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
        accessibilityLabel={`${String.fromCharCode(65 + index)}. ${text}`}
        disabled={disabled}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.row,
          { borderColor: tone.border, backgroundColor: tone.background },
          disabled && effective === 'idle' && styles.dimmed,
        ]}
      >
        <View style={[styles.badge, { backgroundColor: tone.badge }]}>
          <Text style={[styles.badgeText, { color: tone.badgeText }]}>
            {String.fromCharCode(65 + index)}
          </Text>
        </View>
        <Text style={styles.text}>{text}</Text>
      </Text>
    </Animated.View>
  );
};

const TONES = {
  idle: { border: colors.border, background: colors.card, badge: colors.track, badgeText: colors.text },
  selected: { border: colors.accent, background: colors.goldTint, badge: colors.accent, badgeText: colors.text },
  correct: { border: colors.success, background: colors.successTint, badge: colors.success, badgeText: colors.card },
  incorrect: { border: colors.error, background: colors.errorTint, badge: colors.error, badgeText: colors.card },
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base - 1,
    borderRadius: radius.md,
    borderWidth: 3,
    marginBottom: spacing.sm + 2,
  },
  dimmed: { opacity: 0.7 },
  badge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...typography.caption },
  text: { ...typography.body, color: colors.text, flex: 1 },
});
