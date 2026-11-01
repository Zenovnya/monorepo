import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { lexbearApi } from '../api/lexbear';
import { TopStats } from '../components/TopStats';
import { colors, radius, spacing, typography } from '../theme/tokens';

/** Цвет и подпись сложности. */
const diffMap = {
  easy: { label: 'Лёгкий', color: colors.success },
  medium: { label: 'Средний', color: colors.accent },
  hard: { label: 'Сложный', color: colors.error },
};

const filters = ['Все', 'УК', 'КоАП', 'ГК', 'ТК', 'Конституция'];

export default function CasesScreen({ navigation }) {
  const { data: cases, isLoading, error, refetch } = useQuery({
    queryKey: ['lexbear-cases'],
    queryFn: lexbearApi.cases,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Не удалось загрузить кейсы</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  const all = cases ?? [];
  const featured = all.find((c) => c.featured) ?? all[0];
  const rest = all.filter((c) => c.id !== featured?.id);

  // Передаём только id кейса — детали подтягиваются на экране CaseDetail.
  const openCase = (c) => navigation.navigate('CaseDetail', { caseId: c.id });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TopStats />

      <View style={styles.header}>
        <Text style={styles.title}>Кейсы</Text>
        <Text style={styles.subtitle}>Живые ситуации. Разберись как юрист.</Text>
      </View>

      {featured && (
        <View style={styles.featuredCard}>
          <Text style={styles.featuredLabel}>Кейс дня</Text>
          <Text style={styles.featuredTitle}>{featured.title}</Text>
          <Text style={styles.featuredText}>{featured.case_text}</Text>
          <View style={styles.featuredTags}>
            <View
              style={[
                styles.tag,
                { backgroundColor: diffMap[featured.difficulty]?.color ?? colors.accent },
              ]}
            >
              <Text style={[styles.tagText, styles.tagTextInverse]}>
                {diffMap[featured.difficulty]?.label ?? featured.difficulty}
              </Text>
            </View>
            <View style={[styles.tag, styles.tagWhite]}>
              <Text style={styles.tagText}>{featured.codex}</Text>
            </View>
          </View>
          <Pressable style={styles.featuredBtn} onPress={() => openCase(featured)}>
            <Text style={styles.featuredBtnText}>Разобрать →</Text>
          </Pressable>
        </View>
      )}

      {/* Фильтры (декоративные) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filters}
        contentContainerStyle={styles.filtersContent}
      >
        {filters.map((f, i) => (
          <View key={f} style={[styles.filterChip, i === 0 && styles.filterActive]}>
            <Text style={[styles.filterText, i === 0 && styles.filterTextActive]}>{f}</Text>
          </View>
        ))}
      </ScrollView>

      {rest.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Пока доступен только кейс дня.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {rest.map((c) => (
            <Pressable
              key={c.id}
              style={styles.caseCard}
              onPress={() => openCase(c)}
              accessibilityRole="button"
              accessibilityLabel={`Открыть кейс ${c.title}`}
            >
              <View
                style={[
                  styles.caseIcon,
                  { backgroundColor: diffMap[c.difficulty]?.color ?? colors.accent },
                ]}
              >
                <Text style={styles.caseIconText}>{(c.codex || '').slice(0, 2)}</Text>
              </View>
              <View style={styles.caseText}>
                <Text style={styles.caseTitle}>{c.title}</Text>
                <Text style={styles.caseMeta}>
                  {diffMap[c.difficulty]?.label ?? c.difficulty} · {c.codex}
                </Text>
              </View>
              <Text style={styles.caseArrow}>→</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: spacing.xxl * 3 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  errorText: { ...typography.bodyStrong, color: colors.error },
  retryBtn: {
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.base,
  },
  retryText: { ...typography.bodyStrong, color: colors.text },

  header: { paddingHorizontal: spacing.base, marginTop: spacing.base },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.caption, color: colors.subtext, marginTop: spacing.xs },

  featuredCard: {
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    backgroundColor: colors.goldTint,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.base,
    overflow: 'hidden',
  },
  featuredLabel: {
    ...typography.micro,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  featuredTitle: { ...typography.heading, color: colors.text, marginTop: spacing.xs },
  featuredText: { ...typography.caption, color: colors.subtext, marginTop: spacing.sm },
  featuredTags: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tag: {
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  tagWhite: { backgroundColor: colors.surfaceRaised },
  tagText: { ...typography.caption, color: colors.text },
  tagTextInverse: { color: colors.card },
  featuredBtn: {
    marginTop: spacing.base,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBtnText: { ...typography.bodyStrong, color: colors.card },

  filters: { flexGrow: 0, marginTop: spacing.lg },
  filtersContent: { paddingHorizontal: spacing.base, gap: spacing.sm },
  filterChip: {
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  filterActive: { backgroundColor: colors.border },
  filterText: { ...typography.caption, color: colors.text },
  filterTextActive: { color: colors.card },

  list: { paddingHorizontal: spacing.base, marginTop: spacing.base, gap: spacing.md },
  caseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  caseIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  caseIconText: { ...typography.bodyStrong, color: colors.card },
  caseText: { flex: 1 },
  caseTitle: { ...typography.bodyStrong, color: colors.text },
  caseMeta: { ...typography.micro, color: colors.subtext, marginTop: spacing.xs },
  caseArrow: { ...typography.heading, color: colors.subtext },

  emptyCard: {
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.base,
    alignItems: 'center',
  },
  emptyText: { ...typography.caption, color: colors.subtext },
});

