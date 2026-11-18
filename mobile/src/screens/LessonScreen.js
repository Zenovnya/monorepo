import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lexbearApi } from '../api/lexbear';
import { gamificationApi } from '../api/gamification';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { LegalText } from '../components/LegalText';
import { useMascotToast } from '../components/MascotToast';
import {
  brand,
  serifFamily,
  KhokhlomaCorners,
  KhokhlomaMedallion,
  KhokhlomaDivider,
  RibbonBookmark,
  WaxSeal,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

function normalizeCorrect(correct) {
  if (Array.isArray(correct)) return correct;
  if (typeof correct === 'boolean') return [correct ? 0 : 1];
  if (typeof correct === 'number') return [correct];
  return [];
}

function hasSelection(q, selected, multi) {
  if (!q) return false;
  return Array.isArray(q.correct) ? multi.length > 0 : selected !== null;
}

/**
 * Экран урока LexBear:
 * во время теории и вопросов — чистый современный интерфейс с деликатными
 * деталями старинного документа (закладка-ляссе, §, синяя справка #7298BC);
 * на экране завершения — праздничная красно-золотая грамота в рамке хохломы.
 */
export default function LessonScreen({ route, navigation }) {
  const { lessonId } = route.params;
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState('theory'); // theory | practice | done
  const [tIdx, setTIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  // Стартовый запас жизней — реальный серверный (см. /gamification/me).
  // Раньше всегда было 3 локальных, не связанных с аккаунтом.
  const [lives, setLives] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const [multi, setMulti] = useState([]);
  const [checked, setChecked] = useState(null); // null | 'right' | 'wrong'
  const [shake, setShake] = useState(false);
  // Ответы по id вопроса. Сервер сам считает результат (доверять клиентскому
  // correct/total нельзя), поэтому шлём именно их, а не счёт.
  const answersRef = useRef({});

  const { data: lesson, isLoading, error } = useQuery({
    queryKey: ['lexbear-lesson', lessonId],
    queryFn: () => lexbearApi.getLesson(lessonId),
  });

  const { data: gamification } = useQuery({
    queryKey: ['gamification-me'],
    queryFn: gamificationApi.me,
  });

  // Пока серверные жизни не пришли, показываем 3 (исторический дефолт):
  // урок не должен блокироваться из-за задержки сети.
  const serverLives = gamification?.lives;
  const displayLives = lives ?? (serverLives > 0 ? serverLives : 3);
  // Стартовый запас на момент открытия урока — для оценки «без ошибок».
  const startedLivesRef = useRef(null);
  if (startedLivesRef.current === null && serverLives !== undefined) {
    startedLivesRef.current = displayLives;
  }
  const startedLives = startedLivesRef.current ?? 3;

  const toast = useMascotToast();

  const completeMutation = useMutation({
    mutationFn: ({ answers }) => lexbearApi.completeLesson(lessonId, { answers }),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['lexbear-learn']);
      queryClient.invalidateQueries(['progress-overview']);
      queryClient.invalidateQueries(['gamification-me']);
      // Цель дня на главной должна отрасти сразу после урока.
      queryClient.invalidateQueries(['gamification-daily-goal']);

      if (data?.level_up) {
        toast.show({
          kind: 'level_up',
          title: `Уровень ${data.level}`,
          text: 'Ты растёшь. Погнали дальше.',
        });
      }
      if (data?.streak_incremented && data?.streak) {
        toast.show({
          kind: 'streak_celebrate',
          title: `Стрик ${data.streak} 🔥`,
          text: 'Занимаешься каждый день — так держать.',
        });
      }
      for (const ach of data?.achievements_unlocked ?? []) {
        toast.show({
          kind: 'achievement',
          title: `🏅 ${ach.title}`,
          text: ach.description || 'Новое достижение получено.',
        });
      }
    },
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <AnimatedMascot size={110} emotion="thinking" />
        <ActivityIndicator size="small" color={brand.red} />
        <Text style={styles.loadingHint}>Готовим материалы урока…</Text>
      </View>
    );
  }

  if (error || !lesson) {
    return (
      <View style={styles.center}>
        <View style={styles.errorCard}>
          <WaxSeal label="§" tone="red" size={48} />
          <Text style={styles.errorText}>Не удалось загрузить урок</Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.errorBackBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.errorBackText}>Назад</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const cards = lesson.cards ?? [];
  const questions = lesson.questions ?? [];

  const effectivePhase =
    phase === 'theory' && cards.length === 0 ? 'practice' : phase;
  const totalSteps = cards.length + questions.length;

  const nextTheory = () => {
    if (tIdx + 1 < cards.length) setTIdx(tIdx + 1);
    else setPhase('practice');
  };

  const check = () => {
    const q = questions[qIdx];
    if (!q) return;
    const rightAnswers = normalizeCorrect(q.correct);
    const isMulti = Array.isArray(q.correct);

    let isRight;
    if (isMulti) {
      const sortedUser = [...multi].sort();
      const sortedRight = [...rightAnswers].sort();
      isRight =
        sortedUser.length === sortedRight.length &&
        sortedUser.every((v, i) => v === sortedRight[i]);
    } else {
      isRight = selected === rightAnswers[0];
    }

    // Запоминаем ответ для отправки на сервер: id вопроса -> выбранные индексы.
    if (q?.id !== undefined && q?.id !== null) {
      answersRef.current[q.id] = isMulti ? [...multi].sort() : selected;
    }

    setChecked(isRight ? 'right' : 'wrong');
    if (isRight) setCorrectCount((c) => c + 1);
    else {
      setShake(true);
      setLives((l) => Math.max(0, l - 1));
      setTimeout(() => setShake(false), 400);
    }
  };

  const nextQuestion = () => {
    setChecked(null);
    setSelected(null);
    setMulti([]);
    if (qIdx + 1 < questions.length && displayLives > 0) {
      setQIdx(qIdx + 1);
    } else {
      completeMutation.mutate({ answers: answersRef.current });
      setPhase('done');
    }
  };

  /* ==== ЭКРАН ЗАВЕРШЕНИЯ ОБУЧЕНИЯ — ПРАЗДНИЧНАЯ ГРАМОТА ХОХЛОМЫ ==== */
  if (effectivePhase === 'done') {
    // Сервер — источник истины: он посчитал правильные по присланным answers.
    const serverResult = completeMutation.data;
    const accuracy = serverResult?.total
      ? Math.round((serverResult.correct / serverResult.total) * 100)
      : questions.length > 0
      ? Math.round((correctCount / questions.length) * 100)
      : 0;
    const gemsGain = serverResult?.gems_gain ?? 0;

    const isPerfect =
      accuracy === 100 && displayLives === startedLives && questions.length > 0;
    const isGreat = !isPerfect && accuracy >= 80;
    const isPassed = !isPerfect && !isGreat && accuracy >= 60;
    const isFailed = !isPerfect && !isGreat && !isPassed;

    const titleText = isPerfect
      ? 'Блестящий результат!'
      : isGreat
      ? 'Отличный урок!'
      : isPassed
      ? 'Урок освоен!'
      : 'Ещё раз попробуем?';

    return (
      <View style={styles.resultScreen}>
        <PaperGrain />
        <View style={styles.resultBody}>
          <View
            style={[
              styles.diplomaCard,
              isFailed && styles.diplomaCardMuted,
            ]}
          >
            {!isFailed ? (
              <KhokhlomaCorners variant="light" size="md" inset={9} />
            ) : null}

            <Text style={styles.diplomaKicker}>
              {isFailed ? '§ ПОВТОРЕНИЕ НОРМЫ' : '§ УРОК ЗАВЕРШЁН · НАГРАДА'}
            </Text>

            <KhokhlomaMedallion
              size={182}
              muted={isFailed}
              style={styles.diplomaMedallion}
            >
              <AnimatedMascot
                size={156}
                perfect={isPerfect}
                celebrate={isGreat}
                emotion={isPassed ? 'happy' : isFailed ? 'sad' : undefined}
              />
            </KhokhlomaMedallion>

            <Text
              style={[
                styles.resultTitle,
                isFailed && styles.resultTitleFailed,
              ]}
            >
              {titleText}
            </Text>
            <Text style={styles.resultSubtitle}>
              {isFailed
                ? 'Ничего страшного — освежим теорию и закрепим статью.'
                : 'Знание закона — твоя надёжная опора.'}
            </Text>

            <KhokhlomaDivider style={styles.resultDivider} />

            {/* Рамки итогов: золотая точность/награда и лаковые жизни */}
            <View style={styles.resultStats}>
              <StatCard
                label="Точность"
                value={`${accuracy}%`}
                frameColor={isFailed ? brand.ruleStrong : brand.gold}
                textColor={isFailed ? colors.subtext : brand.goldInk}
              />
              <StatCard
                label="Жизни"
                value={`❤️ ${displayLives}`}
                frameColor={brand.red}
                textColor={brand.red}
              />
              {gemsGain > 0 ? (
                <StatCard
                  label="Гемы"
                  value={`💎 +${gemsGain}`}
                  frameColor={brand.pine ?? brand.gold}
                  textColor={brand.pineDark ?? brand.goldInk}
                />
              ) : null}
            </View>

            {completeMutation.isError ? (
              <Text style={styles.serverError}>
                Результат не сохранён: проверьте соединение и откройте урок снова.
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.btnRed,
              pressed && styles.btnPressed,
            ]}
            onPress={() => navigation.popToTop()}
          >
            <Text style={styles.btnText}>На путь</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ==== ОСНОВНОЙ ЭКРАН УРОКА ==== */
  const progressPct =
    totalSteps > 0
      ? Math.min(
          100,
          ((effectivePhase === 'theory'
            ? tIdx + 0.5
            : cards.length + qIdx + (checked ? 1 : 0.4)) /
            totalSteps) *
            100
        )
      : 0;
  const canCheck = hasSelection(questions[qIdx], selected, multi);

  return (
    <View style={styles.container}>
      <PaperGrain />

      {/* Чистая шапка урока: закрытие + золотая шкала прогресса + жизни */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
          style={styles.closeBtn}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(progressPct, 10)}%` },
            ]}
          >
            <View style={styles.progressShine} />
          </View>
        </View>

        <View style={styles.livesWrap}>
          <Text style={styles.livesHeart}>❤️</Text>
          <Text style={styles.livesCount}>{displayLives}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          checked && styles.contentWithSheet,
        ]}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {effectivePhase === 'theory' && cards[tIdx] && (
          <TheoryView card={cards[tIdx]} step={tIdx + 1} total={cards.length} />
        )}

        {effectivePhase === 'practice' && questions[qIdx] && (
          <QuestionView
            q={questions[qIdx]}
            selected={selected}
            multi={multi}
            checked={checked}
            shake={shake}
            onSelectSingle={(i) => !checked && setSelected(i)}
            onToggleMulti={(i) => {
              if (checked) return;
              setMulti((prev) =>
                prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
              );
            }}
          />
        )}
      </ScrollView>

      {/* Нижняя шторка проверки (хвойный #315B46 для верного, лаковый #C9362B для ошибки) */}
      {effectivePhase === 'practice' && checked ? (
        <View
          style={[
            styles.feedbackSheet,
            checked === 'right'
              ? styles.feedbackSheetRight
              : styles.feedbackSheetWrong,
          ]}
        >
          <View style={styles.feedbackTopRow}>
            <WaxSeal
              label={checked === 'right' ? '✓' : '✕'}
              size={36}
              tone={checked === 'right' ? 'pine' : 'red'}
            />
            <Text
              style={[
                styles.feedbackTitle,
                {
                  color: checked === 'right' ? brand.pineDark : brand.redDark,
                },
              ]}
            >
              {checked === 'right' ? 'Верно!' : 'Разберём ошибку'}
            </Text>
            <AnimatedMascot
              size={60}
              celebrate={checked === 'right'}
              error={checked === 'wrong'}
              emotion={checked === 'right' ? 'happy' : 'sad'}
            />
          </View>

          {questions[qIdx]?.explanation ? (
            <LegalText style={styles.feedbackText}>
              {questions[qIdx]?.explanation}
            </LegalText>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.btn,
              checked === 'right' ? styles.btnPine : styles.btnRed,
              pressed && styles.btnPressed,
            ]}
            onPress={nextQuestion}
          >
            <Text style={styles.btnText}>Продолжить</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.footer}>
          {effectivePhase === 'theory' && (
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnRed,
                pressed && styles.btnPressed,
              ]}
              onPress={nextTheory}
            >
              <Text style={styles.btnText}>Дальше</Text>
            </Pressable>
          )}

          {effectivePhase === 'practice' && (
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                canCheck ? styles.btnRed : styles.btnDisabled,
                pressed && canCheck && styles.btnPressed,
              ]}
              disabled={!canCheck}
              onPress={check}
            >
              <Text
                style={[styles.btnText, !canCheck && styles.btnTextDisabled]}
              >
                Проверить
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function TheoryView({ card, step, total }) {
  const chips = Array.isArray(card.chips) ? card.chips : [];

  return (
    <View style={styles.theory}>
      <View style={styles.newTagRow}>
        <Text style={styles.paraSign}>§</Text>
        <Text style={styles.theoryMeta}>
          ТЕОРИЯ · ЛИСТ {step} ИЗ {total}
        </Text>
      </View>

      <Text style={styles.theoryTitle}>{card.title}</Text>

      {/* Мишка-юрист с репликой */}
      {card.bear_line ? (
        <View style={styles.bearLine}>
          <AnimatedMascot
            size={88}
            emotion={card.practical || step > 1 ? 'strict' : 'neutral'}
            wave={!card.practical && step === 1}
            talking
          />
          <View style={styles.bubbleOuter}>
            <View style={styles.bubbleTail} />
            <View style={styles.bubble}>
              <LegalText style={styles.bubbleText}>{card.bear_line}</LegalText>
            </View>
          </View>
        </View>
      ) : null}

      {/* Лист нормы права со шёлковой закладкой кодекса */}
      <View style={styles.card}>
        <RibbonBookmark
          color={brand.red}
          symbol="§"
          right={16}
          height={28}
          width={20}
          cutoutColor={colors.card}
        />
        <Text style={styles.statuteEyebrow}>НОРМА ПРАВА</Text>
        <LegalText style={styles.cardText}>{card.definition}</LegalText>
      </View>

      {/* Информационная памятка «На практике» — приглушённый синий (#7298BC) */}
      {card.practical ? (
        <View style={styles.practicalCard}>
          <Text style={styles.practicalLabel}>ℹ️ НА ПРАКТИКЕ · ПАМЯТКА</Text>
          <LegalText style={styles.practicalText}>{card.practical}</LegalText>
        </View>
      ) : null}

      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const kindLabels = {
  case: 'Кейс',
  choice: 'Выбор',
  truefalse: 'Верно / неверно',
  action: 'Что делать?',
  fine: 'Наказание',
  match: 'Сопоставить',
};

function QuestionView({
  q,
  selected,
  multi,
  checked,
  shake,
  onSelectSingle,
  onToggleMulti,
}) {
  const isMulti = Array.isArray(q.correct);
  const rightList = normalizeCorrect(q.correct);

  return (
    <View style={[styles.question, shake && styles.shake]}>
      <View style={styles.newTagRow}>
        <Text style={styles.paraSign}>§</Text>
        <Text style={styles.questionKind}>
          {kindLabels[q.kind] || q.kind}
        </Text>
      </View>

      <Text style={styles.questionPrompt}>{q.prompt}</Text>

      {isMulti && (
        <View style={styles.multiHintBox}>
          <Text style={styles.multiHint}>
            Выберите все подходящие варианты
          </Text>
        </View>
      )}

      {q.case_text ? (
        <View style={styles.scenarioCard}>
          <Text style={styles.cardText}>{q.case_text}</Text>
        </View>
      ) : null}

      <View style={styles.options}>
        {(q.options || []).map((opt, i) => {
          const isSel = isMulti ? multi.includes(i) : selected === i;
          const isCorrect = Boolean(checked) && rightList.includes(i);
          const isWrongPick = checked === 'wrong' && isSel && !isCorrect;

          return (
            <Pressable
              key={String(i)}
              disabled={Boolean(checked)}
              onPress={() => (isMulti ? onToggleMulti(i) : onSelectSingle(i))}
              style={({ pressed }) => [
                styles.option,
                isSel && !checked && styles.optionSelected,
                isCorrect && styles.optionCorrect,
                isWrongPick && styles.optionWrong,
                pressed && !checked && styles.optionPressed,
              ]}
            >
              <View
                style={[
                  styles.optionLetter,
                  isSel && !checked && styles.optionLetterSelected,
                  isCorrect && styles.optionLetterCorrect,
                  isWrongPick && styles.optionLetterWrong,
                ]}
              >
                <Text
                  style={[
                    styles.optionLetterText,
                    isSel && !checked && styles.optionLetterTextSelected,
                    (isCorrect || isWrongPick) &&
                      styles.optionLetterTextWhite,
                  ]}
                >
                  {isCorrect
                    ? '✓'
                    : isWrongPick
                    ? '✕'
                    : isMulti
                    ? isSel
                      ? '✓'
                      : ''
                    : String.fromCharCode(65 + i)}
                </Text>
              </View>
              <Text
                style={[
                  styles.optionText,
                  isSel && !checked && styles.optionTextSelected,
                  isCorrect && styles.optionTextCorrect,
                  isWrongPick && styles.optionTextWrong,
                ]}
              >
                {opt?.text ?? opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function StatCard({ label, value, frameColor, textColor }) {
  return (
    <View style={[styles.statOuter, { backgroundColor: frameColor }]}>
      <Text
        style={[
          styles.statLabel,
          frameColor === brand.gold && { color: brand.ink },
        ]}
      >
        {label}
      </Text>
      <View style={styles.statInner}>
        <Text style={[styles.statValue, { color: textColor }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  serverError: {
    marginTop: 12,
    color: brand.red,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 17,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: colors.background,
  },
  loadingHint: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subtext,
  },
  errorCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: brand.rule,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  errorBackBtn: {
    marginTop: 6,
    height: 46,
    paddingHorizontal: 26,
    borderRadius: 14,
    backgroundColor: brand.red,
    borderBottomWidth: 4,
    borderBottomColor: brand.redDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBackText: {
    color: brand.creamText,
    fontWeight: '800',
    fontSize: 13.5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  /* Шапка урока */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '700',
    color: brand.muted,
  },
  progressTrack: {
    flex: 1,
    height: 12,
    borderRadius: 999,
    backgroundColor: brand.rule,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: brand.gold,
  },
  progressShine: {
    height: 3.5,
    marginHorizontal: 5,
    marginTop: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(252, 248, 240, 0.5)',
  },
  livesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  livesHeart: {
    fontSize: 16,
  },
  livesCount: {
    fontSize: 15,
    fontWeight: '800',
    color: brand.red,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 28,
  },
  contentWithSheet: {
    paddingBottom: 210,
  },

  /* Теория */
  theory: {
    gap: 14,
  },
  newTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paraSign: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: serifFamily,
    color: brand.red,
  },
  theoryMeta: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: brand.goldInk,
  },
  theoryTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 28,
    letterSpacing: -0.3,
  },

  bearLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bubbleOuter: {
    flex: 1,
    position: 'relative',
  },
  bubbleTail: {
    position: 'absolute',
    left: -6,
    top: 18,
    width: 12,
    height: 12,
    backgroundColor: colors.card,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: brand.rule,
    transform: [{ rotate: '45deg' }],
    zIndex: 2,
  },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.rule,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bubbleText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 19.5,
  },

  card: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    padding: 16,
    gap: 7,
  },
  statuteEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: brand.muted,
    paddingRight: 26,
  },
  cardText: {
    fontSize: 14.5,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 21.5,
  },

  /* Памятка в приглушённом синем (#7298BC — только информация) */
  practicalCard: {
    backgroundColor: brand.infoSoft,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: brand.infoBorder,
    borderLeftWidth: 4,
    borderLeftColor: brand.info,
    padding: 14,
    gap: 6,
  },
  practicalLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: brand.infoInk,
  },
  practicalText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 19.5,
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: brand.rule,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.subtext,
  },

  /* Практика */
  question: {
    gap: 14,
  },
  shake: {
    transform: [{ translateX: -5 }],
  },
  questionKind: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: brand.red,
  },
  questionPrompt: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  multiHintBox: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: brand.infoSoft,
  },
  multiHint: {
    fontSize: 12,
    fontWeight: '700',
    color: brand.infoInk,
  },
  scenarioCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: brand.rule,
    padding: 14,
  },
  options: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  optionSelected: {
    backgroundColor: brand.goldSoft,
    borderColor: brand.gold,
  },
  optionCorrect: {
    backgroundColor: brand.pineSoft,
    borderColor: brand.pine,
  },
  optionWrong: {
    backgroundColor: brand.redSoft,
    borderColor: brand.red,
  },
  optionPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 1.5,
  },
  optionLetter: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1.2,
    borderColor: brand.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterSelected: {
    backgroundColor: brand.gold,
    borderColor: brand.goldDark,
  },
  optionLetterCorrect: {
    backgroundColor: brand.pine,
    borderColor: brand.pineDark,
  },
  optionLetterWrong: {
    backgroundColor: brand.red,
    borderColor: brand.redDark,
  },
  optionLetterText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.subtext,
  },
  optionLetterTextSelected: {
    color: brand.ink,
  },
  optionLetterTextWhite: {
    color: brand.creamText,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 19.5,
  },
  optionTextSelected: {
    fontWeight: '700',
    color: brand.ink,
  },
  optionTextCorrect: {
    fontWeight: '700',
    color: brand.pineDark,
  },
  optionTextWrong: {
    fontWeight: '700',
    color: brand.redDark,
  },

  /* Шторка ответа и нижняя кнопка */
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: brand.rule,
  },
  feedbackSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 2,
    gap: 10,
  },
  feedbackSheetRight: {
    backgroundColor: brand.pineSoft,
    borderTopColor: brand.pine,
  },
  feedbackSheetWrong: {
    backgroundColor: brand.redSoft,
    borderTopColor: brand.red,
  },
  feedbackTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedbackTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  feedbackText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 19.5,
  },

  btn: {
    height: 52,
    borderRadius: 16,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRed: {
    backgroundColor: brand.red,
    borderBottomColor: brand.redDark,
  },
  btnPine: {
    backgroundColor: brand.pine,
    borderBottomColor: brand.pineDark,
  },
  btnDisabled: {
    backgroundColor: brand.rule,
    borderBottomWidth: 0,
  },
  btnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  btnText: {
    color: brand.creamText,
    fontSize: 14.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  btnTextDisabled: {
    color: colors.locked,
  },

  /* Финал обучения — грамота с рамкой хохломы */
  resultScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  resultBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  diplomaCard: {
    position: 'relative',
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: brand.gold,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  diplomaCardMuted: {
    borderColor: brand.rule,
  },
  diplomaKicker: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: brand.goldInk,
    marginBottom: 14,
  },
  diplomaMedallion: {
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: brand.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  resultTitleFailed: {
    color: brand.subtext,
  },
  resultSubtitle: {
    marginTop: 5,
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 19,
  },
  resultDivider: {
    marginVertical: 16,
  },
  resultStats: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  statOuter: {
    flex: 1,
    borderRadius: 16,
    padding: 3,
    paddingTop: 6,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: brand.creamText,
    marginBottom: 5,
  },
  statInner: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 13,
    paddingVertical: 11,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
});
