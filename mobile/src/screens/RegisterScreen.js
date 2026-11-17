import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { SlideInUp, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
import { AnimatedInput } from '../components/AnimatedInput';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { Confetti } from '../components/Confetti';
import { brand, PaperGrain } from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';
import { useRegister } from '../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';

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
        onError: () => {
          setErrors({ email: 'Такой пользователь уже существует' });
          emailRef.current?.shake();
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
      <Confetti active={success} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <View style={styles.topTrack}>
            <View style={styles.topFill} />
          </View>
        </View>

        <Animated.View
          entering={ZoomIn.duration(500).springify().damping(8)}
          style={styles.heroRow}
        >
          <View style={styles.mascotCircle}>
            <AnimatedMascot
              size={78}
              wave={!success && !hasError}
              celebrate={success}
              error={hasError}
            />
          </View>
          <View style={styles.bubbleWrap}>
            <View style={styles.bubbleTail} />
            <View style={styles.bubble}>
              <Text style={styles.title}>Создать профиль</Text>
              <Text style={styles.subtitle}>
                Сохраним ваш стрик, короны и XP
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={SlideInUp.delay(300).springify().damping(11).mass(0.8)}
          style={styles.formBlock}
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
            style={styles.submitBtn}
          />
        </Animated.View>

        <Animated.View
          entering={SlideInUp.delay(550).springify().damping(11)}
          style={styles.footerBlock}
        >
          <View style={styles.switchCard}>
            <Text style={styles.footerText}>
              Уже есть аккаунт?{' '}
              <Text style={styles.linkBold} onPress={() => navigation.goBack()}>
                Войти
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
    paddingTop: 12,
    paddingBottom: 34,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: brand.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    transform: [{ translateY: 1.5 }],
  },
  backText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  topTrack: {
    flex: 1,
    height: 11,
    borderRadius: 999,
    backgroundColor: brand.rule,
    overflow: 'hidden',
  },
  topFill: {
    width: '66%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: brand.gold,
  },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mascotCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: brand.goldSoft,
    borderWidth: 1.8,
    borderColor: brand.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleWrap: {
    flex: 1,
    position: 'relative',
  },
  bubbleTail: {
    position: 'absolute',
    left: -6,
    top: 22,
    width: 11,
    height: 11,
    backgroundColor: colors.card,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: brand.rule,
    transform: [{ rotate: '45deg' }],
    zIndex: 2,
  },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.rule,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 3,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.subtext,
  },

  formBlock: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    padding: 16,
  },
  submitBtn: {
    marginTop: 4,
  },

  footerBlock: {
    alignItems: 'center',
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
