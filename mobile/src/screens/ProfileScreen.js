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
import { colors, radius, spacing, typography } from '../theme/tokens';

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
    // Раньше `return` выходил из эффекта до записи в ref, поэтому базовый
    // уровень не обновлялся и пульс повторялся на каждом ре-рендере.
    const previous = prevLevelRef.current;
    prevLevelRef.current = level;
    if (previous != null && level > previous) {
      setLevelUpPulse(true);
      const timer = setTimeout(() => setLevelUpPulse(false), 2500);
      return () => clearTimeout(timer);
    }
    return undefined;
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
        <View style={styles.headerText}>
          <Text style={styles.name}>{user?.name || 'Юрист'}</Text>
          <Text style={styles.meta}>
            Лига: <Text style={styles.metaStrong}>{user?.league || 'Бронза'}</Text> · Уровень{' '}
            {level}
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
            <View style={[styles.rowIcon, r.gold && styles.rowIconGold]}>
              <Text style={styles.rowIconText}>{r.icon}</Text>
            </View>
            <View style={styles.rowText}>
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
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.base, paddingBottom: spacing.xxl * 3 },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  headerText: { flex: 1 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.goldTint,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...typography.title, color: colors.text },
  meta: { ...typography.caption, color: colors.subtext, marginTop: 2 },
  metaStrong: { fontWeight: '800' },
  settingsChip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    marginTop: spacing.sm,
  },
  settingsChipText: { ...typography.caption, color: colors.text },

  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  metric: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    padding: spacing.sm + 2,
    alignItems: 'center',
  },
  metricIcon: { fontSize: 18 },
  metricValue: { ...typography.heading, color: colors.text, marginTop: spacing.xs },
  metricLabel: {
    ...typography.micro,
    color: colors.subtext,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  sectionTitle: {
    ...typography.micro,
    color: colors.subtext,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  achList: { gap: spacing.sm },
  achCard: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  achTitle: { ...typography.bodyStrong, color: colors.text },
  achDesc: { ...typography.caption, color: colors.subtext, marginTop: spacing.xs },

  rows: { marginTop: spacing.xl, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  rowGold: { backgroundColor: colors.goldTint },
  rowText: { flex: 1 },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconGold: { backgroundColor: colors.accent },
  rowIconText: { fontSize: 22 },
  rowTitle: { ...typography.bodyStrong, color: colors.text },
  rowHint: { ...typography.micro, color: colors.subtext, marginTop: 2 },
  rowArrow: { ...typography.heading, color: colors.subtext },
});

