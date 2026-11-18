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
  KhokhlomaMedallion,
  KhokhlomaDivider,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';
import { authApi } from '../api/auth';
import { describeLoadError } from '../api/client';

/**
 * Экран установки нового пароля по ссылке из письма.
 *
 * Токен приходит в адресе: ``lapazakona://reset-password?token=...``.
 * После успешной смены сервер отзывает все refresh-токены, поэтому здесь
 * достаточно вернуть пользователя на экран входа.
 */
export default function ResetPasswordScreen({ route, navigation }) {
  const token = route?.params?.token ?? '';

  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef(null);
  const repeatRef = useRef(null);

  const submit = async () => {
    const next = {};
    if (password.length < 8) next.password = 'Не меньше 8 символов';
    if (repeat !== password) next.repeat = 'Пароли не совпадают';
    setErrors(next);
    if (next.password) passwordRef.current?.shake();
    if (next.repeat) repeatRef.current?.shake();
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
      setDone(true);
    } catch (err) {
      // 400 — токен просрочен или уже использован. Показываем текст сервера,
      // он понятный («Срок действия ссылки истёк»).
      const detail = err?.response?.data?.detail;
      setErrors({
        password: detail || describeLoadError(err, 'новый пароль'),
      });
      passwordRef.current?.shake();
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <View style={styles.container}>
        <PaperGrain />
        <View style={styles.center}>
          <AnimatedMascot size={120} emotion="sad" />
          <Text style={styles.title}>Ссылка неполная</Text>
          <Text style={styles.subtitle}>
            В адресе нет токена сброса. Откройте ссылку из письма целиком или
            запросите новую.
          </Text>
          <PressableScale
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.linkHit}
          >
            <Text style={styles.footerLink}>Запросить новую ссылку</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

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
        <Animated.View entering={FadeIn.duration(220)}>
          <KhokhlomaMedallion size={132} style={styles.medallion}>
            <AnimatedMascot
              size={112}
              emotion={done ? 'happy' : 'neutral'}
              wave={!done}
            />
          </KhokhlomaMedallion>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(260)}>
          <Text style={styles.title}>
            {done ? 'Пароль обновлён' : 'Новый пароль'}
          </Text>
          <Text style={styles.subtitle}>
            {done
              ? 'Готово. Войдите с новым паролем — остальные сессии уже завершены.'
              : 'Придумайте пароль не короче 8 символов.'}
          </Text>

          <KhokhlomaDivider style={styles.divider} />

          {done ? (
            <AnimatedButton
              title="Войти"
              onPress={() => navigation.navigate('Login')}
            />
          ) : (
            <>
              <AnimatedInput
                ref={passwordRef}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setErrors((e) => ({ ...e, password: undefined }));
                }}
                error={errors.password}
                label="Новый пароль"
                placeholder="••••••••"
                secure
                autoCapitalize="none"
                textContentType="newPassword"
              />

              <View style={styles.spacer} />

              <AnimatedInput
                ref={repeatRef}
                value={repeat}
                onChangeText={(t) => {
                  setRepeat(t);
                  setErrors((e) => ({ ...e, repeat: undefined }));
                }}
                error={errors.repeat}
                label="Повторите пароль"
                placeholder="••••••••"
                secure
                autoCapitalize="none"
                textContentType="newPassword"
              />

              <AnimatedButton
                title="Сохранить пароль"
                onPress={submit}
                loading={loading}
                style={styles.submitBtn}
              />
            </>
          )}
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
    paddingTop: 64,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    gap: 12,
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
  spacer: { height: 12 },
  submitBtn: { marginTop: 20 },
  footerLink: {
    color: colors.link,
    fontWeight: '700',
    fontSize: 13.5,
    marginTop: 8,
  },
});
