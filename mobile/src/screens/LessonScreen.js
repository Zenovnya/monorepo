import React, { useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adaptiveApi } from '../api/adaptive';
import { gamificationApi } from '../api/gamification';
import { describeLoadError } from '../api/client';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { MascotPrompt } from '../components/MascotPrompt';
import { CaseReaction, OutcomeBadge } from '../components/CaseReaction';
import { TactilePressable } from '../components/TactilePressable';
import { ErrorState, LoadingState } from '../components/StateViews';
import {
  brand,
  serifFamily,
  KhokhlomaDivider,
  PaperGrain,
  RibbonBookmark,
  WaxSeal,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/tokens';

/**
 * Bottom Sheet вердикта (§5).
 *
 * Зелёный (#D7FFB8 / #58A700) — верный ответ, красный
 * (#FFDFE0 / #EA2B2B) — неверный. Под объяснение даётся ссылка
 * на статью, кнопка «ДАЛЕЕ» — в следующую практику.
 */
function VerdictSheet({ result, onNext }) {
  const correct = result.correct === true;
  React.useEffect(() => {
    Haptics.notificationAsync(
      correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    ).catch(() => {});
  }, [correct]);

  const bg = correct ? colors.verdictOk : colors.verdictWrong;
  const titleColor = correct ? colors.verdictOkTitle : colors.verdictWrongTitle;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onNext}>
      <Pressable style={styles.verdictOverlay} onPress={onNext}>
        <View style={[styles.verdictSheet, { backgroundColor: bg, borderColor: titleColor }]}>
          <View style={styles.verdictHandle} />
          <View style={[styles.verdictBadge, { backgroundColor: titleColor }]}>
            <Text style={styles.verdictBadgeText}>{correct ? '✓' : '✕'}</Text>
          </View>
          <Text style={[styles.verdictTitle, { color: titleColor }]}>
            {correct ? 'Верно' : 'Неверно'}
          </Text>
          {result.correct_option_id ? (
            <Text style={styles.verdictAnswer}>
              Верный вариант: {result.correct_option_id}
            </Text>
          ) : null}
          {result.explanation ? (
            <Text style={styles.verdictText}>{result.explanation}</Text>
          ) : null}
          {result.legal_basis_ids?.length ? (
            <View style={styles.verdictLaw}>
              <Text style={[styles.verdictLawText, { color: titleColor }]}>
                Нормы: {result.legal_basis_ids.join(', ')}
              </Text>
            </View>
          ) : null}
          {!result.counted && result.reason === 'ASSISTED' ? (
            <Text style={styles.verdictNote}>
              Была подсказка — ответ не идёт в приоритет темы.
            </Text>
          ) : null}
          <TactilePressable
            style={styles.verdictBtn}
            onPress={onNext}
            haptic
            scale={0.96}
          >
            <Text style={styles.verdictBtnText}>ДАЛЕЕ</Text>
          </TactilePressable>
        </View>
      </Pressable>
    </Modal>
  );
}

/**
 * Прогресс-бар 12px с пружинной анимацией и бликом (§5).
 *
 * Заполнение растягивается через withSpring при смене значения,
 * сверху блик добавляет «лакированную» глубину.
 */
function LessonProgress({ progress }) {
  const pct = Math.max(0, Math.min(100, progress || 0));
  const fill = useSharedValue(pct);
  React.useEffect(() => {
    fill.value = withSpring(pct, { damping: 14, stiffness: 180 });
  }, [pct, fill]);

  const animatedFill = useAnimatedStyle(() => ({
    width: `${fill.value}%`,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, animatedFill]} />
      <View style={styles.progressGlow} pointerEvents="none" />
    </View>
  );
}

/**
 * Счётчик жизней с пульсацией (§5): каждая жизнь — ❤️, остаток
 * пульсирует через Reanimated, как в Duolingo.
 */
