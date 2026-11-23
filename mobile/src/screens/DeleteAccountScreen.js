import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '../store';
import { userApi } from '../api/user';
import { AnimatedInput } from '../components/AnimatedInput';
import { PressableScale } from '../components/PressableScale';
import { AnimatedCheckbox } from '../components/AnimatedCheckbox';
import {
  brand,
  KhokhlomaCorners,
  KhokhlomaDivider,
  WaxSeal,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { FadeInView } from '../components/motion/FadeInView';
import { colors } from '../theme/colors';

/**
 * Удаление аккаунта.
 *
 * App Store (5.1.1(v)) и Google Play требуют, чтобы приложение с регистрацией
 * позволяло удалить аккаунт прямо в нём. До этого экрана единственным
 * «управлением аккаунтом» был выход из системы: почта, прогресс и история
 * платежей оставались на сервере навсегда, а пользователь не мог их убрать.
 *
 * Дизайн намеренно неудобный для случайного нажатия: сначала нужно прочитать,
 * что именно удалится, потом отметить галочку и ввести пароль. Красная кнопка
 * появляется активной только после этого.
 */

/** Что именно исчезнет — конкретика важнее общего «все данные». */
const REMOVED = [
  { icon: '👤', text: 'Профиль, имя и e-mail' },
  { icon: '📈', text: 'XP, уровень, серия дней и гемы' },
  { icon: '📚', text: 'Пройденные уроки и прогресс по кейсам' },
  { icon: '🔁', text: 'Расписание повторений и история ответов' },
  { icon: '💳', text: 'Подписка и история платежей' },
  { icon: '🔔', text: 'Токены устройств и настройки уведомлений' },
];

export default function DeleteAccountScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();

  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = React.useRef(null);

  const deleteAccount = useMutation({
    mutationFn: () => userApi.deleteMe(password),
    onSuccess: async (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      // Кэш чистим до выхода: иначе экраны успеют показать данные удалённого
      // пользователя из памяти при следующем входе под другим аккаунтом.
      queryClient.clear();
      // Шлюз мог не подтвердить отмену автоплатежа. Alert не годится: на вебе
      // он молчит, а аккаунта к этому моменту уже нет. Кладём предупреждение
      // в стор — экран входа покажет его после выхода.
      if (data?.had_subscription && data?.autopayment_stopped === false) {
        useAuthStore.getState().setNotice({
          title: 'Автоплатёж не отменён',
          text: 'Спишитесь с поддержкой, чтобы остановить списания: аккаунт удалён, но подписка у платёжного шлюза могла остаться активной.',
        });
      }
      await logout();
    },
    onError: (err) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {}
      );
      if (err?.response?.status === 403) {
        setError('Пароль не подошёл. Проверьте раскладку и регистр.');
        inputRef.current?.shake?.();
        return;
      }
      if (!err?.response) {
        setError('Нет связи с сервером. Проверьте интернет и повторите.');
        return;
      }
      setError('Не удалось удалить аккаунт. Попробуйте ещё раз.');
    },
  });

  const canDelete = confirmed && password.length > 0 && !deleteAccount.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <PaperGrain />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Шапка */}
        <View style={styles.header}>
          <PressableScale
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            style={[
              styles.backBtn,
            ]}
          >
            <Text style={styles.backText}>←</Text>
          </PressableScale>
          <Text style={styles.headerTitle}>Удаление аккаунта</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.body}>
          <FadeInView index={0}>
            <View style={styles.warningCard}>
              <KhokhlomaCorners variant="light" size="sm" inset={6} />
              <View style={styles.warningHead}>
                <WaxSeal label="!" tone="red" size={46} />
                <Text style={styles.warningTitle}>
                  Это действие необратимо
                </Text>
              </View>
              <Text style={styles.warningText}>
                Восстановить аккаунт или переписку с прогрессом не получится.
                Если хотите просто начать заново — можно выйти и
                зарегистрироваться с другой почтой.
              </Text>
              {user?.email ? (
                <Text style={styles.emailLine}>Аккаунт: {user.email}</Text>
              ) : null}
            </View>
          </FadeInView>

          <FadeInView index={1}>
            <Text style={styles.kicker}>§ ЧТО БУДЕТ УДАЛЕНО</Text>
            <View style={styles.listCard}>
              {REMOVED.map((item, idx) => (
                <View
                  key={item.text}
                  style={[
                    styles.listRow,
                    idx < REMOVED.length - 1 && styles.listDivider,
                  ]}
                >
                  <Text style={styles.listIcon}>{item.icon}</Text>
                  <Text style={styles.listText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </FadeInView>

          <FadeInView index={2}>
            <View style={styles.confirmCard}>
              <AnimatedCheckbox
                checked={confirmed}
                onChange={(next) => {
                  setConfirmed(next);
                  setError(null);
                }}
                label="Я понимаю, что данные не восстановить"
              />

              <View style={styles.inputWrap}>
                <AnimatedInput
                  ref={inputRef}
                  label="Пароль для подтверждения"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  secure
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Ваш текущий пароль"
                />
              </View>

              {error ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}

              <PressableScale
                onPress={() => deleteAccount.mutate()}
                disabled={!canDelete}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canDelete, busy: deleteAccount.isPending }}
                style={[
                  styles.deleteBtn,
                  !canDelete && styles.deleteBtnDisabled,
                ]}
              >
                {deleteAccount.isPending ? (
                  <ActivityIndicator size="small" color="#FCF8F0" />
                ) : (
                  <Text style={styles.deleteText}>
                    Удалить аккаунт навсегда
                  </Text>
                )}
              </PressableScale>

              <PressableScale
                onPress={() => navigation.goBack()}
                style={[
                  styles.cancelBtn,
                ]}
              >
                <Text style={styles.cancelText}>
                  Оставить аккаунт
                </Text>
              </PressableScale>
            </View>
          </FadeInView>

          <KhokhlomaDivider style={styles.divider} />
          <Text style={styles.footnote}>
            Данные удаляются сразу и безвозвратно. Если что-то пошло не так —
            вернитесь на этот экран и попробуйте снова.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1.5,
    borderBottomColor: brand.rule,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: brand.rule,
  },
  backBtnPressed: { opacity: 0.65 },
  backText: { fontSize: 18, color: colors.text, fontWeight: '800' },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.2,
  },
  headerSpacer: { width: 36 },

  body: { paddingHorizontal: 18, paddingTop: 16 },

  warningCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: brand.redBorder,
    backgroundColor: brand.redSoft,
    overflow: 'hidden',
  },
  warningHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  warningTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    color: brand.red,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    fontWeight: '600',
  },
  emailLine: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '800',
    color: brand.red,
  },

  kicker: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: colors.subtext,
  },
  listCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: brand.rule,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  listDivider: {
    borderBottomWidth: 1,
    borderBottomColor: brand.rule,
  },
  listIcon: { fontSize: 16 },
  listText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.text,
  },

  confirmCard: {
    marginTop: 22,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: brand.rule,
    backgroundColor: colors.card,
  },
  inputWrap: { marginTop: 14 },
  errorText: {
    marginTop: 10,
    fontSize: 12.5,
    fontWeight: '700',
    color: brand.red,
  },

  deleteBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.red,
    borderWidth: 2,
    borderColor: '#99241B',
  },
  deleteBtnDisabled: {
    backgroundColor: colors.track,
    borderColor: brand.rule,
  },
  deleteBtnPressed: { opacity: 0.9, transform: [{ translateY: 1 }] },
  deleteText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FCF8F0',
  },

  cancelBtn: {
    marginTop: 10,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPressed: { opacity: 0.6 },
  cancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.subtext,
  },

  divider: { marginTop: 24 },
  footnote: {
    marginTop: 12,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.subtext,
    textAlign: 'center',
    fontWeight: '600',
  },
});
