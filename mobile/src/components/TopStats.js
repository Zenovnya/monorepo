/**
 * Шапка статистики (гемы, опыт, жизни, стрик) в стиле Duolingo.
 *
 * Вариант «челки» с рамками выглядел как дешевый макет: маленькие
 * обведённые в кружок значки. Теперь — большие жирные значки на
 * мягких пастельных пилюлях без рамок, с едва заметной тенью вместо
 * обводки. Акцент — на числах, как в Duolingo: эмоционально и
 * уверенно, без лишних линий.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store';
import { gamificationApi } from '../api/gamification';
import { colors } from '../theme/colors';

export function TopStats() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const { data } = useQuery({
    queryKey: ['gamification-me'],
    queryFn: gamificationApi.me,
    // staleTime: 0 — после прохождения урока счётчики уже оптимистично
    // обновлены в кэше; при возвращении на вкладку нужно читать свежий
    // ответ, а не кэш прошлого посещения.
    staleTime: 0,
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
    { icon: '🔥', value: streak, tint: colors.streakTint, fg: '#9A5B00' },
    {
      icon: '⭐',
      value: `${xp}`,
      suffix: ' XP',
      tint: colors.successTint,
      fg: colors.successDark,
    },
    { icon: '💎', value: gems, tint: colors.skyTint, fg: '#3A6E99' },
    { icon: '❤️', value: lives, tint: colors.errorTint, fg: '#B3261E' },
  ];

  return (
    <View style={styles.row}>
      {stats.map((stat, index) => (
        <View key={index} style={[styles.chip, { backgroundColor: stat.tint }]}>
          <Text style={styles.chipIcon}>{stat.icon}</Text>
          <View style={styles.chipTextWrap}>
            <Text style={[styles.chipText, { color: stat.fg }]}>{stat.value}</Text>
            {stat.suffix ? (
              <Text style={[styles.chipSuffix, { color: stat.fg }]}>
                {stat.suffix}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  // Пилюля без рамок: мягкий фон + лёгкая тень вместо обводки.
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
    // Тень вместо рамки — глубина, а не линия.
    elevation: 4,
    shadowColor: 'rgba(60, 40, 20, 0.18)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  chipIcon: { fontSize: 23 },
  chipTextWrap: { flexDirection: 'row', alignItems: 'baseline' },
  chipText: { fontSize: 19, fontWeight: '900' },
  chipSuffix: { fontSize: 11, fontWeight: '800' },
});

export default TopStats;
