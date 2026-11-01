import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { AnimatedMascot } from './AnimatedMascot';
import { Confetti } from './Confetti';
import { colors, radius, spacing, typography } from '../theme/tokens';

/**
 * Общий каркас экранов входа и регистрации.
 *
 * Раньше `LoginScreen` и `RegisterScreen` дублировали `KeyboardAvoidingView`,
 * `Confetti`, маскота и карточку формы почти строка в строку — любое
 * изменение приходилось вносить дважды и они неизбежно расходились.
 *
 * Дети рендерятся внутри карточки формы; заголовок и подзаголовок передаются
 * пропсами, потому что вход анимирует их отдельно от формы.
 */
export default function AuthLayout({
  title,
  subtitle,
  celebrate = false,
  error = false,
  children,
}) {
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Confetti active={celebrate} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={ZoomIn.duration(600).springify().damping(8)}>
          <AnimatedMascot celebrate={celebrate} error={error} />
        </Animated.View>

        <Animated.Text
          entering={ZoomIn.delay(200).springify().damping(9).mass(0.6)}
          style={styles.title}
        >
          {title}
        </Animated.Text>
        <Animated.Text
          entering={ZoomIn.delay(280).springify().damping(9).mass(0.6)}
          style={styles.subtitle}
        >
          {subtitle}
        </Animated.Text>

        <Animated.View
          entering={ZoomIn.delay(350).springify().damping(11).mass(0.8)}
          style={styles.card}
        >
          {children}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: {
    padding: spacing.lg,
    alignItems: 'center',
    paddingBottom: spacing.xxl,
  },
  title: { ...typography.display, fontSize: 30, color: colors.text, marginTop: spacing.sm },
  subtitle: {
    ...typography.body,
    color: colors.subtext,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});

/** Стили, которые нужны обоим auth-экранам вне карточки. */
export const authFooterStyles = StyleSheet.create({
  footer: { alignItems: 'center', marginTop: spacing.lg },
  link: { ...typography.bodyStrong, color: colors.link },
  terms: {
    ...typography.micro,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resetLink: { ...typography.caption, color: colors.link },
  fullWidth: { width: '100%' },
  view: { width: '100%' },
});
