import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { SlideInUp, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
import { AnimatedInput } from '../components/AnimatedInput';
import { SocialButton } from '../components/SocialButton';
import { AnimatedCheckbox } from '../components/AnimatedCheckbox';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { Confetti } from '../components/Confetti';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useLogin } from '../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';

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

  const validate = () => {
    const newErrors = {};
    if (!EMAIL_REGEX.test(email)) newErrors.email = 'Введите корректный email';
    if (password.length < 8) newErrors.password = 'Не меньше 8 символов';

    setErrors(newErrors);
    if (newErrors.email) emailRef.current?.shake();
    if (newErrors.password) passwordRef.current?.shake();

    return Object.keys(newErrors).length === 0;
  };

  const triggerError = () => {
    setHasError(true);
    setTimeout(() => setHasError(false), 500);
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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setLoginSuccess(true);
          // Навигация на MainTabs произойдёт автоматически через RootNavigator,
          // т.к. isAuthenticated станет true в сторе
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Confetti active={loginSuccess} />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Animated.View entering={ZoomIn.duration(600).springify().damping(8)}>
          <AnimatedMascot celebrate={loginSuccess} error={hasError} />
        </Animated.View>

        <Animated.Text
          entering={SlideInUp.delay(200).springify().damping(9).mass(0.6)}
          style={styles.title}
        >
          Здравствуйте
        </Animated.Text>
        <Animated.Text
          entering={SlideInUp.delay(280).springify().damping(9).mass(0.6)}
          style={styles.subtitle}
        >
          Войдите, чтобы продолжить работу
        </Animated.Text>

        <Animated.View
          entering={SlideInUp.delay(350).springify().damping(11).mass(0.8)}
          style={styles.card}
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

          <View style={styles.row}>
            <AnimatedCheckbox checked={remember} onChange={setRemember} label="Запомнить меня" />
            <Text style={styles.link}>Забыли пароль?</Text>
          </View>

          <AnimatedButton
            title="Войти"
            onPress={handleLogin}
            loading={login.isPending}
            style={{ marginTop: 24 }}
          />
        </Animated.View>

        <Animated.View
          entering={SlideInUp.delay(500).springify().damping(11)}
          style={styles.dividerRow}
        >
          <View style={styles.divider} />
          <Text style={styles.dividerText}>или войти через</Text>
          <View style={styles.divider} />
        </Animated.View>

        <View style={styles.socialRow}>
          <Animated.View entering={ZoomIn.delay(600).springify().damping(8)} style={{ flex: 1 }}>
            <SocialButton
              label="Sber ID"
              icon={<Ionicons name="checkmark-circle" size={20} color="#21A038" />}
              onPress={() => {
                // OAuth не реализован в этой задаче — заглушка
              }}
            />
          </Animated.View>
          <Animated.View entering={ZoomIn.delay(680).springify().damping(8)} style={{ flex: 1 }}>
            <SocialButton
              label="Яндекс"
              icon={
                <View style={styles.yandexIcon}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Я</Text>
                </View>
              }
              onPress={() => {
                // OAuth не реализован в этой задаче — заглушка
              }}
            />
          </Animated.View>
        </View>

        <Animated.View entering={SlideInUp.delay(780).springify().damping(11)}>
          <Text style={styles.footerText}>
            Ещё нет аккаунта?{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('Register')}>
              Создать
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
  title: { fontSize: 30, fontWeight: '800', color: colors.text, marginTop: 8 },
  subtitle: { fontSize: 15, color: colors.subtext, marginTop: 6, marginBottom: 20 },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  link: { color: colors.link, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: '#D9CFC2' },
  dividerText: { marginHorizontal: 10, color: colors.subtext, fontSize: 13 },
  socialRow: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 20 },
  yandexIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: { textAlign: 'center', marginTop: 4, color: colors.text },
  terms: { textAlign: 'center', marginTop: 12, color: colors.subtext, fontSize: 12 },
});