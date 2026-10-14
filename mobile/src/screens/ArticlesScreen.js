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
import { colors } from '../theme/colors';

export default function ArticlesScreen({ navigation }) {
  const { data: articles, isLoading } = useQuery({
    queryKey: ['lexbear-articles'],
    queryFn: lexbearApi.articles,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const all = articles ?? [];
  const learned = all.filter((a) => a.learned);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Мои статьи</Text>
          <Text style={styles.subtitle}>Выучено: {learned.length} / {all.length}</Text>
        </View>
      </View>

      <View style={styles.list}>
        {all.map((a) => (
          <View key={a.id} style={[styles.card, !a.learned && { opacity: 0.55 }]}>
            <View style={styles.row}>
              <View style={[styles.number, { backgroundColor: a.learned ? colors.accent : '#A19A83' }]}>
                <Text style={styles.numberText}>{a.number}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.articleTitle}>{a.title}</Text>
                <Text style={styles.articleMeta}>
                  {a.codex} · {a.learned ? 'открыто' : '🔒 закрыто'}
                </Text>
              </View>
            </View>
            {a.learned && (
              <View style={styles.articleBody}>
                <Text style={styles.plain}>«{a.plain}»</Text>
                <Text style={styles.full}>{a.full}</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 18, fontWeight: '900', color: colors.text },
  title: { fontSize: 26, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 14, color: colors.subtext, marginTop: 2 },
  list: { marginTop: 16, gap: 10 },
  card: { backgroundColor: colors.card, borderWidth: 3, borderColor: colors.border, borderRadius: 18, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  number: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  articleTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  articleMeta: { fontSize: 12, color: colors.subtext, marginTop: 2 },
  articleBody: { marginTop: 10, gap: 6 },
  plain: { fontStyle: 'italic', fontSize: 14, color: colors.subtext },
  full: { fontSize: 14, color: colors.text, lineHeight: 20 },
});