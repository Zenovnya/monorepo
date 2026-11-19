import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adaptiveApi } from '../api/adaptive';
import { describeLoadError } from '../api/client';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { MascotPrompt } from '../components/MascotPrompt';
import { PressableScale } from '../components/PressableScale';
import { ErrorState, LoadingState } from '../components/StateViews';
import {
  brand,
  serifFamily,
  KhokhlomaDivider,
  PaperGrain,
  RibbonBookmark,
  WaxSeal,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Урок «Лапы Закона»: разбор → проверка.
 *
 * Три состояния, и они не должны смешиваться:
 *
 * 1. **Теория** — то, что можно читать: ситуация, шаги, норма. Ответов здесь
 *    нет, потому что это разбор, а не проверка.
 * 2. **Проверка** — карточка без ключа. Проверяется сервером, клиент не знает
 *    правильный вариант заранее.
 * 3. **Разбор после ответа** — ключ, объяснение и ссылки на нормы.
 *
 * Подсказка доступна в проверке, но снимает зачёт: иначе «подсмотрел» и
 * «знаешь» выглядели бы одинаково в приоритете темы.
 */
export default function LessonScreen({ route, navigation }) {
  const { lessonId } = route.params ?? {};
  const queryClient = useQueryClient();
  // Отступ от выреза считаем сами: у стека headerShown: false, и кнопка
  // «Назад» упиралась в верхнюю кромку экрана.
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState('theory'); // theory | check
  const [selected, setSelected] = useState(null);
  const [card, setCard] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [result, setResult] = useState(null);
  const [hint, setHint] = useState(null);
  const [actionError, setActionError] = useState(null);

  const lesson = useQuery({
    queryKey: ['adaptive-lesson', lessonId],
    queryFn: () => adaptiveApi.lesson(lessonId),
    enabled: Boolean(lessonId),
  });

  const openCheck = useMutation({
    mutationFn: () => adaptiveApi.openAttempt({ itemId: lesson.data.control_item_id, origin: 'lesson', mode: 'check' }),
    onSuccess: (data) => {
      // Карточка приходит вместе с попыткой: отдельного запроса «дай вопрос»
      // нет, иначе клиент мог бы получить его, не открывая попытку.
      setCard(data.item);
      setAttemptId(data.attempt_id);
      setSelected(null);
      setResult(null);
      setHint(null);
      setActionError(null);
      setPhase('check');
    },
  });

  const act = useMutation({
    mutationFn: ({ action, optionId }) => adaptiveApi.act(attemptId, { action, optionId }),
    onSuccess: (data) => {
      setActionError(null);
      if (data.status === 'open') {
        setHint(data.assistance);
        return;
      }
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['adaptive-overview'] });
    },
    // Сбой ответа раньше был невидим: нажатие «Ответить» не давало ничего, и
    // это читалось как «кнопка не работает». Теперь причина на экране.
    onError: (error) => setActionError(describeLoadError(error, 'ответ')),
  });

  if (!lessonId) {
    return (
      <ErrorState
        title="Урок не выбран"
        message="Вернитесь к списку тем и откройте урок оттуда."
        onRetry={() => navigation.goBack()}
        illustration={<WaxSeal label="?" tone="locked" size={48} />}
      />
    );
  }

  if (lesson.isLoading) {
    return (
      <LoadingState
        label="Открываем разбор…"
        illustration={<AnimatedMascot size={112} emotion="thinking" />}
      />
    );
  }

  if (lesson.error) {
    return (
      <ErrorState
        title="Не удалось открыть урок"
        message={describeLoadError(lesson.error, 'урок')}
        onRetry={() => lesson.refetch()}
        illustration={<WaxSeal label="!" tone="red" size={48} />}
      />
    );
  }

  const data = lesson.data;
  const theory = data.theory || '';
  const paragraphs = theory.split(/\n{2,}/).filter(Boolean);
  const steps = Array.isArray(data.actions) ? data.actions : [];
  // Проверка возможна, только когда попытка действительно открыта: ручка
  // /adaptive требует attempt_id, «просто посмотреть ключ» нельзя.
  const checking = phase === 'check' && Boolean(attemptId);
  const error =
    openCheck.error?.response?.data?.detail === 'CONTENT_UNAVAILABLE'
      ? 'Эта карточка отозвана редакцией — проверку пройти нельзя.'
      : null;

  return (
    <View style={styles.container}>
      <PaperGrain />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          // 20 + вырез: кнопка «Назад» больше не начинается под статус-баром.
          { paddingTop: 12 + insets.top },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Кнопка «Назад».
            Раньше это был голый текст «‹ Назад» высотой ~20pt у самого верха
            экрана: попасть в него пальцем было тяжело, а на iPhone с вырезом он
            ещё и оказывался под ним. Теперь это плашка 44×44 (минимальный
            размер цели по гайдлайнам Apple) с hitSlop, отодвинутая от выреза. */}
        <PressableScale
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          accessibilityRole="button"
          accessibilityLabel="Назад в меню"
          scale={0.92}
        >
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backText}>Назад</Text>
        </PressableScale>

        <View style={styles.categoryRow}>
          <Text style={styles.categorySign}>§</Text>
          <Text style={styles.categoryLabel}>
            {data.topic_title} · УРОК {data.order}
          </Text>
        </View>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.goal}>{data.goal}</Text>

        <View style={styles.theoryCard}>
          <RibbonBookmark
            color={brand.red}
            symbol="§"
            right={16}
            height={28}
            width={20}
            cutoutColor={colors.card}
          />
          <Text style={styles.cardEyebrow}>РАЗБОР</Text>
          {paragraphs.map((paragraph, index) => (
            <Text key={index} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>

        {steps.length ? (
          <View style={styles.stepsCard}>
            <Text style={styles.cardEyebrow}>ЧТО ДЕЛАТЬ</Text>
            {steps.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>
                  {typeof step === 'string' ? step : step.text ?? JSON.stringify(step)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.legal_basis_ids?.length ? (
          <Text style={styles.law}>Нормы: {data.legal_basis_ids.join(', ')}</Text>
        ) : null}

        <KhokhlomaDivider />

        {!checking ? (
          <>
            <Text style={styles.sectionTitle}>Проверим себя</Text>
            <Text style={styles.sectionNote}>
              Одна карточка по этому уроку. Засчитывается первый самостоятельный
              ответ — подсказка снимает зачёт.
            </Text>
            {error ? <Text style={styles.errorNote}>{error}</Text> : null}
            <PressableScale
              style={[styles.primaryBtn, openCheck.isPending && styles.btnDisabled]}
              disabled={openCheck.isPending}
              onPress={() => openCheck.mutate()}
            >
              <Text style={styles.primaryBtnText}>
                {openCheck.isPending ? 'Открываем…' : 'Пройти проверку'}
              </Text>
            </PressableScale>
          </>
        ) : null}

        {checking ? (
          <View style={styles.checkCard}>
            <Text style={styles.cardEyebrow}>ПРОВЕРКА</Text>
            {/* Тот же маскот, что и в кейсах: вопрос задаёт Мишка. */}
            <MascotPrompt
              text={
                result
                  ? result.correct === true
                    ? 'Верно!'
                    : 'Сейчас разберём.'
                  : 'Что выберете?'
              }
              result={result}
              assisted={Boolean(hint)}
              size={68}
            />
            <Text style={styles.checkQuestion}>{card?.question}</Text>
            {(card?.options ?? []).map((option) => {
              const isSelected = selected === option.id;
              const isRight = Boolean(result) && result.correct_option_id === option.id;
              const isWrongPick =
                Boolean(result) && isSelected && result.correct_option_id !== option.id;
              return (
                <PressableScale
                  key={option.id}
                  disabled={Boolean(result) || act.isPending}
                  onPress={() => setSelected(option.id)}
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
            })}

            {actionError ? (
              <View style={styles.actionError}>
                <Text style={styles.actionErrorText}>{actionError}</Text>
              </View>
            ) : null}

            {!result ? (
              <View style={styles.rowButtons}>
                <PressableScale
                  style={[styles.ghostBtn, act.isPending && styles.btnDisabled]}
                  disabled={act.isPending}
                  onPress={() => act.mutate({ action: 'help' })}
                >
                  <Text style={styles.ghostBtnText}>Подсказка</Text>
                </PressableScale>
                <PressableScale
                  style={[styles.primaryBtn, (!selected || act.isPending) && styles.btnDisabled]}
                  disabled={!selected || act.isPending}
                  onPress={() => act.mutate({ action: 'answer', optionId: selected })}
                >
                  <Text style={styles.primaryBtnText}>Ответить</Text>
                </PressableScale>
              </View>
            ) : (
              <PressableScale style={styles.primaryBtn} onPress={() => navigation.navigate('Adaptive')}>
                <Text style={styles.primaryBtnText}>Дальше к практике</Text>
              </PressableScale>
            )}
          </View>
        ) : null}

        {result ? (
          <View style={[styles.resultCard, !result.counted && styles.resultMuted]}>
            <Text style={styles.cardEyebrow}>
              {result.counted ? '§ ЗАСЧИТАНО' : '§ НЕ ЗАСЧИТАНО'}
            </Text>
            <Text style={styles.resultTitle}>{result.correct ? 'Верно' : 'Неверно'}</Text>
            {result.correct_option_id ? (
              <Text style={styles.resultAnswer}>
                Верный вариант: {result.correct_option_id}
              </Text>
            ) : null}
            {result.explanation ? (
              <Text style={styles.paragraph}>{result.explanation}</Text>
            ) : null}
            {!result.counted && result.reason === 'ASSISTED' ? (
              <Text style={styles.reasonNote}>
                Была подсказка — ответ не идёт в приоритет темы.
              </Text>
            ) : null}
            {result.legal_basis_ids?.length ? (
              <Text style={styles.law}>Нормы: {result.legal_basis_ids.join(', ')}</Text>
            ) : null}
          </View>
        ) : null}

        {hint ? (
          <View style={styles.hintCard}>
            <Text style={styles.cardEyebrow}>ПОДСКАЗКА</Text>
            <Text style={styles.paragraph}>{hint}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60, gap: 14 },
  actionError: {
    backgroundColor: brand.redSoft,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: brand.red,
    padding: 12,
  },
  actionErrorText: { fontSize: 13, fontWeight: '700', color: brand.redDark, lineHeight: 18 },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // Не меньше 44: это минимальная цель, в которую человек попадает пальцем.
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: brand.rule,
  },
  backIcon: { fontSize: 17, fontWeight: '900', color: colors.text, marginTop: -1 },
  backText: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categorySign: { fontSize: 16, color: brand.red, fontWeight: '900' },
  categoryLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: brand.goldInk,
  },
  title: { fontSize: 25, fontWeight: '900', color: colors.text, fontFamily: serifFamily },
  goal: { fontSize: 14, lineHeight: 21, color: colors.subtext },
  theoryCard: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: brand.rule,
    padding: 18,
    paddingRight: 34,
    gap: 10,
  },
  cardEyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: brand.muted,
  },
  paragraph: { fontSize: 15, lineHeight: 23, color: colors.text },
  stepsCard: {
    backgroundColor: brand.goldSoft,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: brand.goldBorder,
    padding: 18,
    gap: 12,
  },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: brand.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { fontSize: 12, fontWeight: '900', color: brand.ink },
  stepText: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.text },
  law: { fontSize: 12, fontWeight: '700', color: brand.infoInk },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: colors.text, fontFamily: serifFamily },
  sectionNote: { fontSize: 13, lineHeight: 19, color: colors.subtext },
  errorNote: { fontSize: 12.5, fontWeight: '700', color: brand.red },
  primaryBtn: {
    backgroundColor: brand.red,
    borderRadius: 16,
    borderBottomWidth: 4,
    borderBottomColor: brand.redDark,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 15.5, fontWeight: '900', color: brand.creamText },
  btnDisabled: { opacity: 0.5 },
  checkCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: brand.goldBorder,
    padding: 18,
    gap: 10,
  },
  checkQuestion: { fontSize: 16, fontWeight: '800', color: colors.text, lineHeight: 23 },
  checkHintMeta: { fontSize: 12.5, lineHeight: 18, color: colors.subtext },
  resultCard: {
    backgroundColor: brand.pineSoft,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: brand.pineBorder,
    padding: 18,
    gap: 8,
  },
  resultMuted: { backgroundColor: colors.card, borderColor: brand.rule },
  resultAnswer: { fontSize: 13.5, fontWeight: '800', color: colors.subtext },
  reasonNote: { fontSize: 12.5, lineHeight: 18, color: colors.subtext, fontStyle: 'italic' },
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
  rowButtons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
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
  resultTitle: { fontSize: 20, fontWeight: '900', color: colors.text, fontFamily: serifFamily },
  hintCard: {
    backgroundColor: brand.infoSoft,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: brand.infoBorder,
    padding: 18,
    gap: 8,
  },
});
