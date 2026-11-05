import React, { useMemo } from 'react';
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
import { learningApi } from '../api/learning';
import { TopStats } from '../components/TopStats';
import { colors, radius, spacing, typography, sizes } from '../theme/tokens';

/**
 * Экран «Учёба».
 *
 * Порядок блоков повторяет то, как пользователь принимает решение:
 * 1. «Продолжить» — следующий незакрытый урок (или ближайший кейс, если
 *    уроков не осталось). Один тап — сразу в дело.
 * 2. «Рекомендуем сейчас» — кейс адаптивного банка, выбранный сервером по
 *    слабым компетенциям (GET /learning/next).
 * 3. Разделы — юниты целиком, без обрезки списка уроков.
 * 4. «Пройдено» — свёрнутый список закрытых уроков: они не занимают первый
 *    экран, но остаются доступными для повтора.
 */
export default function LearnScreen({ navigation }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['lexbear-learn'],
    queryFn: lexbearApi.learnPath,
  });

  // Рекомендация не должна ронять экран: если банк пуст или сервис недоступен,
  // блок просто не показывается.
  const recommendation = useQuery({
    queryKey: ['learning-next-preview'],
    queryFn: () => learningApi.next(),
    retry: false,
    staleTime: 60_000,
  });

  const units = useMemo(() => data?.units ?? data ?? [], [data]);

  const { nextLesson, completedLessons, totalLessons } = useMemo(() => {
    const all = units.flatMap((unit) => unit.lessons ?? []);
    const done = all.filter((lesson) => lesson.completed);
    // Первый непройденный по порядку программы — это и есть «продолжить».
    const next = all.find((lesson) => !lesson.completed) ?? null;
    return { nextLesson: next, completedLessons: done, totalLessons: all.length };
  }, [units]);

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
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  const lessonDone = totalLessons > 0 ? completedLessons.length / totalLessons : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TopStats />

      <View style={styles.header}>
        <Text style={styles.title}>Учёба</Text>
        <Text style={styles.subtitle}>
          {totalLessons > 0
            ? `Пройдено ${completedLessons.length} из ${totalLessons} уроков`
            : 'Короткие уроки · живые кейсы · мишка-юрист'}
        </Text>
        {totalLessons > 0 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(lessonDone * 100)}%` }]} />
          </View>
        ) : null}
      </View>

      <ContinueCard
        lesson={nextLesson}
        onPress={() =>
          nextLesson
            ? navigation.navigate('Lesson', {
                lessonId: nextLesson.id,
                title: nextLesson.title,
              })
            : navigation.navigate('AdaptiveLearning')
        }
      />

      <RecommendationCard
        item={recommendation.data}
        isLoading={recommendation.isLoading}
        onPress={() => navigation.navigate('AdaptiveLearning')}
      />

      <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Assessment')}>
        <Text style={styles.secondaryTitle}>Пройти начальную диагностику</Text>
        <Text style={styles.secondaryText}>Система точнее подберёт первые кейсы</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Разделы</Text>
      {units.map((unit) => (
        <UnitBlock key={unit.id || unit.title} unit={unit} navigation={navigation} />
      ))}

      {completedLessons.length > 0 ? (
        <View style={styles.doneBlock}>
          <Text style={styles.doneTitle}>Пройдено · {completedLessons.length}</Text>
          {completedLessons.map((lesson) => (
            <Pressable
              key={lesson.id}
              style={styles.doneRow}
              onPress={() =>
                navigation.navigate('Lesson', {
                  lessonId: lesson.id,
                  title: lesson.title,
                })
              }
            >
              <Text style={styles.doneCheck}>✓</Text>
              <Text style={styles.doneText} numberOfLines={1}>
                {lesson.title}
              </Text>
              <Text style={styles.doneXp}>+{lesson.xp_reward} XP</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}


/**
 * Карточка «Продолжить»: единственный явный следующий шаг.
 */
function ContinueCard({ lesson, onPress }) {
  // Всё пройдено — предлагаем закрепить кейсами, а не пустой экран.
  if (!lesson) {
    return (
      <Pressable style={[styles.continueCard, styles.continueCardDone]} onPress={onPress}>
        <Text style={styles.continueEyebrow}>ВСЕ УРОКИ ПРОЙДЕНЫ</Text>
        <Text style={styles.continueTitle}>Закрепим кейсами?</Text>
        <Text style={styles.continueText}>
          Адаптивная сессия подберёт ситуации под слабые темы
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.continueCard} onPress={onPress}>
      <Text style={styles.continueEyebrow}>ПРОДОЛЖИТЬ</Text>
      <Text style={styles.continueTitle} numberOfLines={2}>
        {lesson.title}
      </Text>
      <Text style={styles.continueText}>+{lesson.xp_reward} XP за урок · 5 минут</Text>
    </Pressable>
  );
}

/**
 * Карточка рекомендации из адаптивного банка.
 */
function RecommendationCard({ item, isLoading, onPress }) {
  if (isLoading) {
    return (
      <View style={[styles.recoCard, styles.recoCardIdle]}>
        <Text style={styles.recoEyebrow}>РЕКОМЕНДУЕМ СЕЙЧАС</Text>
        <Text style={styles.recoText}>Подбираем кейс под твои темы…</Text>
      </View>
    );
  }

  // Пустой банк (или сервер недоступен) — блок не нужен, не показываем пустоту.
  if (!item) return null;

  return (
    <Pressable style={styles.recoCard} onPress={onPress}>
      <Text style={styles.recoEyebrow}>РЕКОМЕНДУЕМ СЕЙЧАС</Text>
      <Text style={styles.recoSituation} numberOfLines={3}>
        {item.situation}
      </Text>
      <Text style={styles.recoCta}>Разобрать ситуацию →</Text>
    </Pressable>
  );
}

/**
 * Юнит программы: заголовок с прогрессом и полный список уроков.
 */
function UnitBlock({ unit, navigation }) {
  const lessons = unit.lessons ?? [];
  const completedCount = lessons.filter((lesson) => lesson.completed).length;
  const isFinished = lessons.length > 0 && completedCount === lessons.length;

  return (
    <View style={styles.unit}>
      <View style={styles.unitHeader}>
        <View style={styles.unitIndex}>
          <Text style={styles.unitIndexText}>{unit.title?.charAt(0) || '•'}</Text>
        </View>
        <View style={styles.unitHeaderText}>
          <Text style={styles.unitTitle} numberOfLines={2}>
            {unit.title}
          </Text>
          <Text style={styles.unitMeta}>
            {completedCount}/{lessons.length} уроков{isFinished ? ' · закрыт' : ''}
          </Text>
        </View>
      </View>

      {/* Список уроков не обрезается: высота карточки растёт по содержимому,
          а прокрутку обеспечивает внешний ScrollView. */}
      <View style={styles.lessonList}>
        {lessons.map((lesson) => (
          <Pressable
            key={lesson.id}
            onPress={() =>
              navigation.navigate('Lesson', {
                lessonId: lesson.id,
                title: lesson.title,
              })
            }
            style={styles.lessonNode}
          >
            <View style={[styles.nodeIcon, lesson.completed ? styles.nodeDone : styles.nodeCurrent]}>
              <Text style={styles.nodeEmoji}>{lesson.completed ? '✓' : '▶'}</Text>
            </View>
            <View style={styles.lessonTextBlock}>
              <Text
                style={[styles.lessonTitle, lesson.completed && styles.lessonTitleDone]}
                numberOfLines={2}
              >
                {lesson.title}
              </Text>
              <Text style={styles.lessonMeta}>
                {lesson.completed ? 'Пройдено' : `+${lesson.xp_reward} XP`}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl * 3, paddingTop: spacing.sm },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    backgroundColor: colors.background,
  },
  errorText: { ...typography.bodyStrong, color: colors.error },

  header: { paddingHorizontal: spacing.base, marginTop: spacing.base },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.caption, color: colors.subtext, marginTop: spacing.xs },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.success,
  },

  continueCard: {
    marginHorizontal: spacing.base,
    marginTop: spacing.lg,
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.accent,
  },
  continueCardDone: { backgroundColor: colors.success },
  continueEyebrow: { ...typography.micro, color: colors.text, opacity: 0.7 },
  continueTitle: { ...typography.title, color: colors.text, marginTop: spacing.xs },
  continueText: {
    ...typography.caption,
    color: colors.text,
    marginTop: spacing.xs,
    opacity: 0.85,
  },

  recoCard: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  recoCardIdle: { opacity: 0.7 },
  recoEyebrow: { ...typography.micro, color: colors.accent },
  recoSituation: { ...typography.bodyStrong, color: colors.text, marginTop: spacing.sm },
  recoText: { ...typography.caption, color: colors.subtext, marginTop: spacing.xs },
  recoCta: { ...typography.caption, color: colors.accentPressed, marginTop: spacing.md },

  secondaryBtn: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceAlt,
  },
  secondaryTitle: { ...typography.bodyStrong, color: colors.text },
  secondaryText: { ...typography.caption, color: colors.subtext, marginTop: 2 },
  retryBtn: {
    minHeight: sizes.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  retryText: { ...typography.bodyStrong, color: colors.text },

  sectionTitle: {
    ...typography.title,
    color: colors.text,
    marginHorizontal: spacing.base,
    marginTop: spacing.xl,
  },
  unit: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.base,
  },
  unitHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  unitIndex: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitIndexText: { color: colors.text, fontWeight: '900', fontSize: 18 },
  unitHeaderText: { flex: 1 },
  unitTitle: { ...typography.heading, color: colors.text },
  unitMeta: { ...typography.caption, color: colors.subtext, marginTop: 2 },
  lessonList: { marginTop: spacing.md, gap: spacing.sm },
  lessonNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  nodeIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: { backgroundColor: colors.successTint },
  nodeCurrent: { backgroundColor: colors.goldTint },
  nodeEmoji: { fontSize: 14, color: colors.text, fontWeight: '900' },
  lessonTextBlock: { flex: 1 },
  lessonTitle: { ...typography.bodyStrong, color: colors.text },
  lessonTitleDone: { color: colors.subtext },
  lessonMeta: { ...typography.caption, color: colors.success, marginTop: 2 },

  doneBlock: {
    marginHorizontal: spacing.base,
    marginTop: spacing.xl,
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceAlt,
  },
  doneTitle: { ...typography.heading, color: colors.subtext, marginBottom: spacing.sm },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  doneCheck: { color: colors.success, fontWeight: '900', fontSize: 14 },
  doneText: { ...typography.caption, color: colors.subtext, flex: 1 },
  doneXp: { ...typography.caption, color: colors.subtext },
});
