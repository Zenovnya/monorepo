import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { gamificationApi } from '../api/gamification';
import { colors, radius, sizes, spacing, typography } from '../theme/tokens';

/** Порядок лиг по возрастанию — держим в синхроне с backend `LEAGUES`. */
const LEAGUES = ['Бронза', 'Серебро', 'Золото', 'Мантия', 'Фемида'];

/** Цвет медали для первых трёх мест. */
const MEDAL_COLORS = [colors.gold, colors.silver, colors.bronze];

export default function LeagueScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);

  // Реальная таблица лидеров: раньше экран рисовал выдуманный список.
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['gamification-leaderboard'],
    queryFn: () => gamificationApi.leaderboard(),
  });

  const league = data?.league ?? user?.league ?? LEAGUES[0];
  const nextLeague = data?.next_league ?? LEAGUES[0];
  const entries = data?.entries ?? [];

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Назад"
        hitSlop={8}
      >
        <Text style={styles.backText}>←</Text>
      </Pressable>
      <Text style={styles.title}>Лига</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorText}>Не удалось загрузить таблицу лидеров</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {header}

      <View style={styles.hero}>
        <AnimatedMascot size={64} emotion="cheer" />
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>{league}</Text>
          <Text style={styles.heroSubtitle}>
            {nextLeague === league ? 'Это высшая лига' : `Топ 5 идут в ${nextLeague}`}
          </Text>
        </View>
      </View>

      <View style={styles.leagueChips}>
        {LEAGUES.map((item) => {
          const active = item === league;
          return (
            <View key={item} style={[styles.leagueChip, active && styles.leagueChipActive]}>
              <Text style={[styles.leagueChipText, active && styles.leagueChipTextActive]}>
                {item}
              </Text>
            </View>
          );
        })}
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            В этой лиге пока никого нет. Наберите XP, чтобы попасть в таблицу.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {entries.map((entry) => (
            <View key={entry.position} style={[styles.row, entry.is_me && styles.rowMe]}>
              <View
                style={[
                  styles.rank,
                  entry.position <= 3 && {
                    backgroundColor: MEDAL_COLORS[entry.position - 1],
                  },
                ]}
              >
                <Text style={[styles.rankText, entry.position <= 3 && styles.rankTextTop]}>
                  {entry.position}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowName, entry.is_me && styles.rowNameMe]} numberOfLines={1}>
                  {entry.name}
                </Text>
                <Text style={styles.rowLevel}>Уровень {entry.level}</Text>
              </View>
              <Text style={styles.rowXp}>{entry.xp} XP</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.base, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },

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

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.goldTint,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.base,
  },
  heroText: { flex: 1 },
  heroTitle: { ...typography.heading, color: colors.text },
  heroSubtitle: { ...typography.caption, color: colors.subtext, marginTop: spacing.xs },

  leagueChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.base,
  },
  leagueChip: {
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  leagueChipActive: { backgroundColor: colors.accent },
  leagueChipText: { ...typography.caption, color: colors.text },
  leagueChipTextActive: { color: colors.card },

  list: { marginTop: spacing.base, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rowMe: { backgroundColor: colors.successTint, borderColor: colors.success },
  rank: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { ...typography.bodyStrong, color: colors.text },
  rankTextTop: { color: colors.card },
  rowBody: { flex: 1 },
  rowName: { ...typography.bodyStrong, color: colors.text },
  rowNameMe: { fontWeight: '900' },
  rowLevel: { ...typography.caption, color: colors.subtext },
  rowXp: { ...typography.bodyStrong, color: colors.subtext },

  emptyCard: {
    marginTop: spacing.base,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.base,
    alignItems: 'center',
  },
  emptyText: { ...typography.caption, color: colors.subtext, textAlign: 'center' },

  errorText: { ...typography.bodyStrong, color: colors.error, textAlign: 'center' },
  retryBtn: {
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.base,
  },
  retryText: { ...typography.bodyStrong, color: colors.text },
});

