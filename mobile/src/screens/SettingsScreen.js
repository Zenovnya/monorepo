import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store';
import { notificationsApi } from '../api/notifications';
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
export default function SettingsScreen({ navigation }) {
  const { isAuthenticated, logout, user } = useAuthStore();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    enabled: isAuthenticated,
  });
  const notifications = data?.notifications ?? [];

  const rows = [
    { icon: '👤', title: 'Имя', value: user?.name || 'Юрист' },
    { icon: '✦', title: 'Цель XP в день', value: `${user?.daily_goal ?? 10} XP` },
    { icon: '🔔', title: 'Уведомления', value: 'Включены' },
    { icon: '📜', title: 'Аккаунт', value: 'Демо-режим' },
    { icon: '🇷🇺', title: 'Язык', value: 'Русский' },
    { icon: '⚖️', title: 'О приложении', value: 'v0.1 · LexBear' },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PaperGrain />

      {/* Шапка */}
      <View style={styles.header}>
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
        <Text style={styles.title}>Настройки</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <DocumentSectionHeader title="Аккаунт" style={styles.sectionHeader} />
        <View style={styles.groupCard}>
          {rows.map((r, idx) => (
            <View
              key={r.title}
              style={[styles.row, idx < rows.length - 1 && styles.rowDivider]}
            >
              <Text style={styles.rowEmoji}>{r.icon}</Text>
              <Text style={styles.rowTitle}>{r.title}</Text>
              <Text style={styles.rowValue} numberOfLines={2}>
                {r.value}
              </Text>
            </View>
          ))}
        </View>

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
            <Pressable
              style={({ pressed }) => [
                styles.logoutBtn,
                pressed && styles.logoutBtnPressed,
              ]}
              onPress={handleLogout}
            >
              <Text style={styles.logoutText}>Выйти из аккаунта</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
