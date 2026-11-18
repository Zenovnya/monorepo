import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { gamificationApi } from '../api/gamification';
import { useAuthStore } from '../store';
import { colors } from '../theme/colors';

/**
 * Верхняя панель статистики: стрик, XP, гемы, жизни.
 *
 * Жизни берём из `/gamification/me`, а не из auth-store: стор заполняется
 * один раз при гидратации сессии и после первого же неправильного ответа
 * показывал устаревшее «5». Тот же ключ запроса используют урок, магазин и
 * экран «жизни закончились», поэтому любая инвалидация обновляет и шапку.
 */
export function TopStats() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const { data } = useQuery({
    queryKey: ['gamification-me'],
    queryFn: gamificationApi.me,
    // Пока запас не полный, раз в минуту подтягиваем восстановленную жизнь.
    refetchInterval: (query) => {
      const lives = query.state.data?.lives;
      const max = query.state.data?.max_lives ?? 5;
      return typeof lives === 'number' && lives < max ? 60 * 1000 : false;
    },
  });

  const lives = data?.lives ?? user?.lives ?? 5;
  const streak = data?.streak ?? user?.streak ?? 0;
  const xp = data?.xp ?? user?.xp ?? 0;
  const gems = data?.gems ?? user?.gems ?? 0;

  // Держим стор в согласии с сервером — на него опираются другие экраны.
  useEffect(() => {
    if (typeof data?.lives !== 'number') return;
    if (user?.lives === data.lives) return;
    setUser({ lives: data.lives });
  }, [data?.lives, user?.lives, setUser]);

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
