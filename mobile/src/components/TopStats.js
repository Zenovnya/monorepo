import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { gamificationApi } from '../api/gamification';
import { useAuthStore } from '../store';
import { colors } from '../theme/tokens';

/**
 * Верхняя панель статистики в духе Duolingo.
 *
 * Четыре крупные чипы-пилюли: стрик, XP, гемы, жизни. Как в Duolingo —
 * каждая цифра стоит на своей иконке, чип круглый, цвет слегка
 * приглушён, а жизни (❤️) выделены красным — это главный ресурс,
 * который тратится и восстанавливается.
 *
 * Жизни берутся из /gamification/me, а не из auth-store: стор заполняется
 * один раз при гидратации и после первого неправильного ответа показывал
 * устаревшее значение. Тот же ключ запроса используют урок, магазин и
 * экран «жизни закончились», поэтому любая инвалидация обновляет и шапку.
 *
 * Обновление живыми: при жизни < max automatically refetch раз в минуту,
 * чтобы счётчик восстанавливался, пока приложение открыто.
 */
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
    { icon: '⭐', value: `${xp}`, suffix: ' XP', tint: colors.successTint, fg: colors.successDark },
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
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 8,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  chipIcon: { fontSize: 18 },
  chipTextWrap: { flexDirection: 'row', alignItems: 'baseline' },
  chipText: { fontSize: 16, fontWeight: '900' },
  chipSuffix: { fontSize: 10, fontWeight: '800' },
});

export default TopStats;
