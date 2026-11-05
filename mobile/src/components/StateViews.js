/**
 * Единые состояния экрана: ошибка, пусто, загрузка.
 *
 * До этого каждый экран рисовал их по-своему (текст с кнопкой, маскот, голый
 * спиннер). Один компонент на всех держит одинаковую подачу и одинаковые
 * отступы, а также даёт единый способ повторить запрос.
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { AnimatedButton } from './AnimatedButton';
import { useReducedMotion } from '../hooks/useReducedMotion';

/** Скелетон-блок: пульсирующая заглушка на месте будущего контента. */
export const Skeleton = ({ height = 16, width = '100%', style }) => {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      pulse.value = 0.6;
      return;
    }

    pulse.value = withRepeat(
      withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[styles.skeleton, { height, width }, style, animatedStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
};

const CenteredState = ({ children }) => <View style={styles.centered}>{children}</View>;

/** Ошибка загрузки данных с возможностью повторить. */
export const ErrorState = ({
  title = 'Не удалось загрузить',
  message,
  onRetry,
  retryTitle = 'Повторить',
  action,
}) => (
  <CenteredState>
    <Text style={styles.title}>{title}</Text>
    {message ? <Text style={styles.body}>{message}</Text> : null}
    {action}
    {onRetry ? (
      <View style={styles.action}>
        <AnimatedButton title={retryTitle} onPress={onRetry} variant="outline" />
      </View>
    ) : null}
  </CenteredState>
);

/** Пустой результат: нет кейсов, нет статей, нет достижений. */
export const EmptyState = ({ title, message, actionTitle, onAction }) => (
  <CenteredState>
    <Text style={styles.title}>{title}</Text>
    {message ? <Text style={styles.body}>{message}</Text> : null}
    {onAction ? (
      <View style={styles.action}>
        <AnimatedButton title={actionTitle} onPress={onAction} />
      </View>
    ) : null}
  </CenteredState>
);

/** Загрузка: спиннер и, опционально, подпись. */
export const LoadingState = ({ label }) => (
  <CenteredState>
    <ActivityIndicator color={colors.text} size="large" />
    {label ? <Text style={[styles.body, styles.loadingLabel]}>{label}</Text> : null}
  </CenteredState>
);

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  body: { ...typography.body, color: colors.subtext, textAlign: 'center' },
  loadingLabel: { marginTop: spacing.md },
  action: { alignSelf: 'stretch', marginTop: spacing.lg },
  skeleton: {
    backgroundColor: colors.track,
    borderRadius: radius.sm,
  },
});

export default ErrorState;
