import React, { useRef, useState } from 'react';
import {
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
import { AnimatedInput } from '../components/AnimatedInput';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { Confetti } from '../components/Confetti';
import { colors } from '../theme/colors';
import { useRegister } from '../hooks/useAuth';
import { describeNetworkError } from '../api/client';
import { useNavigation } from '@react-navigation/native';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Мягкое появление блока: плавное всплытие + fade без «пружинного» подскока.
 * Так экран не «выпрыгивает» целиком, а собирается по частям.
 */
const fadeUp = (delay = 0) =>
  FadeInDown.delay(delay).duration(420).easing(Easing.out(Easing.cubic));

/** Достаём текст ошибки из ответа FastAPI (``detail`` бывает строкой или массивом). */
function apiErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
}

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

  const validate = () => {
    const e = {};
    if (username.trim().length < 2) e.username = 'Введите имя';
    if (!EMAIL_REGEX.test(email)) e.email = 'Введите корректный email';
    if (password.length < 8) e.password = 'Не меньше 8 символов';
    if (confirm !== password) e.confirm = 'Пароли не совпадают';

    setErrors(e);
    if (e.username) usernameRef.current?.shake();
    if (e.email) emailRef.current?.shake();
    if (e.password) passwordRef.current?.shake();
    if (e.confirm) confirmRef.current?.shake();

    return Object.keys(e).length === 0;
  };

  const triggerError = () => {
    setHasError(true);
    setTimeout(() => setHasError(false), 500);
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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSuccess(true);
        },
        onError: (error) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          // Сетевая ошибка ≠ занятый email: иначе пользователь меняет данные зря.
          const networkError = describeNetworkError(error);
          const status = error?.response?.status;

          if (networkError) {
            setErrors({ email: networkError });
          } else if (status === 409 || status === 400) {
            setErrors({
              email: apiErrorMessage(error, 'Такой пользователь уже существует'),
            });
          } else {
            setErrors({ email: apiErrorMessage(error, 'Не удалось зарегистрироваться') });
          }

          emailRef.current?.shake();
          triggerError();
        },
      }
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Confetti active={success} />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(520).easing(Easing.out(Easing.cubic))}>
          <AnimatedMascot celebrate={success} error={hasError} />
        </Animated.View>

        <Animated.Text entering={fadeUp(120)} style={styles.title}>
          Создать аккаунт
        </Animated.Text>
        <Animated.Text entering={fadeUp(180)} style={styles.subtitle}>
          Заполните данные для регистрации
        </Animated.Text>

        <Animated.View entering={fadeUp(240)} style={styles.card}>
          <AnimatedInput
            ref={usernameRef}
            style={fadeUp(320)}
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
            style={fadeUp(380)}
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
            style={fadeUp(440)}
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
            style={fadeUp(500)}
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
            style={{ marginTop: 12 }}
          />
        </Animated.View>

        <Animated.View entering={fadeUp(620)}>
          <Text style={styles.footerText}>
            Уже есть аккаунт?{' '}
            <Text style={styles.link} onPress={() => navigation.goBack()}>
              Войти
            </Text>
          </Text>
          <Text style={styles.terms}>
            Продолжая, вы принимаете условия использования{'\n'}и политику обработки данных
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: 'center', paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginTop: 8 },
  subtitle: { fontSize: 15, color: colors.subtext, marginTop: 6, marginBottom: 20 },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 20,
  },
  link: { color: colors.link, fontWeight: '600' },
  footerText: { textAlign: 'center', marginTop: 24, color: colors.text },
  terms: { textAlign: 'center', marginTop: 12, color: colors.subtext, fontSize: 12 },
});