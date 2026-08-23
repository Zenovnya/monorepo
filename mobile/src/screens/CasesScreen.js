import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { lexbearApi } from '../api/lexbear';
import { TopStats } from '../components/TopStats';
import { colors } from '../theme/colors';

const diffMap = {
  easy: { label: 'Лёгкий', color: '#43A35D' },
  medium: { label: 'Средний', color: '#C9A227' },
  hard: { label: 'Сложный', color: '#E85D4C' },
};

const filters = ['Все', 'УК', 'КоАП', 'ГК', 'ТК', 'Конституция'];

export default function CasesScreen({ navigation }) {
  const { data: cases, isLoading, error } = useQuery({
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
      </View>
    );
  }

  const all = cases ?? [];
  const featured = all.find((c) => c.featured) ?? all[0];
  const rest = all.filter((c) => c.id !== featured?.id);

  const openCase = (c) =>
    navigation.navigate('CaseDetail', { caseData: c });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TopStats />

      <View style={styles.header}>
        <Text style={styles.title}>Кейсы</Text>
        <Text style={styles.subtitle}>Живые ситуации. Разберись как юрист.</Text>
      </View>

      {/* Кейс дня */}
      {featured && (
        <View style={styles.featuredCard}>
          <Text style={styles.featuredLabel}>Кейс дня</Text>
          <Text style={styles.featuredTitle}>{featured.title}</Text>
          <Text style={styles.featuredText}>{featured.case_text}</Text>
          <View style={styles.featuredTags}>
            <View style={[styles.tag, { backgroundColor: diffMap[featured.difficulty]?.color ?? colors.accent }]}>
              <Text style={styles.tagText}>{diffMap[featured.difficulty]?.label ?? featured.difficulty}</Text>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        {filters.map((f, i) => (
          <View key={f} style={[styles.filterChip, i === 0 && styles.filterActive]}>
            <Text style={[styles.filterText, i === 0 && { color: '#fff' }]}>{f}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Список */}
      <View style={styles.list}>
        {rest.map((c) => (
          <Pressable key={c.id} style={styles.caseCard} onPress={() => openCase(c)}>
            <View style={[styles.caseIcon, { backgroundColor: diffMap[c.difficulty]?.color ?? colors.accent }]}>
              <Text style={styles.caseIconText}>{(c.codex || '').slice(0, 2)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.caseTitle}>{c.title}</Text>
              <Text style={styles.caseMeta}>
                {diffMap[c.difficulty]?.label ?? c.difficulty} · {c.codex}
              </Text>
            </View>
            <Text style={styles.caseArrow}>→</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 15, fontWeight: '700', color: colors.error },
  header: { paddingHorizontal: 16, marginTop: 16 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 14, color: colors.subtext, marginTop: 4 },
  featuredCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFF7DE',
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  featuredLabel: { fontSize: 12, fontWeight: '900', color: colors.accent, textTransform: 'uppercase' },
  featuredTitle: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 4 },
  featuredText: { fontSize: 14, color: colors.subtext, marginTop: 8, lineHeight: 20 },
  featuredTags: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tag: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, borderWidth: 2, borderColor: colors.border },
  tagWhite: { backgroundColor: colors.card },
  tagText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  featuredBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  filters: { flexGrow: 0, paddingHorizontal: 16, marginTop: 20 },
  filterChip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  filterActive: { backgroundColor: colors.border },
  filterText: { fontWeight: '700', color: colors.text },
  list: { paddingHorizontal: 16, marginTop: 16, gap: 12 },
  caseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
  },
  caseIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  caseIconText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  caseTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  caseMeta: { fontSize: 12, color: colors.subtext, marginTop: 4 },
  caseArrow: { fontSize: 20, color: colors.subtext },
});