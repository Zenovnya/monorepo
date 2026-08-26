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

/**
 * Экран «Учёба» LexBear: карта обучения (юниты + уроки + прогресс).
 */
export default function LearnScreen({ navigation }) {
  const { data, isLoading, error } = useQuery({
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
        <Text style={styles.errorText}>Не удалось загрузить программу</Text>
      </View>
    );
  }

  const units = data?.units ?? data ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TopStats />

      <View style={styles.header}>
        <Text style={styles.title}>Учёба</Text>
        <Text style={styles.subtitle}>Короткие уроки · живые кейсы · мишка-юрист</Text>
      </View>

      {units.map((unit) => (
        <UnitBlock key={unit.id || unit.title} unit={unit} navigation={navigation} />
      ))}
    </ScrollView>
  );
}

function UnitBlock({ unit, navigation }) {
  // Урок считается заблокированным, если он не пройден и идёт после первого
  // непройденного в юните (последовательное открытие).
  let seenIncomplete = false;
  const lessons = unit.lessons ?? [];

  return (
    <View style={styles.unit}>
      <View style={styles.unitHeader}>
        <View style={styles.unitIndex}>
          <Text style={styles.unitIndexText}>{unit.title?.charAt(0) || '•'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.unitTitle}>{unit.title}</Text>
          {unit.description ? (
            <Text style={styles.unitDesc}>{unit.description}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.lessonList}>
        {lessons.map((lesson) => {
          // Если урок пройден — дальше открывается следующий.
          const isLocked = !lesson.completed && seenIncomplete;
          if (!lesson.completed) seenIncomplete = true;

          return (
            <Pressable
              key={lesson.id}
              disabled={isLocked}
              onPress={() =>
                navigation.navigate('Lesson', { lessonId: lesson.id, title: lesson.title })
              }
              style={[styles.lessonNode, isLocked && styles.lessonNodeLocked]}
            >
              <View
                style={[
                  styles.nodeIcon,
                  lesson.completed
                    ? styles.nodeDone
                    : isLocked
                    ? styles.nodeLocked
                    : styles.nodeCurrent,
                ]}
              >
                <Text style={styles.nodeEmoji}>
                  {lesson.completed ? '👑' : isLocked ? '🔒' : '▶'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.lessonTitle, isLocked && { color: colors.locked }]}>
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
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 15, fontWeight: '700', color: colors.error },
  header: { paddingHorizontal: 16, marginTop: 16 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 14, color: colors.subtext, marginTop: 4 },
  unit: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
  },
  unitHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unitIndex: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitIndexText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  unitTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  unitDesc: { fontSize: 13, color: colors.subtext, marginTop: 2 },
  lessonList: { marginTop: 12, gap: 8 },
  lessonNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: colors.track,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.paper,
  },
  lessonNodeLocked: { opacity: 0.55 },
  nodeIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: { backgroundColor: '#DFF5E5' },
  nodeLocked: { backgroundColor: '#EFEBE0' },
  nodeCurrent: { backgroundColor: colors.accent },
  nodeEmoji: { fontSize: 16 },
  lessonTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  lessonXp: { fontSize: 12, color: colors.success, fontWeight: '800', marginTop: 2 },
});