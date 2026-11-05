import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learningApi } from '../api/learning';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { AnimatedButton } from '../components/AnimatedButton';
import { FadeInView } from '../components/motion/FadeInView';
import { AnimatedStep } from '../components/motion/AnimatedStep';
import { FeedbackCard } from '../components/FeedbackCard';
import { ErrorState, LoadingState } from '../components/StateViews';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { AnswerRow } from './assessment/AnswerRow';

/** Initial diagnostic flow. Its session id is attached to every answer. */
export default function AssessmentScreen({ navigation }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(null);
  const [item, setItem] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);

  const start = useQuery({
    queryKey: ['assessment-start'],
    queryFn: learningApi.startAssessment,
    enabled: !session,
  });
  const answer = useMutation({
    mutationFn: learningApi.submitAssessmentAnswer,
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
    },
  });
  const next = useMutation({
    mutationFn: learningApi.nextAssessment,
    onSuccess: (data) => {
      if (!data) {
        setCompleted(true);
      } else {
        setItem(data);
      }
      setSelected(null);
      setResult(null);
    },
  });

  const finish = useCallback(() => navigation.replace('AdaptiveLearning'), [navigation]);

  const data = session || start.data;

  if (start.isLoading) {
    return (
      <View style={styles.container}>
        <LoadingState label="Готовим вопросы…" />
      </View>
    );
  }

  if (start.error || !data?.case) {
    return (
      <View style={styles.container}>
        <ErrorState
          title="Не удалось начать диагностику"
          message="Проверь соединение и попробуй снова."
          onRetry={() => start.refetch()}
        />
      </View>
    );
  }

  const currentItem = item || data.case;

  const submit = () => {
    if (!selected || answer.isPending || result) return;
    setSession(data);
    answer.mutate({
      case_version_id: currentItem.case_version_id,
      step_id: currentItem.step_id,
      answer_id: selected,
      assessment_session_id: data.session_id,
    });
  };

  const continueAssessment = () => next.mutate(data.session_id);

  if (completed) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.completedContent}>
          <AnimatedMascot size={140} perfect />
          <FadeInView index={1}>
            <Text style={styles.completedTitle}>Диагностика завершена</Text>
          </FadeInView>
          <FadeInView index={2}>
            <Text style={styles.completedText}>Мы подобрали обучение по твоим ответам.</Text>
          </FadeInView>
          <View style={styles.completedButton}>
            <AnimatedButton title="Перейти к обучению" onPress={finish} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const answeredCorrectly = result ? Boolean(result.correct) : null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>НАЧАЛЬНАЯ ДИАГНОСТИКА</Text>
        <Text style={styles.title}>Проверим стартовые знания</Text>

        {/* Шаг меняется при переходе к следующему вопросу. */}
        <AnimatedStep step={currentItem.step_id ?? 0} direction="forward">
          <View style={styles.card}>
            <Text style={styles.situation}>{currentItem.situation}</Text>
            <Text style={styles.prompt}>{currentItem.prompt}</Text>
          </View>
        </AnimatedStep>

        <View style={styles.answers}>
          {currentItem.answers.map((option, index) => (
            <FadeInView key={option.id} index={index}>
              <AnswerRow
                index={index}
                text={option.text}
                selected={selected === option.id}
                disabled={Boolean(result)}
                status={
                  result && selected === option.id
                    ? (answeredCorrectly ? 'correct' : 'incorrect')
                    : 'idle'
                }
                onPress={() => setSelected(option.id)}
              />
            </FadeInView>
          ))}
        </View>

        {result ? (
          <FeedbackCard
            status={answeredCorrectly ? 'correct' : 'incorrect'}
            title={answeredCorrectly ? 'Верно!' : 'Пока нет — запомни разбор'}
            body={result.explanation}
            style={styles.feedback}
          />
        ) : null}

        {answer.error || next.error ? (
          <Text style={styles.inlineError}>
            Не удалось сохранить ответ. Проверь соединение и повтори.
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {result ? (
          <View style={styles.footerColumn}>
            <AnimatedButton
              title={next.isPending ? 'Загружаем…' : 'Следующий вопрос'}
              loading={next.isPending}
              onPress={continueAssessment}
            />
            <Text style={styles.footerLink} onPress={finish}>
              Перейти к обучению
            </Text>
          </View>
        ) : (
          <AnimatedButton
            title={answer.isPending ? 'Сохраняем…' : 'Ответить'}
            loading={answer.isPending}
            disabled={!selected}
            onPress={submit}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.base, paddingBottom: 140 },
  eyebrow: {
    ...typography.micro,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.base,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 3,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.md + 2,
  },
  situation: { ...typography.body, color: colors.text },
  prompt: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.lg,
  },
  answers: { marginTop: spacing.xs },
  feedback: { marginTop: spacing.sm },
  inlineError: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.md,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.base,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
    borderTopWidth: 3,
    borderTopColor: colors.border,
  },
  footerColumn: { gap: spacing.sm },
  footerLink: {
    ...typography.caption,
    color: colors.subtext,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  completedContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.base,
  },
  completedTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
  completedText: {
    ...typography.body,
    color: colors.subtext,
    textAlign: 'center',
    maxWidth: 300,
  },
  completedButton: { alignSelf: 'stretch', marginTop: spacing.lg },
});

