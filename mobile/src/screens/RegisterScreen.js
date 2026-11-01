import React, { useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import AuthLayout, { authFooterStyles } from '../components/AuthLayout';
import { AnimatedButton } from '../components/AnimatedButton';
import { AnimatedInput } from '../components/AnimatedInput';
import { colors, spacing, typography } from '../theme/tokens';
import { useRegister } from '../hooks/useAuth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const navigation = useNavigation();
  const register = useRegister();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [hasError, setHasError] = useState(false);

  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const triggerError = () => {
    setHasError(true);
    setTimeout(() => setHasError(false), 500);
  };

  const validate = () => {
    const nextErrors = {};
    if (username.trim().length < 2) nextErrors.username = 'Введите имя';
    if (!EMAIL_REGEX.test(email)) nextErrors.email = 'Введите корректный email';
    if (password.length < 8) nextErrors.password = 'Не меньше 8 символов';
    if (confirm !== password) nextErrors.confirm = 'Пароли не совпадают';

    setErrors(nextErrors);
    if (nextErrors.username) usernameRef.current?.shake();
    if (nextErrors.email) emailRef.current?.shake();
    if (nextErrors.password) passwordRef.current?.shake();
    if (nextErrors.confirm) confirmRef.current?.shake();

    return Object.keys(nextErrors).length === 0;
  };

  const handleRegister = () => {
    if (!validate()) {
      triggerError();
      return;
    }
    register.mutate(
      { email, password, username },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setSuccess(true);
        },
        onError: () => {
          setErrors({ email: 'Такой пользователь уже существует' });
          emailRef.current?.shake();
          triggerError();
        },
      }
    );
  };

  return (
    <AuthLayout
      title="Создать аккаунт"
      subtitle="Заполните данные для регистрации"
      celebrate={success}
      error={hasError}
    >
      <AnimatedInput
        ref={usernameRef}
        label="Имя"
        placeholder="Иван Иванов"
        value={username}
        onChangeText={(t) => {
          setUsername(t);
          setErrors((e) => ({ ...e, username: undefined }));
        }}
        error={errors.username}
      />

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

      <AnimatedInput
        ref={confirmRef}
        label="Повторите пароль"
        placeholder="Повторите пароль"
        secure
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t);
          setErrors((e) => ({ ...e, confirm: undefined }));
        }}
        error={errors.confirm}
      />

      <AnimatedButton
        title="Зарегистрироваться"
        onPress={handleRegister}
        loading={register.isPending}
        style={styles.submit}
      />

      <Text style={styles.footerText}>
        Уже есть аккаунт?{' '}
        <Text style={authFooterStyles.link} onPress={() => navigation.goBack()}>
          Войти
        </Text>
      </Text>
      <Text style={authFooterStyles.terms}>
        Продолжая, вы принимаете условия использования{'\n'}и политику обработки данных
      </Text>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  submit: { marginTop: spacing.md },
  footerText: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
