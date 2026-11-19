import React, { useMemo, useState } from 'react';
import { PressableScale } from '../components/PressableScale';
import { ErrorState, LoadingState } from '../components/StateViews';
import { describeLoadError } from '../api/client';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adaptiveApi } from '../api/adaptive';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { MascotPrompt } from '../components/MascotPrompt';
import { CaseReaction, OutcomeBadge } from '../components/CaseReaction';
import {
  brand,
  serifFamily,
  KhokhlomaCorners,
  KhokhlomaDivider,
  PaperGrain,
  RibbonBookmark,
  WaxSeal,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Вкладка «Адаптивное»: рекомендованный кейс, выбор темы и прогресс.
 *
 * Что здесь важно и не видно с первого взгляда:
 *
 * - Какой кейс показать, решает сервер. Экран не выбирает его сам: иначе
 *   «рекомендация» превратилась бы в первый кейс из списка, а приоритеты тем
 *   перестали бы на что-либо влиять.
 * - Число рядом с темой — не процент правильных ответов и не «уровень знаний»,
 *   а приоритет полезной практики. Пустая тема выглядит средней намеренно: про
 *   неё нет наблюдений, обещать по ней точность было бы обманом. Поэтому оно
 *   подписано «практика», а не «знания».
 * - Показ разбора, подсказка и повтор семьи не засчитываются. Экран говорит об
 *   этом прямо («не засчитано» + причина), чтобы человек не думал, что его
 *   ответ забыли.
 * - Контент опубликован решением владельца, без юридической проверки. Пометка
 *   внизу экрана — не формальность: её отсутствие было бы враньём об источнике.
 */
export default function AdaptiveLearningScreen() {
  const queryClient = useQueryClient();
  // Верхний отступ считаем сами: экран лежит в навигаторе без шапки
  // (headerShown: false), поэтому content начинался от самого верха окна и на
  // iPhone уезжал под вырез.
  const insets = useSafeAreaInsets();
  const [topicId, setTopicId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [showTopics, setShowTopics] = useState(false);
  const [actionError, setActionError] = useState(null);

  const meta = useQuery({ queryKey: ['adaptive-meta'], queryFn: adaptiveApi.meta });
  const overview = useQuery({ queryKey: ['adaptive-overview'], queryFn: adaptiveApi.overview });

  const nextQuery = useQuery({
    // Тема в ключе: смена темы должна перезапрашивать кейс, а не показывать
    // старый под новым заголовком.
    queryKey: ['adaptive-next', topicId],
    queryFn: () => adaptiveApi.next({ topicId }),
  });

  const act = useMutation({
    // attempt_id, а не attemptId: сервер отдаёт snake_case (NextRead.attempt_id),
    // и прежнее обращение давало undefined — axios собирал /attempts/undefined/actions,
    // сервер отвечал 422, а экран молчал. Кнопка «Ответить» выглядела мёртвой.
    mutationFn: ({ action, optionId }) =>
      adaptiveApi.act(nextQuery.data.attempt_id, { action, optionId }),
    onSuccess: (data) => {
      setResult(data);
      if (data.counted) {
        queryClient.invalidateQueries({ queryKey: ['adaptive-overview'] });
      }
    },
    // Без этого сбой ответа был невидим: нажатие не давало ничего, и выглядело
    // это как «кнопка не работает», а не как ошибка. Показываем причину.
    onError: (error) => setActionError(describeLoadError(error, 'ответ')),
  });

  // Темы мемоизируются вместе с картой: `?? []` создавал бы новый массив на
  // каждый рендер, и `useMemo` ниже пересчитывался бы всегда.
  const topics = useMemo(() => overview.data?.topics ?? [], [overview.data]);
  const topicsById = useMemo(
    () => Object.fromEntries(topics.map((topic) => [topic.topic_id, topic])),
    [topics]
  );

  const data = nextQuery.data;
  const choice = data?.choice;
  const item = data?.item ?? data?.preview;
  const attemptId = data?.attempt_id;
  const canAnswer = Boolean(attemptId) && choice?.kind !== 'review';

  const reset = () => {
    setSelected(null);
    setResult(null);
    setActionError(null);
    nextQuery.refetch();
  };

  if (meta.isLoading || (nextQuery.isLoading && !data)) {
    return (
      <LoadingState
        label="Подбираем кейс под вас…"
        illustration={<AnimatedMascot size={112} emotion="thinking" />}
      />
    );
  }

  if (nextQuery.error || meta.error) {
    return (
      <ErrorState
        title="Не удалось загрузить практику"
        message={describeLoadError(nextQuery.error || meta.error, 'кейс')}
        onRetry={() => {
          meta.refetch();
          nextQuery.refetch();
        }}
        illustration={<WaxSeal label="!" tone="red" size={48} />}
      />
    );
  }

  /* Контента нет — это наша незакрытая работа, а не достижение ученика.
     Поздравлять с «всё пройдено» здесь было бы неправдой. */
  if (!choice || choice.kind === 'none') {
    return (
      <View style={styles.center}>
        <PaperGrain />
        <View style={[styles.stateCard, styles.completeCard]}>
          <KhokhlomaCorners variant="light" size="md" inset={9} />
          <WaxSeal label="…" tone="gold" size={62} />
          <Text style={styles.stateTitle}>Кейсы ещё не опубликованы</Text>
          <KhokhlomaDivider />
          <Text style={styles.stateNote}>
            {choice?.reason === 'NO_PUBLISHED_CONTENT'
              ? 'Разборы появятся здесь, как только их опубликуют. Ничего делать не нужно.'
              : 'Пакет контента не загрузился на сервере.'}
          </Text>
          <PressableScale style={styles.primaryBtn} onPress={() => nextQuery.refetch()}>
            <Text style={styles.primaryBtnText}>Повторить</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PaperGrain />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          // Дыра под вырез и статус-бар: без неё заголовок и кнопка «Тема»
          // начинались от верхней кромки окна.
          { paddingTop: 20 + insets.top },
          result && { paddingBottom: 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.categoryRow}>
          <Text style={styles.categorySign}>§</Text>
          <Text style={styles.categoryLabel}>АДАПТИВНАЯ ПРАКТИКА</Text>
        </View>

        <Text style={styles.title}>
          {choice.kind === 'review' ? 'Повторим пройденное' : 'Разберём ситуацию'}
        </Text>

        {/* Полоска тем: полный обзор спрятан за кнопкой, но выбранная тема
            видна всегда — иначе непонятно, почему кейс именно такой. */}
        <PressableScale style={styles.topicBar} onPress={() => setShowTopics((v) => !v)}>
          <View style={styles.topicBarLeft}>
            <Text style={styles.topicBarLabel}>ТЕМА</Text>
            <Text style={styles.topicBarTitle}>
              {topicId ? topicsById[topicId]?.title ?? topicId : 'Все темы'}
            </Text>
          </View>
          <Text style={styles.chevron}>{showTopics ? '⌃' : '⌄'}</Text>
        </PressableScale>

        {showTopics ? (
          <View style={styles.topicList}>
            <PressableScale
              style={[styles.topicRow, !topicId && styles.topicRowActive]}
              onPress={() => {
                setTopicId(null);
                setSelected(null);
                setResult(null);
                setShowTopics(false);
              }}
            >
              <Text style={styles.topicRowTitle}>Все темы</Text>
              <Text style={styles.topicRowMeta}>алгоритм выберет сам</Text>
            </PressableScale>
            {topics.map((topic) => {
              const active = topic.topic_id === topicId;
              return (
                <PressableScale
                  key={topic.topic_id}
                  style={[styles.topicRow, active && styles.topicRowActive]}
                  onPress={() => {
                    setTopicId(topic.topic_id);
                    setSelected(null);
                    setResult(null);
                    setShowTopics(false);
                  }}
                >
                  <View style={styles.topicRowHead}>
                    <Text style={styles.topicRowTitle} numberOfLines={2}>
                      {topic.title}
                    </Text>
                    <Text style={styles.topicRowPct}>{topic.practice_priority}%</Text>
                  </View>
                  <View style={styles.topicTrack}>
                    <View
                      style={[
                        styles.topicFill,
                        {
                          width: `${Math.min(100, Math.max(6, topic.practice_priority))}%`,
                          backgroundColor:
                            topic.state === 'NOT_ASSESSED' ? brand.ruleStrong : brand.gold,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.topicRowMeta}>
                    {topic.state === 'NOT_ASSESSED'
                      ? 'ещё не проверялись'
                      : `практика · ${topic.n} ответ(ов), ошибок ${topic.errors}`}
                    {' · '}
                    {topic.lessons_practised}/{topic.lessons_total} уроков
                  </Text>
                </PressableScale>
              );
            })}
            <Text style={styles.topicFoot}>
              Процент — приоритет практики, а не «уровень знаний»: чем выше, тем
              полезнее сейчас потренировать тему. Непройденные темы начинают с
              середины, потому что о них пока ничего не известно.
            </Text>
          </View>
        ) : null}

        {choice.kind === 'review' ? (
          <View style={styles.reviewCard}>
            <RibbonBookmark
              color={brand.gold}
              symbol="↺"
              right={14}
              height={26}
              width={18}
              cutoutColor={colors.card}
            />
            <Text style={styles.docEyebrow}>ПОВТОР</Text>
            <Text style={styles.reviewText}>
              Свежие кейсы по этой теме закончились. Этот вы уже видели: повтор
              закрепит разбор, но в приоритет темы не пойдёт — иначе повтор
              выглядел бы как знание.
            </Text>
            <PressableScale
              style={styles.secondaryBtn}
              onPress={async () => {
                const opened = await adaptiveApi.openAttempt({ itemId: item.item_id });
                queryClient.setQueryData(['adaptive-next', topicId], {
                  ...data,
                  attemptId: opened.attempt_id,
                  item: opened.item,
                });
              }}
            >
              <Text style={styles.secondaryBtnText}>Всё равно потренироваться</Text>
            </PressableScale>
          </View>
        ) : null}

        {item ? (
          <CaseReaction
            outcome={result ? (result.correct === true ? 'correct' : result.correct === false ? 'wrong' : null) : null}
            seed={Number(attemptId?.slice(-3)) || 0}
          >
          <View style={styles.situationCard}>
            <OutcomeBadge
              outcome={result ? (result.correct === true ? 'correct' : result.correct === false ? 'wrong' : null) : null}
              seed={Number(attemptId?.slice(-3)) || 0}
            />
            <RibbonBookmark
              color={brand.red}
              symbol="§"
              right={16}
              height={28}
              width={20}
              cutoutColor={colors.card}
            />
            <Text style={styles.docEyebrow}>
              {item.topic_title} · {item.lesson_title}
            </Text>
            <Text style={styles.situation}>{item.situation}</Text>
          </View>
          </CaseReaction>
        ) : null}

        {/* Мишка задаёт вопрос. Текст пузыря короткий и про действие
            («выберите вариант»), а не пересказ ситуации: пересказ дублировал
            бы карточку выше и отодвигал варианты ответа. */}
        {item ? (
          <MascotPrompt
            text={
              result
                ? result.correct === true
                  ? 'Верно. Разбор ниже.'
                  : 'Разберём, почему так.'
                : 'Как поступите?'
            }
            result={result}
            assisted={Boolean(result?.assistance)}
          />
        ) : null}

        {item ? <Text style={styles.prompt}>{item.question}</Text> : null}

        {item
          ? item.options.map((option) => {
              const isSelected = selected === option.id;
              const isRight = Boolean(result) && result.correct_option_id === option.id;
              const isWrongPick =
                Boolean(result) && isSelected && result.correct_option_id !== option.id;
              return (
                <PressableScale
                  key={option.id}
                  disabled={Boolean(result) || !canAnswer || act.isPending}
                  onPress={() => {
                    setActionError(null);
                    setSelected(option.id);
                  }}
                  style={[
                    styles.option,
                    isSelected && !result && styles.optionSelected,
                    isRight && styles.optionRight,
                    isWrongPick && styles.optionWrong,
                  ]}
                >
                  <View style={styles.optionBadge}>
                    <Text style={styles.optionBadgeText}>{option.id}</Text>
                  </View>
                  <Text style={styles.optionText}>{option.text}</Text>
                </PressableScale>
              );
            })
          : null}

        {item && canAnswer && !result ? (
          <PressableScale
            style={[styles.primaryBtn, (!selected || act.isPending) && styles.btnDisabled]}
            disabled={!selected || act.isPending}
            onPress={() => act.mutate({ action: 'answer', optionId: selected })}
          >
            <Text style={styles.primaryBtnText}>Ответить</Text>
          </PressableScale>
        ) : null}

        {actionError ? (
          <View style={styles.actionError}>
            <Text style={styles.actionErrorText}>{actionError}</Text>
          </View>
        ) : null}

        {item && canAnswer && !result ? (
          <View style={styles.rowButtons}>
            <PressableScale
              style={styles.ghostBtn}
              disabled={act.isPending}
              onPress={() => act.mutate({ action: 'help' })}
            >
              <Text style={styles.ghostBtnText}>Подсказка</Text>
            </PressableScale>
            <PressableScale
              style={styles.ghostBtn}
              disabled={act.isPending}
              onPress={() => act.mutate({ action: 'skip' })}
            >
              <Text style={styles.ghostBtnText}>Пропустить</Text>
            </PressableScale>
          </View>
        ) : null}

        {/* Подсказка не закрывает попытку, но снимает зачёт — говорим прямо. */}
        {result?.assistance ? (
          <View style={styles.helpCard}>
            <Text style={styles.helpKicker}>ПОДСКАЗКА</Text>
            <Text style={styles.helpText}>{result.assistance}</Text>
            <Text style={styles.helpNote}>
              После подсказки ответ не засчитывается: приоритет темы должен
              отражать самостоятельные ответы.
            </Text>
          </View>
        ) : null}

        {result && result.status !== 'open' ? (
          <View style={[styles.resultCard, result.counted ? styles.resultOk : styles.resultMuted]}>
            <Text style={styles.resultKicker}>
              {result.counted ? '§ ЗАСЧИТАНО' : '§ НЕ ЗАСЧИТАНО'}
            </Text>
            <Text style={styles.resultTitle}>
              {result.correct === true
                ? 'Верно'
                : result.correct === false
                ? 'Неверно'
                : result.status === 'skipped'
                ? 'Пропущено'
                : 'Показан разбор'}
            </Text>
            {result.correct_option_id ? (
              <Text style={styles.resultAnswer}>
                Верный вариант: {result.correct_option_id}
              </Text>
            ) : null}
            {result.explanation ? (
              <Text style={styles.resultText}>{result.explanation}</Text>
            ) : null}
            {!result.counted && result.reason ? (
              <Text style={styles.resultReason}>{describeReason(result.reason)}</Text>
            ) : null}
            {result.legal_basis_ids?.length ? (
              <Text style={styles.resultLaw}>Нормы: {result.legal_basis_ids.join(', ')}</Text>
            ) : null}
            <PressableScale style={styles.primaryBtn} onPress={reset}>
              <Text style={styles.primaryBtnText}>Следующий кейс</Text>
            </PressableScale>
          </View>
        ) : null}

        {overview.data?.editorial_note ? (
          <Text style={styles.editorialNote}>{overview.data.editorial_note}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * Причины незачёта — те же, что возвращает сервер.
 *
 * Показывать код («PRACTICE») бессмысленно, а молчать — хуже: человек решил,
 * что приложение сломалось.
 */
function describeReason(reason) {
  const map = {
    SKIP: 'Кейс пропущен — наблюдение не создаётся.',
    REVEAL: 'Вы посмотрели разбор до ответа.',
    NOT_ASSESSMENT: 'Это учебный разбор, а не проверка.',
    FAMILY_SEEN: 'Похожее задание уже встречалось — повтор не засчитывается.',
    PRACTICE: 'Это тренировка, а не проверка.',
    ASSISTED: 'Была подсказка.',
    CONTENT_UNAVAILABLE: 'Карточка отозвана редакцией.',
    COUNTED: '',
  };
  return map[reason] ?? 'Ответ не засчитан.';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: colors.background,
  },
  content: { padding: 20, paddingBottom: 60, gap: 14 },
  actionError: {
    backgroundColor: brand.redSoft,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: brand.red,
    padding: 12,
  },
  actionErrorText: { fontSize: 13, fontWeight: '700', color: brand.redDark, lineHeight: 18 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categorySign: { fontSize: 16, color: brand.red, fontWeight: '900' },
  categoryLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: brand.goldInk,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    fontFamily: serifFamily,
  },
  topicBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: brand.rule,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topicBarLeft: { flex: 1, gap: 2 },
  topicBarLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: brand.muted,
  },
  topicBarTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  chevron: { fontSize: 18, color: brand.subtext, fontWeight: '800' },
  topicList: { gap: 10 },
  topicRow: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: brand.rule,
    padding: 14,
    gap: 8,
  },
  topicRowActive: { borderColor: brand.red, backgroundColor: brand.redSoft },
  topicRowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicRowTitle: { flex: 1, fontSize: 14.5, fontWeight: '800', color: colors.text },
  topicRowPct: { fontSize: 14, fontWeight: '900', color: brand.goldInk },
  topicTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  topicFill: { height: '100%', borderRadius: 4 },
  topicRowMeta: { fontSize: 11.5, fontWeight: '600', color: colors.subtext },
  topicFoot: {
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.subtext,
    fontStyle: 'italic',
  },
  situationCard: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: brand.rule,
    padding: 18,
    paddingRight: 30,
    gap: 8,
  },
  docEyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: brand.muted,
  },
  situation: { fontSize: 15.5, lineHeight: 23, color: colors.text },
  prompt: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
    color: colors.text,
    fontFamily: serifFamily,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: brand.rule,
    padding: 14,
  },
  optionSelected: { borderColor: brand.gold, backgroundColor: brand.goldSoft },
  optionRight: { borderColor: brand.pine, backgroundColor: brand.pineSoft },
  optionWrong: { borderColor: brand.red, backgroundColor: brand.redSoft },
  optionBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: brand.cream,
    borderWidth: 1.5,
    borderColor: brand.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeText: { fontSize: 12.5, fontWeight: '900', color: colors.text },
  optionText: { flex: 1, fontSize: 14.5, lineHeight: 21, color: colors.text },
  primaryBtn: {
    backgroundColor: brand.red,
    borderRadius: 16,
    borderBottomWidth: 4,
    borderBottomColor: brand.redDark,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 15.5, fontWeight: '900', color: brand.creamText },
  btnDisabled: { opacity: 0.45 },
  secondaryBtn: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: brand.goldBorder,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 13.5, fontWeight: '800', color: brand.goldInk },
  rowButtons: { flexDirection: 'row', gap: 10 },
  ghostBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: brand.rule,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostBtnText: { fontSize: 13.5, fontWeight: '800', color: colors.subtext },
  helpCard: {
    backgroundColor: brand.infoSoft,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: brand.infoBorder,
    padding: 16,
    gap: 8,
  },
  helpKicker: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: brand.infoInk,
  },
  helpText: { fontSize: 14.5, lineHeight: 21, color: colors.text },
  helpNote: { fontSize: 11.5, lineHeight: 17, color: brand.infoInk },
  resultCard: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 18,
    gap: 10,
  },
  resultOk: { backgroundColor: brand.pineSoft, borderColor: brand.pineBorder },
  resultMuted: { backgroundColor: colors.card, borderColor: brand.rule },
  resultKicker: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: brand.muted,
  },
  resultTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: colors.text,
    fontFamily: serifFamily,
  },
  resultAnswer: { fontSize: 13.5, fontWeight: '800', color: colors.subtext },
  resultText: { fontSize: 14.5, lineHeight: 22, color: colors.text },
  resultReason: { fontSize: 12.5, lineHeight: 18, color: colors.subtext, fontStyle: 'italic' },
  resultLaw: { fontSize: 11.5, fontWeight: '700', color: brand.infoInk },
  reviewCard: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: brand.goldBorder,
    padding: 18,
    paddingRight: 32,
    gap: 10,
  },
  reviewText: { fontSize: 13.5, lineHeight: 20, color: colors.subtext },
  stateCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: brand.rule,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  completeCard: { borderWidth: 2, borderColor: brand.gold, paddingVertical: 28 },
  stateTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    fontFamily: serifFamily,
  },
  stateNote: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.subtext,
    textAlign: 'center',
  },
  editorialNote: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: brand.muted,
    fontStyle: 'italic',
  },
});
