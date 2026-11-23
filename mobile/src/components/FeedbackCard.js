/**
 * Единая карточка обратной связи для ответа на вопрос.
 *
 * Раньше Assessment и CaseDetail показывали результат по-разному (разные фоны,
 * отступы и способы подачи). Теперь оба используют этот компонент: он держит
 * одинаковую геометрию, одинаковые цвета состояний и одинаковое движение.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing, typography, elevation } from '../theme/tokens';
import { spring, duration as durations } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * @param {'correct'|'incorrect'|'neutral'} status
 * @param {string} title
 * @param {string} [body]  Разбор / пояснение.
 */
export const FeedbackCard = ({ status = 'neutral', title, body, style }) => {
  const reduced = useReducedMotion();
  const appear = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    appear.value = reduced
      ? withTiming(1, { duration: durations.instant })
      : withSpring(1, spring.feedback);
  }, [appear, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.96 + appear.value * 0.04 }],
  }));

  const tone = TONES[status] ?? TONES.neutral;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityLabel={body ? `${title}. ${body}` : title}
      style={[styles.card, elevation.card, { backgroundColor: tone.background }, style, animatedStyle]}
    >
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: tone.accent }]} />
        <Text style={[styles.title, { color: tone.title }]}>{title}</Text>
      </View>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </Animated.View>
  );
};

const TONES = {
  correct: { background: colors.successTint, accent: colors.success, title: colors.successDark },
  incorrect: { background: colors.errorTint, accent: colors.error, title: colors.verdictWrongTitle },
  neutral: { background: colors.goldTint, accent: colors.accent, title: colors.text },
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  title: { ...typography.heading, flex: 1 },
  body: { ...typography.body, color: colors.text },
});

export default FeedbackCard;