function LifeCounter({ lives }) {
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 350, easing: Animated.Easing.out(Animated.Easing.quad) }),
        withTiming(1, { duration: 350, easing: Animated.Easing.in(Animated.Easing.quad) })
      ),
      -1,
      true
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.livesRow}>
      <Animated.View style={animatedStyle}>
        <Text style={styles.livesIcon}>❤️</Text>
      </Animated.View>
      <Text style={styles.livesText}>{Math.max(0, lives || 0)}</Text>
    </View>
  );
}

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
  const [openError, setOpenError] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);
  // Флаг повтора открытия после OPEN_ATTEMPT: чтобы не уйти в бесконечный
  // цикл, если попытка всё ещё открыта после повторного запроса.
  const openCheckRetried = useRef(false);

  const lesson = useQuery({
    queryKey: ['adaptive-lesson', lessonId],
    queryFn: () => adaptiveApi.lesson(lessonId),
    enabled: Boolean(lessonId),
  });

  // Жизни тянем из gamification-me, а не из lesson-payload: lesson не содержит
  // lives, и счётчик ❤️ показывал дефолт 5 даже после списания за ошибку.
  const gamification = useQuery({
    queryKey: ['gamification-me'],
    queryFn: gamificationApi.me,
    staleTime: 0,
  });

  // Жизней нет — открытие проверки блокируется: вместо безнадёжной ошибки
  // ведём на экран восстановления (NoLives), где есть обратный отсчёт и
  // кнопка «Вернуться» после восстановления.
  const livesLeft = gamification.data?.lives ?? 5;

  const openCheck = useMutation({
    // Сначала закрываем уже открытую попытку (например, открытый из
    // адаптивной вкладки кейс): иначе сервер отвечает OPEN_ATTEMPT, и кнопка
    // «Пройти проверку» падала с ошибкой вместо открытия проверки урока.
    // attempt.status != "open" — уже закрытая попытка ответит already_closed
    // без ошибки, так что проактивный skip безопасен.
    mutationFn: async () => {
      const openId = lesson.data?.open_attempt_id;
      if (openId) {
        try {
          await adaptiveApi.act(openId, { action: 'skip' });
        } catch {
          // Уже закрыта между загрузкой урока и нажатием — игнорируем.
        }
      }
      return adaptiveApi.openAttempt({
        itemId: lesson.data.control_item_id,
        origin: 'lesson',
        mode: 'check',
      });
    },
    // Без этого сбой открытия проверки был невидим: сервер мог ответить 400
    // (например OPEN_ATTEMPT — попытка уже открыта из кейса), а кнопка
    // «Пройти проверку» просто молчала. Экран менялся не мог: phase оставался
    // 'theory', loader не показывался, и выглядело это как «кнопка не
    // работает», а не как ошибка.
    onError: async (error) => {
      const detail = error?.response?.data?.detail;
      // open_attempt_id из lesson-payload может быть устаревшим (закэширован
      // до открытия кейса в адаптивной вкладке). Тогда проактивный skip
      // не сработал и сервер ответил OPEN_ATTEMPT: запрашиваем актуальное
      // состояние, закрываем чужую попытку и повторяем открытие один раз.
      if (detail === 'OPEN_ATTEMPT' && !openCheckRetried.current) {
        openCheckRetried.current = true;
        try {
          const next = await adaptiveApi.next({ openAttempt: false });
          const openId = next?.attempt_id;
          if (openId) {
            await adaptiveApi.act(openId, { action: 'skip' });
          }
          openCheck.mutate();
          return;
        } catch {
          openCheckRetried.current = false;
        }
      }
      setOpenError(describeOpenError(error));
    },
    onSuccess: (data) => {
      openCheckRetried.current = false;
      setOpenError(null);
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
      if (data.xp_gained || data.lives_spent) {
        // Оптимистичное обновление: применяем изменения из ответа сразу,
        // без ожидания полного refetch gamification-me. Без этого счётчики
        // XP/❤️ «подвисали» на прежних значениях, пока запрос не успевал
        // вернуться (и при сбое refetch — навсегда).
        queryClient.setQueryData(['gamification-me'], (prev) => {
          if (!prev) return prev;
          const nextXp = prev.xp + (data.xp_gained || 0);
          const nextLives = Math.max(0, (prev.lives ?? 0) - (data.lives_spent || 0));
          return { ...prev, xp: nextXp, lives: nextLives };
        });
        queryClient.invalidateQueries({ queryKey: ['gamification-me'] });
      }
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
        <TactilePressable
          onPress={() => setConfirmClose(true)}
          style={styles.backBtn}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          accessibilityRole="button"
          accessibilityLabel="Закрыть урок"
          scale={0.9}
          haptic
        >
          <Text style={styles.backIcon}>✕</Text>
        </TactilePressable>

        <View style={styles.categoryRow}>
          <Text style={styles.categorySign}>§</Text>
          <Text style={styles.categoryLabel}>
            {data.topic_title} · УРОК {data.order}
          </Text>
        </View>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.goal}>{data.goal}</Text>

        {/* Прогресс-бар 12px с пружинной анимацией и счётчик жизней */}
        <View style={styles.progressRow}>
          <LessonProgress progress={phase === 'check' ? 50 : 0} />
          <LifeCounter lives={gamification.data?.lives ?? 5} />
        </View>

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
            {openError ? <Text style={styles.errorNote}>{openError}</Text> : null}
            {livesLeft <= 0 ? (
              <Text style={styles.errorNote}>
                Жизни закончились — дождитесь восстановления или купите
                «Пополнение жизней» в лавке.
              </Text>
            ) : null}
            <TactilePressable
              style={[styles.primaryBtn, (openCheck.isPending || livesLeft <= 0) && styles.btnDisabled]}
              disabled={openCheck.isPending || livesLeft <= 0}
              onPress={() => {
                if (livesLeft <= 0) {
                  // Жизней нет — ведём на экран восстановления вместо безнадёжной
                  // попытки открыть проверку.
                  navigation.navigate('NoLives', {
                    lives: gamification.data?.lives ?? 0,
                    next_life_in_seconds:
                      gamification.data?.next_life_in_seconds ?? 0,
                  });
                  return;
                }
                setOpenError(null);
                openCheck.mutate();
              }}
              haptic
              scale={0.96}
            >
              <Text style={styles.primaryBtnText}>
                {openCheck.isPending ? 'Открываем…' : 'Пройти проверку'}
              </Text>
            </TactilePressable>
          </>
        ) : null}

        {checking ? (
          <CaseReaction
            outcome={result ? (result.correct === true ? 'correct' : result.correct === false ? 'wrong' : null) : null}
            seed={Number(attemptId?.slice(-3)) || 0}
          >
          <View style={styles.checkCard}>
            <OutcomeBadge
              outcome={result ? (result.correct === true ? 'correct' : result.correct === false ? 'wrong' : null) : null}
              seed={Number(attemptId?.slice(-3)) || 0}
            />
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
                <TactilePressable
                  key={option.id}
                  disabled={Boolean(result) || act.isPending}
                  onPress={() => {
                    setSelected(option.id);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  style={[
                    styles.option,
                    isSelected && !result && styles.optionSelected,
                    isRight && styles.optionRight,
                    isWrongPick && styles.optionWrong,
                  ]}
                  haptic
                  scale={0.97}
                  borderDepth={4}
                >
                  <View style={styles.optionBadge}>
                    <Text style={styles.optionBadgeText}>{option.id}</Text>
                  </View>
                  <Text style={styles.optionText}>{option.text}</Text>
                </TactilePressable>
              );
            })}

            {actionError ? (
              <View style={styles.actionError}>
                <Text style={styles.actionErrorText}>{actionError}</Text>
              </View>
            ) : null}

            {!result ? (
              <View style={styles.rowButtons}>
                <TactilePressable
                  style={[styles.ghostBtn, act.isPending && styles.btnDisabled]}
                  disabled={act.isPending}
                  onPress={() => act.mutate({ action: 'help' })}
                  haptic
                  scale={0.96}
                >
                  <Text style={styles.ghostBtnText}>Подсказка</Text>
                </TactilePressable>
                <TactilePressable
                  style={[styles.primaryBtn, (!selected || act.isPending) && styles.btnDisabled]}
                  disabled={!selected || act.isPending}
                  onPress={() => act.mutate({ action: 'answer', optionId: selected })}
                  haptic
                  scale={0.96}
                >
                  <Text style={styles.primaryBtnText}>Ответить</Text>
                </TactilePressable>
              </View>
            ) : (
              <TactilePressable
                style={styles.primaryBtn}
                onPress={() => navigation.navigate('Adaptive')}
                haptic
                scale={0.96}
              >
                <Text style={styles.primaryBtnText}>Дальше к практике</Text>
              </TactilePressable>
            )}
          </View>
          </CaseReaction>
        ) : null}

        {result ? <VerdictSheet result={result} onNext={() => navigation.navigate('Adaptive')} /> : null}

        {hint ? (
          <View style={styles.hintCard}>
            <Text style={styles.cardEyebrow}>ПОДСКАЗКА</Text>
            <Text style={styles.paragraph}>{hint}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* X-кнопка с подтверждением (§5) */}
      {confirmClose ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setConfirmClose(false)}>
          <Pressable
            style={styles.confirmOverlay}
            onPress={() => setConfirmClose(false)}
          >
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Закрыть урок?</Text>
              <Text style={styles.confirmText}>
                Пройдённый прогресс сохраняется, но разбор будет закрыт.
              </Text>
              <View style={styles.confirmRow}>
                <TactilePressable
                  style={styles.confirmGhost}
                  onPress={() => setConfirmClose(false)}
                  haptic
                  scale={0.96}
                >
                  <Text style={styles.confirmGhostText}>Остаться</Text>
                </TactilePressable>
                <TactilePressable
                  style={styles.confirmBtn}
                  onPress={() => {
                    setConfirmClose(false);
                    navigation.goBack();
                  }}
                  haptic
                  scale={0.96}
                >
                  <Text style={styles.confirmBtnText}>Закрыть</Text>
                </TactilePressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

/**
 * Причины, по которым не удалось открыть проверку.

 * OPEN_ATTEMPT — самая частая: у пользователя уже открыта попытка из
 * «Адаптивной практики» (кес, который он открыл, но не ответил). В прошлой
 * версии этот код уходил в пустоту: кнопка молчала, и казалось, что кнопка
 * не работает.
 */
function describeOpenError(error) {
  const detail = error?.response?.data?.detail;
  const map = {
    OPEN_ATTEMPT:
      'У вас уже открыт кейс на другой карточке. Закройте его — ответьте, пропустите или нажмите «Следующий кейс» — и пройдите проверку.',
    CONTENT_UNAVAILABLE:
      'Эта карточка отозвана редакцией — проверку пройти нельзя.',
    UNKNOWN_ITEM: 'Карточка проверки не найдена. Возможно, урок обновлён.',
    FAMILY_SEEN: 'Схожая задача уже встречалась — проверка открыта в режиме практики.',
    WRONG_MODE: 'Неверный тип карточки для проверки.',
    BAD_ORIGIN: 'Неверный источник проверки.',
  };
  if (map[detail]) {
    return map[detail];
  }
  return describeLoadError(error, 'проверку');
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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  progressTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: brand.pine,
  },
  progressGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  livesRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  livesIcon: { fontSize: 18 },
  livesText: {
    fontSize: 15,
    fontWeight: '900',
    color: brand.red,
    minWidth: 14,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(44, 37, 32, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1.5,
    borderBottomWidth: 5,
    borderColor: brand.rule,
    padding: 24,
    gap: 10,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.subtext,
    textAlign: 'center',
  },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  confirmGhost: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: brand.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmGhostText: { fontSize: 14, fontWeight: '800', color: colors.text },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: brand.red,
    borderBottomWidth: 4,
    borderBottomColor: brand.redDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: { fontSize: 14, fontWeight: '900', color: brand.creamText },

  /* Bottom Sheet вердикта (§5) */
  verdictOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(44, 37, 32, 0.55)',
  },
  verdictSheet: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: 36,
    gap: 10,
    alignItems: 'center',
  },
  verdictHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(44, 37, 32, 0.2)',
    marginBottom: 4,
  },
  verdictBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictBadgeText: { fontSize: 22, fontWeight: '900', color: colors.card },
  verdictTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  verdictAnswer: { fontSize: 14, fontWeight: '800', color: colors.text, textAlign: 'center' },
  verdictText: { fontSize: 14, lineHeight: 21, color: colors.text, textAlign: 'center' },
  verdictLaw: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: 'rgba(44, 37, 32, 0.06)',
    padding: 10,
    alignItems: 'center',
  },
  verdictLawText: { fontSize: 12, fontWeight: '800' },
  verdictNote: { fontSize: 12, color: colors.subtext, textAlign: 'center' },
  verdictBtn: {
    marginTop: 12,
    width: '100%',
    height: 54,
    borderRadius: 16,
    backgroundColor: brand.ink,
    borderBottomWidth: 5,
    borderBottomColor: brand.inkDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verdictBtnText: { fontSize: 15, fontWeight: '900', color: brand.goldLight },
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
    borderRadius: 18,
    borderBottomWidth: 5,
    borderBottomColor: brand.redDark,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '900', color: brand.creamText },
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
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: brand.ruleStrong,
    padding: 16,
  },
  optionSelected: { borderColor: brand.gold, backgroundColor: brand.goldSoft },
  optionRight: { borderColor: brand.pine, backgroundColor: brand.pineSoft },
  optionWrong: { borderColor: brand.red, backgroundColor: brand.redSoft },
  optionBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: brand.cream,
    borderWidth: 2,
    borderColor: brand.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionBadgeText: { fontSize: 15, fontWeight: '900', color: colors.text },
  optionText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.text, fontWeight: '700' },
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
