import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { lexbearApi } from '../api/lexbear';
import { gamificationApi } from '../api/gamification';
import { progressApi } from '../api/progress';
import { colors } from '../theme/colors';

/**
 * Экран профиля LexBear.
 */
export default function ProfileScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);

  // Статьи со статусом изучения.
  const { data: articles } = useQuery({
    queryKey: ['lexbear-articles'],
    queryFn: lexbearApi.articles,
  });

  // Состояние геймификации (XP, уровень, стрик, достижения).
  const { data: gamification } = useQuery({
    queryKey: ['gamification-me'],
    queryFn: gamificationApi.me,
  });

  // Сводка прогресса по урокам (короны).
  const { data: progress } = useQuery({
    queryKey: ['progress-overview'],
    queryFn: progressApi.overview,
  });

  // Достижения пользователя.
  const { data: achData } = useQuery({
    queryKey: ['gamification-achievements'],
    queryFn: gamificationApi.achievements,
  });
  const achievements = achData?.achievements ?? [];

  const learnedCount = (articles ?? []).filter((a) => a.learned).length;
  const totalCrowns = progress?.total_crowns ?? 0;
  const level = gamification?.level ?? user?.level ?? 1;

  // Ловим повышение уровня: сравниваем текущий level с предыдущим значением.
  // При изменении вверх — включаем маскота в состоянии level_up на 2.5 сек
  // (короткий «выброс» реакции, потом возврат в обычный idle).
  const prevLevelRef = useRef(level);
  const [levelUpPulse, setLevelUpPulse] = useState(false);
  useEffect(() => {
    if (prevLevelRef.current != null && level > prevLevelRef.current) {
      setLevelUpPulse(true);
      const t = setTimeout(() => setLevelUpPulse(false), 2500);
      return () => clearTimeout(t);
    }
    prevLevelRef.current = level;
  }, [level]);

  const metrics = [
    { icon: '🔥', value: gamification?.streak ?? user?.streak ?? 0, label: 'Стрик' },
    { icon: '⭐', value: gamification?.xp ?? user?.xp ?? 0, label: 'XP' },
    { icon: '👑', value: totalCrowns, label: 'Короны' },
    { icon: '📖', value: learnedCount, label: 'Статьи' },
  ];

  const rows = [
    { key: 'bear', icon: '🐻', title: 'Оформление мишки', hint: 'Костюмы, галстуки, комнаты' },
    { key: 'league', icon: '🏆', title: 'Лига', hint: 'Топ 30 недели' },
    { key: 'articles', icon: '📚', title: 'Мои статьи', hint: `${learnedCount} выучено` },
    { key: 'shop', icon: '🛍️', title: 'Магазин', hint: 'Гемы, жизни, костюмы' },
    { key: 'premium', icon: '💎', title: 'LexBear Plus', hint: 'Без лимита жизней', gold: true },
  ];

  const navigate = (key) => {
    const map = { bear: 'Bear', league: 'League', articles: 'Articles', shop: 'Shop', premium: 'Premium' };
    navigation.navigate(map[key]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Шапка */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          {/* На повышении уровня — короткий залп level_up, иначе радостный idle. */}
          <AnimatedMascot size={88} levelUp={levelUpPulse} mood={levelUpPulse ? undefined : 'happy'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.name || 'Юрист'}</Text>
          <Text style={styles.meta}>
            Лига: <Text style={{ fontWeight: '800' }}>{user?.league || 'Бронза'}</Text> · Уровень {level}
          </Text>
          <Pressable
            style={styles.settingsChip}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsChipText}>⚙️ Настройки</Text>
          </Pressable>
        </View>
      </View>

      {/* Метрики */}
      <View style={styles.metricsRow}>
        {metrics.map((m) => (
          <View key={m.label} style={styles.metric}>
            <Text style={styles.metricIcon}>{m.icon}</Text>
            <Text style={styles.metricValue}>{m.value}</Text>
            <Text style={styles.metricLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* Достижения */}
      {achievements.length > 0 && (
        <View style={styles.achSection}>
          <Text style={styles.sectionTitle}>Достижения</Text>
          <View style={styles.achList}>
            {achievements.map((a) => (
              <View key={a.code} style={styles.achCard}>
                <Text style={styles.achTitle}>🏅 {a.title}</Text>
                {a.description ? (
                  <Text style={styles.achDesc}>{a.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Ссылки */}
      <View style={styles.rows}>
        {rows.map((r) => (
          <Pressable
            key={r.key}
            style={[styles.row, r.gold && styles.rowGold]}
            onPress={() => navigate(r.key)}
          >
            <View style={[styles.rowIcon, r.gold && { backgroundColor: colors.accent }]}>
              <Text style={styles.rowIconText}>{r.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{r.title}</Text>
              <Text style={styles.rowHint}>{r.hint}</Text>
            </View>
            <Text style={styles.rowArrow}>→</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: '#FFF7DE',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 26, fontWeight: '900', color: colors.text },
  meta: { fontSize: 14, color: colors.subtext, marginTop: 2 },
  settingsChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginTop: 8,
  },
  settingsChipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  metric: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.track,
    padding: 10,
    alignItems: 'center',
  },
  metricIcon: { fontSize: 18 },
  metricValue: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 4 },
  metricLabel: { fontSize: 10, color: colors.subtext, fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: colors.subtext, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  achList: { gap: 8 },
  achCard: { backgroundColor: colors.card, borderWidth: 3, borderColor: colors.border, borderRadius: 16, padding: 12 },
  achTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  achDesc: { fontSize: 13, color: colors.subtext, marginTop: 4, lineHeight: 18 },
  rows: { marginTop: 24, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 12,
  },
  rowGold: { backgroundColor: '#FFF7DE' },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconText: { fontSize: 22 },
  rowTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  rowHint: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  rowArrow: { fontSize: 20, color: colors.subtext },
});