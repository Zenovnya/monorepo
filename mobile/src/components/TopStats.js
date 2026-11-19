import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { gamificationApi } from '../api/gamification';
import { useAuthStore } from '../store';
import { colors } from '../theme/tokens';

/**
 * Верхняя панель статистики: стрик, XP, гемы, жизни.
 *
 * Редизайн (техзадание §1.1): убраны тяжёлые черные обводки вокруг
 * показателей. Иконки и цифры стоят свободно на легких полупрозрачных
 * подложках без рамок. Панель — sticky сверху с тонкой разделительной
 * линией (borderBottomWidth: 1, #E6DFD3).
 *
 * Жизни берутся из /gamification/me, а не из auth-store: стор заполняется
 * один раз при гидратации и после первого неправильного ответа показывал
 * устаревшее значение. Тот же ключ запроса используют урок, магазин и
 * экран «жизни закончились», поэтому любая инвалидация обновляет и шапку.
 */
export function TopStats() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const { data } = useQuery({
    queryKey: ['gamification-me'],
    queryFn: gamificationApi.me,
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

  useEffect(() => {
    if (typeof data?.lives !== 'number') return;
    if (user?.lives === data.lives) return;
    setUser({ lives: data.lives });
  }, [data?.lives, user?.lives, setUser]);

  const stats = [
    { icon: '🔥', value: streak, tint: colors.streakTint },
    { icon: '⭐', value: `${xp} XP`, tint: colors.successTint },
    { icon: '💎', value: gems, tint: colors.skyTint },
    { icon: '❤️', value: lives, tint: colors.errorTint },
  ];

  return (
    <View style={styles.row}>
      {stats.map((stat, index) => (
        <View key={index} style={[styles.chip, { backgroundColor: stat.tint }]}>
          <Text style={styles.chipIcon}>{stat.icon}</Text>
          <Text style={styles.chipText}>{stat.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: 8,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  chipIcon: { fontSize: 14 },
  chipText: { fontSize: 13, fontWeight: '800', color: colors.text },
});

export default TopStats;
