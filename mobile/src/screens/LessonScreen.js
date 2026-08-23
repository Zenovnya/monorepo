import React, { useState } from 'react';
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
import { AnimatedMascot } from '../components/AnimatedMascot';
import { colors } from '../theme/colors';

/**
 * Экран урока LexBear: теория → практика → результат.
 */
export default function LessonScreen({ route, navigation }) {
  const { lessonId } = route.params;
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState('theory'); // theory | practice | done
  const [tIdx, setTIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [correctCount, setCorrectCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(null);
  const [shake, setShake] = useState(false);

  const { data: lesson, isLoading, error } = useQuery({
    queryKey: ['lexbear-lesson', lessonId],
    queryFn: () => lexbearApi.getLesson(lessonId),
  });

  // Завершение урока через lexbear-эндпоинт (XP, короны, стрик).
  const completeMutation = useMutation({
    mutationFn: ({ correct, total }) =>
      lexbearApi.completeLesson(lessonId, { correct, total }),
    onSuccess: () => {
      queryClient.invalidateQueries(['lexbear-learn']);
      queryClient.invalidateQueries(['progress-overview']);
      queryClient.invalidateQueries(['gamification-me']);
    },
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error || !lesson) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Не удалось загрузить урок</Text>
      </View>
    );
  }

  const cards = lesson.cards ?? [];
  const questions = lesson.questions ?? [];

  // Если теории нет — начинаем сразу с практики.
  const effectivePhase = phase === 'theory' && cards.length === 0 ? 'practice' : phase;
  const totalSteps = cards.length + questions.length;

  const nextTheory = () => {
    if (tIdx + 1 < cards.length) setTIdx(tIdx + 1);
    else setPhase('practice');
  };

  const check = () => {
    if (selected === null) return;
    const right = selected === questions[qIdx]?.correct;
    setChecked(right ? 'right' : 'wrong');
    if (right) setCorrectCount((c) => c + 1);
    else {
      setShake(true);
      setLives((l) => Math.max(0, l - 1));
      setTimeout(() => setShake(false), 400);
    }
  };

  const nextQuestion = () => {
    setChecked(null);
    setSelected(null);
    if (qIdx + 1 < questions.length && lives > 0) {
      setQIdx(qIdx + 1);
    } else {
      // Завершение урока.
      completeMutation.mutate({
        correct: correctCount,
        total: questions.length,
      });
      setPhase('done');
    }
  };

  // ==== Результат ====
  if (effectivePhase === 'done') {
    const accuracy = questions.length > 0
      ? Math.round((correctCount / questions.length) * 100)
      : 0;
    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultTitle}>Урок пройден!</Text>
        <Text style={styles.resultSubtitle}>Ты становишься сильнее ⚖️</Text>
        <AnimatedMascot size={180} emotion={accuracy >= 60 ? 'cheer' : 'sad'} />
        <View style={styles.resultStats}>
          <StatCard label="Точность" value={`${accuracy}%`} color={colors.skyDark} />
          <StatCard label="Стрик" value={`🔥 ${lives}`} color={colors.error} />
        </View>
        <Pressable
          style={[styles.btn, { marginTop: 24, alignSelf: 'stretch' }]}
          onPress={() => navigation.popToTop()}
        >
          <Text style={styles.btnText}>На путь</Text>
        </Pressable>
      </View>
    );
  }

  // ==== Основной рендер ====
  const progressPct = totalSteps > 0
    ? Math.min(100, ((effectivePhase === 'theory' ? tIdx : cards.length + qIdx) / totalSteps) * 100)
    : 0;

  return (
    <View style={styles.container}>
      {/* Шапка: назад + прогресс + жизни */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <View style={styles.livesChip}>
          <Text style={styles.livesText}>❤️ {lives}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} style={{ flex: 1 }}>
        {effectivePhase === 'theory' && cards[tIdx] && (
          <TheoryView card={cards[tIdx]} step={tIdx + 1} total={cards.length} />
        )}
        {effectivePhase === 'practice' && questions[qIdx] && (
          <QuestionView
            q={questions[qIdx]}
            selected={selected}
            setSelected={(i) => !checked && setSelected(i)}
            checked={checked}
            shake={shake}
          />
        )}

        {effectivePhase === 'practice' && checked && (
          <View style={[styles.feedback, { backgroundColor: checked === 'right' ? '#DFF5E5' : '#FDE0DC' }]}>
            <AnimatedMascot size={60} emotion={checked === 'right' ? 'cheer' : 'sad'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.feedbackTitle}>{checked === 'right' ? 'Верно!' : 'Не то'}</Text>
              <Text style={styles.feedbackText}>{questions[qIdx]?.explanation}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Кнопки */}
      <View style={styles.footer}>
        {effectivePhase === 'theory' && (
          <Pressable style={styles.btn} onPress={nextTheory}>
            <Text style={styles.btnText}>Дальше</Text>
          </Pressable>
        )}
        {effectivePhase === 'practice' && !checked && (
          <Pressable
            style={[styles.btn, { opacity: selected === null ? 0.55 : 1 }]}
            disabled={selected === null}
            onPress={check}
          >
            <Text style={styles.btnText}>Проверить</Text>
          </Pressable>
        )}
        {effectivePhase === 'practice' && checked && (
          <Pressable
            style={[styles.btn, checked === 'right' ? styles.btnGreen : styles.btnRed]}
            onPress={nextQuestion}
          >
            <Text style={styles.btnText}>Продолжить</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function TheoryView({ card, step, total }) {
  return (
    <View style={styles.theory}>
      <Text style={styles.theoryMeta}>Теория · {step}/{total}</Text>
      <Text style={styles.theoryTitle}>{card.title}</Text>
      <View style={styles.card}>
        <Text style={styles.cardText}>{card.definition}</Text>
      </View>
      <View style={[styles.card, styles.practicalCard]}>
        <Text style={styles.practicalLabel}>НА ПРАКТИКЕ</Text>
        <Text style={styles.cardText}>{card.practical}</Text>
      </View>
      <View style={styles.chips}>
        {(card.chips || []).map((chip) => (
          <View key={chip} style={styles.chip}>
            <Text style={styles.chipText}>{chip}</Text>
          </View>
        ))}
      </View>
      {card.bear_line ? (
        <View style={styles.bearLine}>
          <AnimatedMascot size={80} emotion="think" />
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{card.bear_line}</Text>
          </View>
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

function QuestionView({ q, selected, setSelected, checked, shake }) {
  return (
    <View style={[styles.question, shake && styles.shake]}>
      <Text style={styles.questionKind}>{kindLabels[q.kind] || q.kind}</Text>
      <Text style={styles.questionPrompt}>{q.prompt}</Text>
      {q.case_text ? (
        <View style={styles.card}>
          <Text style={styles.cardText}>{q.case_text}</Text>
        </View>
      ) : null}
      <View style={styles.options}>
        {(q.options || []).map((opt, i) => {
          const isSel = selected === i;
          const isCorrect = checked && i === q.correct;
          const isWrongPick = checked === 'wrong' && isSel;
          return (
            <Pressable
              key={String(i)}
              onPress={() => setSelected(i)}
              style={[
                styles.option,
                isCorrect && { backgroundColor: '#DFF5E5', borderColor: colors.success },
                isWrongPick && { backgroundColor: '#FDE0DC', borderColor: colors.error },
                isSel && !checked && { backgroundColor: '#FFF7DE', borderColor: colors.accent },
              ]}
            >
              <View style={styles.optionLetter}>
                <Text style={styles.optionLetterText}>{String.fromCharCode(65 + i)}</Text>
              </View>
              <Text style={styles.optionText}>{opt?.text ?? opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 15, fontWeight: '700', color: colors.error },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 16, fontWeight: '900', color: colors.text },
  progressTrack: { flex: 1, height: 16, backgroundColor: colors.track, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: colors.border },
  progressFill: { height: '100%', backgroundColor: colors.success },
  livesChip: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#FDE3DF', borderWidth: 2, borderColor: colors.border },
  livesText: { fontSize: 13, fontWeight: '800', color: colors.text },
  content: { padding: 20, paddingBottom: 140 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: colors.background, borderTopWidth: 3, borderTopColor: colors.border },
  btn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGreen: { backgroundColor: colors.success },
  btnRed: { backgroundColor: colors.error },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  theory: { gap: 16 },
  theoryMeta: { fontSize: 12, fontWeight: '700', color: colors.subtext },
  theoryTitle: { fontSize: 26, fontWeight: '900', color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
  },
  practicalCard: { backgroundColor: '#FFF7DE' },
  practicalLabel: { fontSize: 11, fontWeight: '900', color: colors.subtext, marginBottom: 6 },
  cardText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  bearLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  bubble: { flex: 1, backgroundColor: colors.card, borderWidth: 3, borderColor: colors.border, borderRadius: 20, padding: 12 },
  bubbleText: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
  question: { gap: 16 },
  questionKind: { fontSize: 12, fontWeight: '800', color: colors.subtext, textTransform: 'uppercase' },
  questionPrompt: { fontSize: 22, fontWeight: '900', color: colors.text },
  options: { gap: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  optionLetter: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontSize: 13, fontWeight: '700', color: colors.text },
  optionText: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  feedback: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, padding: 16, borderWidth: 3, borderColor: colors.border },
  feedbackTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  feedbackText: { fontSize: 14, color: colors.text, marginTop: 4, lineHeight: 20 },
  shake: { transform: [{ translateX: -6 }] },
  resultContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  resultTitle: { fontSize: 28, fontWeight: '900', color: colors.accent },
  resultSubtitle: { fontSize: 15, color: colors.subtext, marginTop: 8 },
  resultStats: { flexDirection: 'row', gap: 12, marginTop: 20 },
  statCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 3, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 12, color: colors.subtext, marginTop: 4 },
});