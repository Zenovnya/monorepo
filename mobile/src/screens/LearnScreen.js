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
import { AnimatedMascot } from '../components/AnimatedMascot';
import { colors } from '../theme/colors';

export default function LearnScreen({ navigation }) {
  const { data: units, isLoading, error } = useQuery({
    queryKey: ['lexbear-learn'],
    queryFn: lexbearApi.learnPath,
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
        <Text style={styles.errorText}>Не удалось загрузить обучение</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TopStats />

      {/* Цель дня (декоративно) */}
      <View style={styles.dailyCard}>
        <Text style={styles.dailyIcon}>🎯</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.dailyLabel}>Цель дня</Text>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>
      </View>

      {/* Юниты */}
      {units?.map((unit, uIdx) => {
        const isLocked = unit.locked;
        return (
          <View key={unit.id} style={styles.unitBlock}>
            <View style={[styles.unitBanner, { backgroundColor: unit.color }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.unitMeta}>
                  Юнит {uIdx + 1} · {unit.codex}
                </Text>
                <Text style={styles.unitTitle}>{unit.title}</Text>
                <Text style={styles.unitSubtitle}>{unit.subtitle}</Text>
              </View>
              <Text style={styles.unitEmoji}>{isLocked ? '🔒' : '📖'}</Text>
            </View>

            <View style={styles.lessonList}>
              {unit.lessons?.map((lesson) => {
                const state = isLocked || !lesson.completed
                  ? lesson.completed ? 'done' : (isLocked ? 'locked' : 'current')
                  : 'done';
                const locked = state === 'locked';
                return (
                  <Pressable
                    key={lesson.id}
                    disabled={locked}
                    onPress={() =>
                      navigation.navigate('Lesson', { lessonId: lesson.id, title: lesson.title })
                    }
                    style={[styles.lessonNode, locked && styles.lessonNodeLocked]}
                  >
                    <View style={[styles.nodeIcon, lesson.completed ? styles.nodeDone : (locked ? styles.nodeLocked : styles.nodeCurrent)]}>
                      <Text style={styles.nodeEmoji}>
                        {lesson.completed ? '👑' : locked ? '🔒' : '▶'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lessonTitle, locked && { color: colors.locked }]}>
                        {lesson.title}
                      </Text>
                      {lesson.completed && (
                        <Text style={styles.lessonXp}>+{lesson.xp_reward} XP</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      <View style={styles.footerNote}>
        <AnimatedMascot size={80} />
        <Text style={styles.footerText}>🐻 Больше юнитов появится по мере прохождения</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 15, fontWeight: '700', color: colors.error },
  dailyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 16,
  },
  dailyIcon: { fontSize: 26 },
  dailyLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  progressTrack: { height: 16, backgroundColor: colors.track, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: colors.border },
  progressFill: { width: '30%', height: '100%', backgroundColor: colors.success },
  unitBlock: { marginTop: 24, paddingHorizontal: 16 },
  unitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.border,
    padding: 16,
  },
  unitMeta: { fontSize: 12, fontWeight: '700', opacity: 0.9, color: '#fff' },
  unitTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 2 },
  unitSubtitle: { fontSize: 14, opacity: 0.9, color: '#fff', marginTop: 2 },
  unitEmoji: { fontSize: 28 },
  lessonList: { marginTop: 16, gap: 12 },
  lessonNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
  },
  lessonNodeLocked: { opacity: 0.6 },
  nodeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.border,
  },
  nodeDone: { backgroundColor: colors.accent },
  nodeCurrent: { backgroundColor: colors.success, shadowColor: colors.successDark, shadowOpacity: 1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 0 },
  nodeLocked: { backgroundColor: colors.locked },
  nodeEmoji: { fontSize: 20 },
  lessonTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  lessonXp: { fontSize: 12, color: colors.subtext, marginTop: 4 },
  footerNote: { alignItems: 'center', marginTop: 32, gap: 8 },
  footerText: { fontSize: 13, color: colors.subtext, textAlign: 'center', paddingHorizontal: 20 },
});