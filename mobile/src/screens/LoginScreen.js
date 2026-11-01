import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AuthLayout, { authFooterStyles } from '../components/AuthLayout';
import { AnimatedButton } from '../components/AnimatedButton';
import { AnimatedInput } from '../components/AnimatedInput';
import { AnimatedCheckbox } from '../components/AnimatedCheckbox';
import { SocialButton } from '../components/SocialButton';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { useLogin } from '../hooks/useAuth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const navigation = useNavigation();
  const login = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [hasError, setHasError] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const triggerError = () => {
    setHasError(true);
    setTimeout(() => setHasError(false), 500);
  };

  const validate = () => {
    const nextErrors = {};
    if (!EMAIL_REGEX.test(email)) nextErrors.email = 'Введите корректный email';
    if (password.length < 8) nextErrors.password = 'Не меньше 8 символов';

    setErrors(nextErrors);
    if (nextErrors.email) emailRef.current?.shake();
    if (nextErrors.password) passwordRef.current?.shake();

    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = () => {
    if (!validate()) {
      triggerError();
      return;
    }
    login.mutate(
      { email, password },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setLoginSuccess(true);
          // Навигация на MainTabs произойдёт автоматически через RootNavigator,
          // т.к. isAuthenticated станет true в сторе.
        },
        onError: () => {
          setErrors({ password: 'Неверный email или пароль' });
          passwordRef.current?.shake();
          triggerError();
        },
      }
    );
  };

  return (
    <AuthLayout
      title="Здравствуйте"
      subtitle="Войдите, чтобы продолжить работу"
      celebrate={loginSuccess}
      error={hasError}
    >
      <AnimatedInput
        ref={emailRef}
        label="Электронная почта"
        placeholder="name@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setErrors((e) => ({ ...e, email: undefined }));
        }}
        error={errors.email}
      />

      <AnimatedInput
        ref={passwordRef}
        label="Пароль"
        placeholder="Не меньше 8 символов"
        secure
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setErrors((e) => ({ ...e, password: undefined }));
        }}
        error={errors.password}
      />

      <View style={authFooterStyles.row}>
        <AnimatedCheckbox checked={remember} onChange={setRemember} label="Запомнить меня" />
        <Text style={authFooterStyles.resetLink}>Забыли пароль?</Text>
      </View>

      <AnimatedButton
        title="Войти"
        onPress={handleLogin}
        loading={login.isPending}
        style={styles.submit}
      />

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>или войти через</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.socialRow}>
        <View style={authFooterStyles.view}>
          <SocialButton
            label="Sber ID"
            icon={<Ionicons name="checkmark-circle" size={20} color={colors.success} />}
            // OAuth пока не реализован — заглушка.
            onPress={() => {}}
          />
        </View>
        <View style={authFooterStyles.view}>
          <SocialButton
            label="Яндекс"
            icon={
              <View style={styles.yandexIcon}>
                <Text style={styles.yandexLetter}>Я</Text>
              </View>
            }
            onPress={() => {}}
          />
        </View>
      </View>

      <View style={authFooterStyles.footer}>
        <Text style={styles.footerText}>
          Ещё нет аккаунта?{' '}
          <Text style={authFooterStyles.link} onPress={() => navigation.navigate('Register')}>
            Создать
          </Text>
        </Text>
        <Text style={authFooterStyles.terms}>
          Продолжая, вы принимаете условия использования{'\n'}и политику обработки данных
        </Text>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  submit: { marginTop: spacing.lg },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: spacing.lg,
  },
  divider: { flex: 1, height: 1, backgroundColor: colors.borderSoft },
  dividerText: { ...typography.micro, marginHorizontal: spacing.sm + 2, color: colors.subtext },
  socialRow: { flexDirection: 'row', gap: spacing.md, width: '100%' },
  yandexIcon: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yandexLetter: { ...typography.micro, color: colors.card },
  footerText: { ...typography.caption, color: colors.text, textAlign: 'center' },
});
