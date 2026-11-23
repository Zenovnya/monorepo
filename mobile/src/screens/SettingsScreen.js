import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store';
import { notificationsApi } from '../api/notifications';
import { userApi } from '../api/user';
import { AnimatedSwitch } from '../components/AnimatedSwitch';
import { PressableScale } from '../components/PressableScale';
import {
  brand,
  KhokhlomaDivider,
  DocumentSectionHeader,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Экран «Настройки» (SettingsScreen):
 * максимально чистые современные карточки на сливочной бумаге (#F7EFDF),
 * заголовки разделов с «§», приглушённо-синий счётчик уведомлений (#7298BC)
 * и лаково-красный акцент выхода (#C9362B) — без визуального шума.
 */
/** Варианты темпа: минуты в день (как в онбординге) → XP-цель = минуты × 2. */
const PACE_OPTIONS = [5, 10, 20, 30];

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, logout, user } = useAuthStore();
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const [pacePickerOpen, setPacePickerOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  /**
   * Смена темпа. До этого строки настроек были декоративными: значение
   * «Цель XP в день» нельзя было изменить, хотя онбординг обещал обратное.
   */
  const updateGoal = useMutation({
    mutationFn: (dailyGoal) => userApi.updateMe({ daily_goal: dailyGoal }),
    onSuccess: (profile) => {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
      setUser({ daily_goal: profile.daily_goal });
      queryClient.invalidateQueries({ queryKey: ['gamification-daily-goal'] });
      setPacePickerOpen(false);
      setNotice('Темп обновлён');
    },
    onError: () => setNotice('Не удалось сохранить темп. Попробуйте ещё раз.'),
  });

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    enabled: isAuthenticated,
  });
  const notifications = data?.notifications ?? [];

  // Настройки рассылки. Раньше «Уведомления: Включены» было текстом-заглушкой:
  // отключить пуши было нельзя вообще.
  const { data: pushSettings } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: notificationsApi.getSettings,
    enabled: isAuthenticated,
  });

  const [pushNotice, setPushNotice] = useState(null);

  const updatePush = useMutation({
    mutationFn: (patch) => notificationsApi.updateSettings(patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(['notification-settings'], settings);
    },
    onError: () => setPushNotice('Не удалось сохранить настройку'),
  });

  const testPush = useMutation({
    mutationFn: () => notificationsApi.sendTest(),
    onSuccess: (res) => {
      if (res.reason) {
        setPushNotice('Нет активных устройств: разрешите уведомления в системе.');
        return;
      }
      setPushNotice(
        res.sent > 0
          ? `Тестовое уведомление отправлено (${res.sent})`
          : 'Expo не принял уведомление. Попробуйте позже.'
      );
    },
    onError: () => setPushNotice('Не удалось отправить тестовое уведомление'),
  });

  const rows = [
    {
      icon: '👤',
      title: 'Имя',
      value: user?.name || 'Юрист',
      onPress: () => navigation.navigate('Profile'),
    },
    {
      icon: '✦',
      title: 'Цель XP в день',
      value: `${user?.daily_goal ?? 10} XP`,
      onPress: () => setPacePickerOpen((v) => !v),
    },
    {
      icon: '⚖️',
      title: 'О приложении',
      value: 'v0.1 · LexBear',
    },
  ];

  const handleLogout = async () => {
    await logout();
  };

  /**
   * Переход к удалению — через подтверждение.
   *
   * На вебе у Alert из react-native нет кнопок, поэтому там ведём сразу на
   * экран: он сам требует галочку и пароль, так что случайно ничего не удалится.
   */
  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      navigation.navigate('DeleteAccount');
      return;
    }
    Alert.alert(
      'Удалить аккаунт?',
      'Профиль, прогресс и история платежей удалятся навсегда. На следующем шаге нужно подтвердить паролем.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Продолжить',
          style: 'destructive',
          onPress: () => navigation.navigate('DeleteAccount'),
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <PaperGrain />

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
        <Text style={styles.title}>Настройки</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <DocumentSectionHeader title="Аккаунт" style={styles.sectionHeader} />
        <View style={styles.groupCard}>
          {rows.map((r, idx) => {
            // Строка-навигация проседает пружиной; статичная — просто View,
            // чтобы не было ложного отклика на нажатие.
            const RowWrapper = r.onPress ? PressableScale : View;
            return (
              <RowWrapper
                key={r.title}
                onPress={r.onPress}
                style={[
                  styles.row,
                  idx < rows.length - 1 && styles.rowDivider,
                ]}
              >
                <Text style={styles.rowEmoji}>{r.icon}</Text>
                <Text style={styles.rowTitle}>{r.title}</Text>
                <Text style={styles.rowValue} numberOfLines={2}>
                  {r.value}
                </Text>
                {r.onPress ? <Text style={styles.rowChevron}>›</Text> : null}
              </RowWrapper>
            );
          })}
        </View>

        {pacePickerOpen ? (
          <View style={styles.paceCard}>
            <Text style={styles.paceKicker}>§ ТЕМП ЗАНЯТИЙ</Text>
            <Text style={styles.paceHint}>
              Сколько минут в день готовы уделять праву? Цель считается как
              минуты × 2 XP.
            </Text>
            <View style={styles.paceRow}>
              {PACE_OPTIONS.map((minutes) => {
                const isCurrent = (user?.daily_goal ?? 10) === minutes * 2;
                return (
                  <PressableScale
                    key={minutes}
                    disabled={updateGoal.isPending}
                    onPress={() => updateGoal.mutate(minutes * 2)}
                    accessibilityRole="button"
                    accessibilityLabel={`${minutes} минут в день`}
                    style={[
                      styles.paceChip,
                      isCurrent && styles.paceChipActive,
                    ]}
                  >
                    {updateGoal.isPending &&
                    updateGoal.variables === minutes * 2 ? (
                      <ActivityIndicator size="small" color={brand.red} />
                    ) : (
                      <Text
                        style={[
                          styles.paceChipText,
                          isCurrent && styles.paceChipTextActive,
                        ]}
                      >
                        {minutes} мин
                      </Text>
                    )}
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ) : null}

        {notice ? (
          <Pressable onPress={() => setNotice(null)} style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

        <DocumentSectionHeader
          title="Уведомления"
          style={styles.sectionHeader}
          right={
            notifications.length > 0 ? (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {Math.min(notifications.length, 5)}
                </Text>
              </View>
            ) : null
          }
        />

        {pushSettings ? (
          <View style={styles.groupCard}>
            {[
              {
                key: 'streak_reminders',
                label: 'Стрик под угрозой',
                hint: 'Напомним, если серия может прерваться',
              },
              {
                key: 'daily_goal_reminders',
                label: 'Цель дня',
                hint: 'Напоминание, если норма ещё не закрыта',
              },
              {
                key: 'review_reminders',
                label: 'Повторения',
                hint: 'Когда кейсы пора освежить',
              },
            ].map((item, idx, arr) => {
              const value = Boolean(pushSettings[item.key]);
              return (
                <PressableScale
                  key={item.key}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: value }}
                  accessibilityLabel={item.label}
                  disabled={updatePush.isPending}
                  // Нажатие по всей строке — тоже переключение: на телефоне
                  // попасть в тумблер 46×27 сложнее, чем в строку целиком.
                  onPress={() =>
                    updatePush.mutate({ [item.key]: !value })
                  }
                  style={[
                    styles.row,
                    styles.pushRow,
                    idx < arr.length - 1 && styles.rowDivider,
                  ]}
                >
                  <View style={styles.pushBody}>
                    <Text style={styles.rowTitle}>{item.label}</Text>
                    <Text style={styles.pushHint}>{item.hint}</Text>
                  </View>
                  <AnimatedSwitch
                    value={value}
                    disabled={updatePush.isPending}
                    onValueChange={(next) =>
                      updatePush.mutate({ [item.key]: next })
                    }
                  />
                </PressableScale>
              );
            })}
          </View>
        ) : null}

        {pushSettings ? (
          <PressableScale
            onPress={() => testPush.mutate()}
            disabled={testPush.isPending}
            accessibilityRole="button"
            style={[
              styles.testPushBtn,
            ]}
          >
            {testPush.isPending ? (
              <ActivityIndicator size="small" color={brand.pine} />
            ) : (
              <Text style={styles.testPushText}>
                Отправить тестовое уведомление
              </Text>
            )}
          </PressableScale>
        ) : null}

        {pushNotice ? (
          <Pressable
            onPress={() => setPushNotice(null)}
            style={styles.notice}
          >
            <Text style={styles.noticeText}>{pushNotice}</Text>
          </Pressable>
        ) : null}

        {notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Пока нет новых уведомлений</Text>
          </View>
        ) : (
          <View style={styles.groupCard}>
            {notifications.slice(0, 5).map((n, idx, arr) => (
              <View
                key={n.id}
                style={[
                  styles.notifRow,
                  idx < arr.length - 1 && styles.rowDivider,
                  n.read && styles.notifRead,
                ]}
              >
                <View
                  style={[
                    styles.notifBadge,
                    {
                      backgroundColor: n.read
                        ? brand.pineSoft
                        : brand.infoSoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.notifBadgeIcon,
                      { color: n.read ? brand.pine : brand.infoInk },
                    ]}
                  >
                    {n.read ? '✓' : 'ℹ️'}
                  </Text>
                </View>
                <View style={styles.notifBodyWrap}>
                  <Text style={styles.notifTitle}>{n.title}</Text>
                  {n.body ? (
                    <Text style={styles.notifBody}>{n.body}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {isAuthenticated && (
          <>
            <KhokhlomaDivider style={styles.footerDivider} />
            <PressableScale
              style={[
                styles.logoutBtn,
              ]}
              onPress={handleLogout}
            >
              <Text style={styles.logoutText}>Выйти из аккаунта</Text>
            </PressableScale>

            {/* Удаление аккаунта: требование App Store 5.1.1(v) и Google Play —
                возможность удалить аккаунт должна быть в самом приложении.
                Стоит отдельно и ниже выхода, чтобы не нажималось случайно. */}
            <PressableScale
              style={[
                styles.deleteRow,
              ]}
              onPress={confirmDelete}
              accessibilityRole="button"
              accessibilityLabel="Удалить аккаунт"
            >
              <Text style={styles.deleteRowText}>Удалить аккаунт</Text>
            </PressableScale>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pushRow: {
    alignItems: 'center',
  },
  pushBody: { flex: 1, paddingRight: 10 },
  pushHint: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.subtext,
    fontWeight: '500',
  },
  switch: {
    width: 46,
    height: 27,
    borderRadius: 14,
    padding: 3,
    backgroundColor: colors.track,
    justifyContent: 'center',
  },
  switchOn: {
    backgroundColor: brand.pine,
  },
  switchKnob: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: colors.card,
  },
  switchKnobOn: {
    alignSelf: 'flex-end',
  },
  testPushBtn: {
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: brand.pineBorder,
    backgroundColor: brand.pineSoft,
    alignItems: 'center',
  },
  testPushText: {
    color: brand.pineDark,
    fontWeight: '800',
    fontSize: 12.5,
  },
  rowPressed: { opacity: 0.75 },
  deleteRow: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  deleteRowText: {
    fontSize: 13,
    fontWeight: '800',
    color: brand.muted,
    textDecorationLine: 'underline',
  },
  rowChevron: {
    marginLeft: 8,
    fontSize: 18,
    color: colors.locked,
    fontWeight: '700',
  },
  paceCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: brand.rule,
    backgroundColor: colors.paper,
  },
  paceKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: colors.subtext,
    marginBottom: 6,
  },
  paceHint: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.subtext,
    marginBottom: 12,
  },
  paceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paceChip: {
    minWidth: 74,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: brand.rule,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  paceChipActive: {
    borderColor: brand.red,
    backgroundColor: brand.redSoft,
  },
  paceChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  paceChipTextActive: {
    color: brand.red,
  },
  notice: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: brand.pineBorder,
    backgroundColor: brand.pineSoft,
  },
  noticeText: {
    color: brand.pineDark,
    fontWeight: '700',
    fontSize: 12.5,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 48,
  },

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
    backgroundColor: colors.background,
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
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },
  headerSpacer: {
    width: 36,
  },

  body: {
    paddingHorizontal: 18,
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 10,
  },

  groupCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: brand.rule,
  },
  rowEmoji: {
    fontSize: 17,
    width: 24,
    textAlign: 'center',
    color: brand.gold,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.text,
  },
  rowValue: {
    maxWidth: '48%',
    fontSize: 13,
    fontWeight: '600',
    color: colors.subtext,
    textAlign: 'right',
  },

  countBadge: {
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: brand.infoSoft,
    borderWidth: 1,
    borderColor: brand.infoBorder,
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: brand.infoInk,
  },

  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: brand.rule,
    padding: 22,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.subtext,
  },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  notifRead: {
    opacity: 0.76,
  },
  notifBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeIcon: {
    fontSize: 13,
    fontWeight: '800',
  },
  notifBodyWrap: {
    flex: 1,
    gap: 2,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  notifBody: {
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.subtext,
    lineHeight: 18,
  },

  footerDivider: {
    marginTop: 22,
    marginBottom: 14,
  },
  logoutBtn: {
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.redBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 1.5,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: brand.red,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
