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
import { colors, radius, sizes, spacing, typography } from '../theme/tokens';

export default function ArticlesScreen({ navigation }) {
  // Раньше ветки `error` не было: при падении запроса экран оставался пустым.
  const { data: articles, isLoading, error, refetch } = useQuery({
    queryKey: ['lexbear-articles'],
    queryFn: lexbearApi.articles,
  });

  const all = articles ?? [];
  const learned = all.filter((a) => a.learned);

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
      <View style={styles.headerText}>
        <Text style={styles.title}>Мои статьи</Text>
        <Text style={styles.subtitle}>
          Выучено: {learned.length} / {all.length}
        </Text>
      </View>
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
          <Text style={styles.errorText}>Не удалось загрузить статьи</Text>
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

      {all.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Статьи появятся, когда откроете первую главу кодекса.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {all.map((a) => (
            <View key={a.id} style={[styles.card, !a.learned && styles.cardLocked]}>
              <View style={styles.row}>
                <View
                  style={[styles.number, a.learned && styles.numberLearned]}
                >
                  <Text style={styles.numberText}>{a.number}</Text>
                </View>
                <View style={styles.articleText}>
                  <Text style={styles.articleTitle}>{a.title}</Text>
                  <Text style={styles.articleMeta}>
                    {a.codex} · {a.learned ? 'открыто' : '🔒 закрыто'}
                  </Text>
                </View>
              </View>
              {a.learned ? (
                <View style={styles.articleBody}>
                  <Text style={styles.plain}>«{a.plain}»</Text>
                  <Text style={styles.full}>{a.full}</Text>
                </View>
              ) : null}
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
  headerText: { flex: 1 },
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
  subtitle: { ...typography.caption, color: colors.subtext, marginTop: 2 },

  list: { marginTop: spacing.base, gap: spacing.sm + 2 },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardLocked: { opacity: 0.55 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  number: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.locked,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberLearned: { backgroundColor: colors.accent },
  numberText: { ...typography.bodyStrong, color: colors.card },
  articleText: { flex: 1 },
  articleTitle: { ...typography.bodyStrong, color: colors.text },
  articleMeta: { ...typography.micro, color: colors.subtext, marginTop: 2 },
  articleBody: { marginTop: spacing.sm + 2, gap: spacing.xs + 2 },
  plain: { ...typography.caption, fontStyle: 'italic', color: colors.subtext },
  full: { ...typography.caption, color: colors.text },

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

