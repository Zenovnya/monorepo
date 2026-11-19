import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { adaptiveApi } from '../api/adaptive';
import { describeLoadError } from '../api/client';
import { gamificationApi } from '../api/gamification';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { LessonSnake } from '../components/LessonSnake';
import { TopicCard } from '../components/TopicCard';
import { TactilePressable } from '../components/TactilePressable';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { TopStats } from '../components/TopStats';
import {
  brand,
  serifFamily,
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
  // Ширина нужна тропе: она считает узлы от фактической ширины окна, а не от
  // магической константы, и одинаково выглядит на телефоне и на планшете.
  const { width } = useWindowDimensions();
  // Верхний отступ: табы без шапки (headerShown: false), иначе панель XP
  // уезжала под вырез.
  const insets = useSafeAreaInsets();
  // 20 — padding контента, 16 — padding карточки темы с каждой стороны.
  const snakeWidth = width - 20 * 2 - 16 * 2;

  // Раскрыта одна тема за раз: список из шести раскрытых троп — это экран,
  // который невозможно пролистать. Первую тему с непройденными уроками
  // открываем сами: чаще всего человек хочет продолжить, а не выбирать.
  const [openTopic, setOpenTopic] = useState(null);

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
      <ScreenWrapper
        scroll
        contentStyle={[styles.content, { paddingTop: 12 + insets.top }]}
      >
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
          <TactilePressable
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Adaptive')}
            haptic
            scale={0.95}
          >
            <Text style={styles.headerBtnText}>К рекомендованному кейсу</Text>
          </TactilePressable>
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
          topics.map((topic, index) => {
            // По умолчанию раскрыта первая тема, где есть что проходить.
            const fallback = topics.findIndex((t) => t.lessons_practised < t.lessons_total);
            const isOpen = openTopic === null ? index === Math.max(fallback, 0) : openTopic === index;
            return (
              <TopicCard
                key={topic.topic_id}
                topic={topic}
                index={index}
                expanded={isOpen}
                onPress={() => setOpenTopic(isOpen ? -1 : index)}
              >
                {topic.lessons?.length ? (
                  <LessonSnake
                    lessons={topic.lessons}
                    width={snakeWidth}
                    onPick={(lesson) =>
                      navigation.navigate('Lesson', {
                        lessonId: lesson.lesson_id,
                        title: lesson.title,
                      })
                    }
                  />
                ) : null}
              </TopicCard>
            );
          })
        )}

        {path.data?.editorial_note ? (
          <Text style={styles.editorialNote}>{path.data.editorial_note}</Text>
        ) : null}
      </ScreenWrapper>
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
    borderBottomWidth: 5,
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
    height: 10,
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
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  topicFill: { height: '100%', borderRadius: 4 },
  topicMeta: { fontSize: 11, lineHeight: 16, color: colors.subtext, fontWeight: '600' },
  editorialNote: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: brand.muted,
    fontStyle: 'italic',
  },
});
