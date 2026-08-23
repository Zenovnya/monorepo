import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useAuthStore } from '../store';
import { colors } from '../theme/colors';

export default function SettingsScreen({ navigation }) {
  const { isAuthenticated, logout, user } = useAuthStore();

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
    navigation.navigate('Login');
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

      {isAuthenticated && (
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Выйти</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 18, fontWeight: '900', color: colors.text },
  title: { fontSize: 26, fontWeight: '900', color: colors.text },
  list: { marginTop: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: colors.card, borderWidth: 3, borderColor: colors.border, borderRadius: 16, padding: 14 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  rowValue: { fontSize: 13, color: colors.subtext, maxWidth: '60%', textAlign: 'right' },
  logoutBtn: {
    marginTop: 24,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.error,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '900', fontSize: 17 },
});