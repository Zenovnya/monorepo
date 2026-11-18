import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { adaptiveApi } from '../api/adaptive';
import { describeLoadError } from '../api/client';
import { gamificationApi } from '../api/gamification';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { PressableScale } from '../components/PressableScale';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { TopStats } from '../components/TopStats';
import {
  brand,
  serifFamily,
  KhokhlomaDivider,
  KhokhlomaGarland,
  PaperGrain,
  RibbonBookmark,
  WaxSeal,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Экран «Учёба»: темы и уроки курса «Лапы Закона».
 *
 * Числа рядом с темами — это **приоритет практики**, а не «уровень знаний» и
 * не процент правильных ответов. Пустая тема выглядит средней (50%)
 * намеренно: про неё нет наблюдений, и показывать 0% или 100% было бы
 * выдумкой. Подпись под полоской говорит об этом словами, а не только цветом.
 *
 * Карта не блокирует уроки «по порядку»: программа короткая, и запрет открыть
 * пятый урок раньше первого ничего не защищает — он только мешает.
 */
export default function LearnScreen({ navigation }) {
  const path = useQuery({ queryKey: ['adaptive-overview'], queryFn: adaptiveApi.overview });
  const dailyGoal = useQuery({ queryKey: ['gamification-daily-goal'], queryFn: gamificationApi.dailyGoal });

  const topics = useMemo(() => path.data?.topics ?? [], [path.data]);
  const totals = useMemo(() => {
    const lessons = topics.flatMap((topic) => topic.lessons ?? []);
    const done = lessons.filter((lesson) => lesson.practised).length;
    return { lessons: lessons.length, done };
  }, [topics]);

  if (path.isLoading) {
    return (
      <LoadingState
        label="Открываем программу…"
        illustration={<AnimatedMascot size={112} emotion="thinking" />}
      />
    );
  }

  // Пустой список и ошибка — разные вещи: «контента нет» нельзя показывать
  // как «всё пройдено», и наоборот.
  if (path.error) {
    return (
      <ErrorState
        title="Не удалось загрузить программу"
        message={describeLoadError(path.error, 'программу')}
        onRetry={() => path.refetch()}
        illustration={<WaxSeal label="!" tone="red" size={48} />}
      />
    );
  }

  return (
    <View style={styles.container}>
      <PaperGrain />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TopStats />

        <View style={styles.headerCard}>
          <KhokhlomaGarland variant="onRed" count={5} style={styles.headerGarland} />
          <RibbonBookmark
            color={brand.gold}
            symbol="§"
            right={16}
            height={28}
            width={22}
            cutoutColor={brand.red}
          />
          <Text style={styles.headerEyebrow}>ЛАПЫ ЗАКОНА · ПРОГРАММА</Text>
          <Text style={styles.headerTitle}>Шесть тем, тридцать уроков</Text>
          <Text style={styles.headerNote}>
            {totals.done} из {totals.lessons} уроков пройдено. Каждый урок —
            короткий разбор ситуации и одна проверка.
          </Text>
          <PressableScale
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Adaptive')}
          >
            <Text style={styles.headerBtnText}>К рекомендованному кейсу</Text>
          </PressableScale>
        </View>

        {dailyGoal.data && dailyGoal.data.goal > 0 ? (
          <View style={styles.goalCard}>
            <View style={styles.goalHead}>
              <Text style={styles.goalKicker}>§ ЦЕЛЬ ДНЯ</Text>
              <Text style={styles.goalValue}>
                {dailyGoal.data.done} / {dailyGoal.data.goal} XP
              </Text>
            </View>
            <View style={styles.goalTrack}>
              <View
                style={[
                  styles.goalFill,
                  {
                    width: `${Math.min(
                      100,
                      Math.round((dailyGoal.data.done / dailyGoal.data.goal) * 100)
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.goalHint}>
              {dailyGoal.data.completed
                ? 'Норма выполнена — отличная работа!'
                : `Осталось ${dailyGoal.data.remaining} XP.`}
            </Text>
          </View>
        ) : null}

        {topics.length === 0 ? (
          <EmptyState
            compact
            title="Программа ещё не опубликована"
            message="Разборы появятся здесь, как только их опубликуют. Адаптивная практика доступна уже сейчас."
          />
        ) : (
          topics.map((topic, index) => (
            <View key={topic.topic_id} style={styles.topicSection}>
              {index > 0 ? <KhokhlomaDivider /> : null}

              <View style={styles.topicBanner}>
                <View style={styles.topicBannerHead}>
                  <View style={styles.romanBadge}>
                    <Text style={styles.romanText}>{index + 1}</Text>
                  </View>
                  <View style={styles.topicBannerText}>
                    <Text style={styles.topicKicker}>
                      ТЕМА {index + 1} · {topic.lessons_practised}/
                      {topic.lessons_total} УРОКОВ
                    </Text>
                    <Text style={styles.topicTitle}>{topic.title}</Text>
                  </View>
                </View>
                {topic.summary ? (
                  <Text style={styles.topicSummary}>{topic.summary}</Text>
                ) : null}

                <View style={styles.topicTrack}>
                  <View
                    style={[
                      styles.topicFill,
                      {
                        width: `${Math.min(100, Math.max(4, topic.practice_priority))}%`,
                        backgroundColor: brand.gold,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.topicMeta}>
                  {topic.state === 'NOT_ASSESSED'
                    ? 'Тема ещё не проверялась — 50% это середина, а не оценка'
                    : `Приоритет практики ${topic.practice_priority}% · ответов ${topic.n}, ошибок ${topic.errors}`}
                </Text>
              </View>

              {(topic.lessons ?? []).map((lesson) => (
                <PressableScale
                  key={lesson.lesson_id}
                  style={styles.lessonRow}
                  onPress={() =>
                    navigation.navigate('Lesson', {
                      lessonId: lesson.lesson_id,
                      title: lesson.title,
                    })
                  }
                >
                  <View style={[styles.lessonPuck, lesson.practised && styles.lessonPuckDone]}>
                    <Text style={styles.lessonPuckText}>{lesson.practised ? '✓' : lesson.order}</Text>
                  </View>
                  <View style={styles.lessonText}>
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
                    <Text style={styles.lessonGoal} numberOfLines={2}>
                      {lesson.goal}
                    </Text>
                  </View>
                  <Text style={styles.lessonChevron}>›</Text>
                </PressableScale>
              ))}
            </View>
          ))
        )}

        {path.data?.editorial_note ? (
          <Text style={styles.editorialNote}>{path.data.editorial_note}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60, gap: 16 },
  headerCard: {
    position: 'relative',
    backgroundColor: brand.red,
    borderRadius: 22,
    borderBottomWidth: 5,
    borderBottomColor: brand.redDark,
    padding: 20,
    paddingRight: 34,
    gap: 10,
    overflow: 'hidden',
  },
  headerGarland: { position: 'absolute', top: 6, left: 0, right: 0, opacity: 0.5 },
  headerEyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: brand.goldLight,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: brand.creamText,
    fontFamily: serifFamily,
  },
  headerNote: { fontSize: 13, lineHeight: 19, color: brand.creamText, opacity: 0.92 },
  headerBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: brand.gold,
    borderRadius: 14,
    borderBottomWidth: 3,
    borderBottomColor: brand.goldDark,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  headerBtnText: { fontSize: 13.5, fontWeight: '900', color: brand.ink },
  goalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: brand.rule,
    padding: 16,
    gap: 8,
  },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalKicker: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: brand.goldInk,
  },
  goalValue: { fontSize: 13.5, fontWeight: '900', color: colors.text },
  goalTrack: {
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  goalFill: { height: '100%', borderRadius: 5, backgroundColor: brand.pine },
  goalHint: { fontSize: 11.5, color: colors.subtext, fontWeight: '600' },
  topicSection: { gap: 10 },
  topicBanner: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: brand.rule,
    padding: 16,
    gap: 10,
  },
  topicBannerHead: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  romanBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  romanText: { fontSize: 16, fontWeight: '900', color: brand.goldLight, fontFamily: serifFamily },
  topicBannerText: { flex: 1, gap: 2 },
  topicKicker: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: brand.muted,
  },
  topicTitle: { fontSize: 18, fontWeight: '900', color: colors.text, fontFamily: serifFamily },
  topicSummary: { fontSize: 13, lineHeight: 19, color: colors.subtext },
  topicTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  topicFill: { height: '100%', borderRadius: 4 },
  topicMeta: { fontSize: 11, lineHeight: 16, color: colors.subtext, fontWeight: '600' },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: brand.rule,
    padding: 14,
  },
  lessonPuck: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: brand.cream,
    borderWidth: 2,
    borderColor: brand.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonPuckDone: { backgroundColor: brand.pine, borderColor: brand.pineDark },
  lessonPuckText: { fontSize: 13.5, fontWeight: '900', color: colors.text },
  lessonText: { flex: 1, gap: 2 },
  lessonTitle: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  lessonGoal: { fontSize: 11.5, lineHeight: 16, color: colors.subtext },
  lessonChevron: { fontSize: 20, color: brand.muted, fontWeight: '800' },
  editorialNote: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: brand.muted,
    fontStyle: 'italic',
  },
});
