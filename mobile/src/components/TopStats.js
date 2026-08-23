import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../store';
import { colors } from '../theme/colors';

/**
 * Верхняя панель статистики: стрик, XP, гемы, жизни.
 */
export function TopStats() {
  const user = useAuthStore((s) => s.user);
  const streak = user?.streak ?? 0;
  const xp = user?.xp ?? 0;
  const gems = user?.gems ?? 0;
  const lives = user?.lives ?? 5;

  return (
    <View style={styles.row}>
      <View style={[styles.chip, { backgroundColor: '#FFF4D1' }]}>
        <Text style={styles.chipText}>🔥 {streak}</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: '#E8F6EE' }]}>
        <Text style={styles.chipText}>⭐ {xp} XP</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: '#DFF1FB' }]}>
        <Text style={styles.chipText}>💎 {gems}</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: '#FDE3DF' }]}>
        <Text style={styles.chipText}>❤️ {lives}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  chipText: { fontSize: 13, fontWeight: '800', color: colors.text },
});