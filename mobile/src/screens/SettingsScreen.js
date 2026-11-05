import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store';
import { notificationsApi } from '../api/notifications';
import { colors, radius, sizes, spacing, typography } from '../theme/tokens';

export default function SettingsScreen({ navigation }) {
  const { isAuthenticated, logout, user } = useAuthStore();

  // Список уведомлений пользователя.
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    enabled: isAuthenticated,
  });
  const notifications = data?.notifications ?? [];

  const rows = [
    { title: 'Имя', value: user?.name || 'Юрист' },
    { title: 'Цель XP в день', value: String(user?.daily_goal ?? 10) },
    { title: 'Уведомления', value: 'Включены (мишка ждёт вечером)' },
    { title: 'Аккаунт', value: 'Демо-режим' },
    { title: 'Язык', value: 'Русский' },
    { title: 'О приложении', value: 'v0.1 · LexBear' },
  ];

  const handleLogout = async () => {
    await logout();
    // RootNavigator автоматически переключится на AuthStack,
    // когда isAuthenticated станет false — ручная навигация не нужна.
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Настройки</Text>
      </View>

      <View style={styles.list}>
        {rows.map((r) => (
          <View key={r.title} style={styles.row}>
            <Text style={styles.rowTitle}>{r.title}</Text>
            <Text style={styles.rowValue}>{r.value}</Text>
          </View>
        ))}
      </View>

      {/* Уведомления */}
      <Text style={styles.sectionTitle}>Уведомления</Text>
      {notifications.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Пока нет уведомлений</Text>
        </View>
      ) : (
        <View style={styles.notifList}>
          {notifications.slice(0, 5).map((n) => (
            <View
              key={n.id}
              style={[styles.notifCard, n.read && styles.notifRead]}
            >
              <Text style={styles.notifTitle}>{n.title}</Text>
              {n.body ? <Text style={styles.notifBody}>{n.body}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {isAuthenticated && (
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Выйти</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.base, paddingBottom: spacing.xxl },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: {
    width: sizes.minTouchTarget,
    height: sizes.minTouchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { ...typography.heading, color: colors.text },
  title: { ...typography.title, color: colors.text },

  list: { marginTop: spacing.base, gap: spacing.sm + 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowValue: {
    ...typography.caption,
    color: colors.subtext,
    maxWidth: '60%',
    textAlign: 'right',
  },

  sectionTitle: {
    ...typography.micro,
    color: colors.subtext,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyCard: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.base,
    alignItems: 'center',
  },
  emptyText: { ...typography.caption, color: colors.subtext },
  notifList: { gap: spacing.sm },
  notifCard: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  notifRead: { opacity: 0.6 },
  notifTitle: { ...typography.bodyStrong, color: colors.text },
  notifBody: { ...typography.caption, color: colors.subtext, marginTop: spacing.xs },

  logoutBtn: {
    marginTop: spacing.xl,
    height: sizes.button,
    borderRadius: radius.md,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { ...typography.heading, color: colors.card },
});

