import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
import { PressableScale } from '../components/PressableScale';
import { AnimatedInput } from '../components/AnimatedInput';
import { AnimatedMascot } from '../components/AnimatedMascot';
import {
  brand,
  KhokhlomaMedallion,
  KhokhlomaDivider,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';
import { authApi } from '../api/auth';
import { describeNetworkError } from '../api/client';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Экран запроса сброса пароля.
 *
 * До этого ссылка «Забыли?» на экране входа была обычным текстом без
 * обработчика: пользователь, забывший пароль, не мог восстановить доступ.
 * Ответ сервера намеренно не сообщает, существует ли аккаунт — экран
 * показывает одинаковое подтверждение в любом случае.
 */
export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);

  const submit = async () => {
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Введите корректный email');
      emailRef.current?.shake();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
      setSent(true);
    } catch (err) {
      setError(describeNetworkError(err));
      emailRef.current?.shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <PaperGrain />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PressableScale
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          style={[styles.backBtn]}
        >
          <Text style={styles.backText}>←</Text>
        </PressableScale>

        <Animated.View entering={FadeIn.duration(220)}>
          <KhokhlomaMedallion size={132} style={styles.medallion}>
            <AnimatedMascot
              size={112}
              wave
              emotion={sent ? 'happy' : 'neutral'}
            />
          </KhokhlomaMedallion>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(260)}>
          <Text style={styles.title}>
            {sent ? 'Письмо отправлено' : 'Восстановление доступа'}
          </Text>
          <Text style={styles.subtitle}>
            {sent
              ? 'Если аккаунт с таким email существует, мы отправили ссылку для сброса пароля. Проверьте почту и папку «Спам».'
              : 'Укажите email, на который зарегистрирован аккаунт, — пришлём ссылку для сброса пароля.'}
          </Text>

          <KhokhlomaDivider style={styles.divider} />

          {sent ? (
            <View style={styles.sentBox}>
              <Text style={styles.sentText}>
                Ссылка действует 30 минут и срабатывает один раз.
              </Text>
              <PressableScale
                onPress={() => setSent(false)}
                accessibilityRole="button"
                style={styles.linkHit}
              >
                <Text style={styles.retryLink}>Отправить ещё раз</Text>
              </PressableScale>
            </View>
          ) : (
            <>
              <AnimatedInput
                ref={emailRef}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError(null);
                }}
                error={error}
                label="Email"
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
              />

              <AnimatedButton
                title="Отправить ссылку"
                onPress={submit}
                loading={loading}
                style={styles.submitBtn}
              />
            </>
          )}

          <PressableScale
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
            style={[styles.footer]}
          >
            <Text style={styles.footerLink}>Вернуться ко входу</Text>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Область нажатия для текстовых ссылок: сам текст тонкий, палец промахивается.
  linkHit: { paddingVertical: 6, alignSelf: 'flex-start' },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 54,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: brand.rule,
    backgroundColor: colors.card,
    marginBottom: 8,
  },
  backText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  medallion: {
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.subtext,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  divider: {
    marginVertical: 20,
  },
  submitBtn: {
    marginTop: 18,
  },
  sentBox: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: brand.pineBorder,
    backgroundColor: brand.pineSoft,
    alignItems: 'center',
    gap: 10,
  },
  sentText: {
    color: brand.pineDark,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '600',
  },
  retryLink: {
    color: brand.pine,
    fontWeight: '800',
    fontSize: 13,
  },
  footer: {
    marginTop: 26,
    alignItems: 'center',
  },
  footerLink: {
    color: colors.link,
    fontWeight: '700',
    fontSize: 13.5,
  },
});
