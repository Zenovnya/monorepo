import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { contentApi } from '../api/content';
import { progressApi } from '../api/progress';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { colors } from '../theme/colors';

export default function BranchScreen({ route, navigation }) {
  const { branch } = route.params;
  const {
    data: lessons,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['lessons', branch.id],
    queryFn: () => contentApi.listLessons(branch.id),
  });

  const {
    data: progress,
    isLoading: progressLoading,
  } = useQuery({
    queryKey: ['progress-overview'],
    queryFn: () => progressApi.overview(),
  });

  // Карта прогресса по идентификатору урока: lesson_id -> { completed, best_score }.
  const progressMap = React.useMemo(() => {
    const map = {};
    (progress?.items ?? []).forEach((item) => {
      map[item.lesson_id] = item;
    });
    return map;
  }, [progress]);

  const renderLesson = ({ item }) => {
    const p = progressMap[item.id];
    const completed = !!p?.completed;
    const score = p?.best_score ?? null;
    return (
      <Pressable
        onPress={() => navigation.navigate('Lesson', { lesson: item, branch })}
        style={({ pressed }) => [
          styles.lessonCard,
          completed && styles.lessonCardDone,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.node, completed && styles.nodeDone]}>
          <Text style={styles.nodeIcon}>{completed ? '✓' : '▶'}</Text>
        </View>
        <View style={styles.lessonBody}>
          <Text style={styles.lessonTitle}>{item.title}</Text>
          <Text style={styles.lessonStatus}>
            {completed ? `Пройден · ${score}%` : 'Не пройден'}
          </Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.branchTitle}>{branch.title}</Text>
          {branch.description ? (
            <Text style={styles.branchDesc}>{branch.description}</Text>
          ) : null}
        </View>
      </View>

      {isLoading || progressLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Не удалось загрузить уроки</Text>
        </View>
      ) : (
        <FlatList
          data={lessons}
          keyExtractor={(l) => String(l.id)}
          renderItem={renderLesson}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.mascotRow}>
              <AnimatedMascot />
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>В этой ветке пока нет уроков</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backText: { fontSize: 18, fontWeight: '800', color: colors.text },
  headerBody: { flex: 1 },
  branchTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  branchDesc: { fontSize: 13, color: colors.subtext, marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  mascotRow: { alignItems: 'center', marginVertical: 12 },
  lessonCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lessonCardDone: { borderColor: '#43A35D' },
  pressed: { opacity: 0.85, transform: [{ translateY: 2 }] },
  node: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#43A35D',
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nodeDone: { backgroundColor: '#2E7D46' },
  nodeIcon: { fontSize: 18, color: '#fff', fontWeight: '800' },
  lessonBody: { flex: 1 },
  lessonTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  lessonStatus: { fontSize: 12, color: colors.subtext, marginTop: 4 },
  arrow: { fontSize: 20, color: colors.subtext },
  errorText: { fontSize: 15, fontWeight: '700', color: colors.error, textAlign: 'center' },
  emptyText: { textAlign: 'center', color: colors.subtext, marginTop: 24 },
});