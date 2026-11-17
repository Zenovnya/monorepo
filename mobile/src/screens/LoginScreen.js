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
import {
  brand,
  KhokhlomaMedallion,
  KhokhlomaDivider,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
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
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <PaperGrain />
      <Confetti active={loginSuccess} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={ZoomIn.duration(600).springify().damping(8)}
          style={styles.mascotWrap}
        >
          <KhokhlomaMedallion size={138}>
            <AnimatedMascot
              size={116}
              wave={!loginSuccess && !hasError}
              celebrate={loginSuccess}
              error={hasError}
            />
          </KhokhlomaMedallion>
        </Animated.View>

        <Text style={styles.brandWordmark}>§ LEXBEAR</Text>

        <Animated.Text
          entering={SlideInUp.delay(200).springify().damping(9).mass(0.6)}
          style={styles.title}
        >
          Здравствуйте!
        </Animated.Text>
        <Animated.Text
          entering={SlideInUp.delay(280).springify().damping(9).mass(0.6)}
          style={styles.subtitle}
        >
          Войдите, чтобы продолжить обучение
        </Animated.Text>

        <Animated.View
          entering={SlideInUp.delay(350).springify().damping(11).mass(0.8)}
          style={styles.formBlock}
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
            <AnimatedCheckbox
              checked={remember}
              onChange={setRemember}
              label="Запомнить меня"
            />
            <Text style={styles.link}>Забыли?</Text>
          </View>

          <AnimatedButton
            title="Войти"
            onPress={handleLogin}
            loading={login.isPending}
            style={styles.submitBtn}
          />
        </Animated.View>

        <Animated.View
          entering={SlideInUp.delay(500).springify().damping(11)}
          style={styles.dividerWrap}
        >
          <KhokhlomaDivider label="или" />
        </Animated.View>

        <View style={styles.socialRow}>
          <Animated.View
            entering={ZoomIn.delay(600).springify().damping(8)}
            style={styles.socialItem}
          >
            <SocialButton
              label="Sber ID"
              icon={
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={brand.pine}
                />
              }
              onPress={() => {}}
            />
          </Animated.View>
          <Animated.View
            entering={ZoomIn.delay(680).springify().damping(8)}
            style={styles.socialItem}
          >
            <SocialButton
              label="Яндекс"
              icon={
                <View style={styles.yandexIcon}>
                  <Text style={styles.yandexLetter}>Я</Text>
                </View>
              }
              onPress={() => {}}
            />
          </Animated.View>
        </View>

        <Animated.View
          entering={SlideInUp.delay(780).springify().damping(11)}
          style={styles.footerBlock}
        >
          <View style={styles.switchCard}>
            <Text style={styles.footerText}>
              Ещё нет аккаунта?{' '}
              <Text
                style={styles.linkBold}
                onPress={() => navigation.navigate('Register')}
              >
                Создать
              </Text>
            </Text>
          </View>
          <Text style={styles.terms}>
            Продолжая, вы принимаете условия использования{'\n'}и политику
            обработки данных
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
    alignItems: 'center',
  },
  mascotWrap: {
    marginBottom: 10,
  },
  brandWordmark: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: brand.red,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.subtext,
    marginTop: 3,
    marginBottom: 16,
  },

  formBlock: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 14,
  },
  link: {
    fontSize: 12.5,
    fontWeight: '700',
    color: brand.infoInk,
  },
  submitBtn: {
    marginTop: 2,
  },

  dividerWrap: {
    width: '100%',
    marginVertical: 15,
  },

  socialRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  socialItem: {
    flex: 1,
  },
  yandexIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: brand.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yandexLetter: {
    color: brand.creamText,
    fontSize: 12,
    fontWeight: '900',
  },

  footerBlock: {
    width: '100%',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  switchCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: brand.rule,
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.subtext,
  },
  linkBold: {
    color: brand.red,
    fontWeight: '800',
  },
  terms: {
    fontSize: 11,
    fontWeight: '500',
    color: brand.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
