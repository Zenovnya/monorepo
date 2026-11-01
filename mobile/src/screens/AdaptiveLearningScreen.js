import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learningApi } from '../api/learning';
import { colors, elevation, radius, sizes, spacing, typography } from '../theme/tokens';

/** Adaptive session: сервер выбирает кейс и проверяет ответ. */
export default function AdaptiveLearningScreen({ navigation }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);

  // Показанные версии кейсов. Сервер ранжирует детерминированно, поэтому без
  // явного `exclude` он возвращал тот же кейс и пользователь зацикливался.
  const seenRef = useRef([]);

  const fetchNext = useCallback(() => learningApi.next([...seenRef.current]), []);

  const {
    data: item,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['learning-next', 'adaptive'],
    queryFn: fetchNext,
    // Каждый запрос должен идти на сервер: кейс зависит от истории ответов.
    staleTime: 0,
    gcTime: 0,
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['learning-progress'],
    queryFn: learningApi.progress,
  });

  // Запоминаем выданный кейс, чтобы исключить его в следующем запросе.
  useEffect(() => {
    const id = item?.case_version_id;
    if (id && !seenRef.current.includes(id)) {
      seenRef.current.push(id);
    }
  }, [item?.case_version_id]);

  const attempt = useMutation({
    mutationFn: learningApi.submitAttempt,
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
    },
  });

  const submit = () => {
    if (!selected || !item || attempt.isPending) return;
    attempt.mutate({
      case_version_id: item.case_version_id,
      step_id: item.step_id,
      answer_id: selected,
    });
  };

  const next = () => {
    setSelected(null);
    setResult(null);
    refetch();
  };

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
        <Text style={styles.stateTitle}>Не удалось загрузить следующий кейс</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => refetch()}>
          <Text style={styles.secondaryBtnText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>Все доступные кейсы пройдены</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryBtnText}>Вернуться</Text>
        </Pressable>
      </View>
    );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>АДАПТИВНАЯ СЕССИЯ</Text>
        <Text style={styles.title}>Разберём ситуацию</Text>
        <Pressable
          style={styles.progressLink}
          onPress={() => navigation.navigate('LearningProgress')}
          hitSlop={8}
        >
          <Text style={styles.progressLinkText}>Открыть полный прогресс →</Text>
        </Pressable>

        {progress.length > 0 ? (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Прогресс компетенций</Text>
            {progress.slice(0, 3).map((state) => {
              const percent = Math.round(state.mastery * 100);
              return (
                <View key={state.competency_id} style={styles.progressRow}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${percent}%` }]} />
                  </View>
                  <Text style={styles.progressValue}>{percent}%</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.situation}>{item.situation}</Text>
          <Text style={styles.prompt}>{item.prompt}</Text>
        </View>

        {item.answers.map((answer, index) => {
          const isSelected = selected === answer.id;
          return (
            <Pressable
              key={answer.id}
              disabled={Boolean(result)}
              onPress={() => setSelected(answer.id)}
              style={[styles.answer, isSelected && styles.answerSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled: Boolean(result) }}
            >
              <Text style={[styles.number, isSelected && styles.numberSelected]}>
                {String.fromCharCode(65 + index)}
              </Text>
              <Text style={styles.answerText}>{answer.text}</Text>
            </Pressable>
          );
        })}

        {result ? (
          <View style={[styles.result, result.correct ? styles.success : styles.failure]}>
            <Text style={styles.resultTitle}>{result.correct ? 'Верно' : 'Разберём ошибку'}</Text>
            {result.explanation ? (
              <Text style={styles.resultText}>{result.explanation}</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={!selected || Boolean(result) || attempt.isPending}
          onPress={submit}
          style={[styles.primaryBtn, (!selected || result) && styles.primaryBtnDisabled]}
        >
          <Text style={styles.primaryBtnText}>
            {attempt.isPending ? 'Проверяем…' : 'Проверить'}
          </Text>
        </Pressable>
        {result ? (
          <Pressable style={styles.secondaryBtn} onPress={next} disabled={isFetching}>
            <Text style={styles.secondaryBtnText}>
              {isFetching ? 'Загружаем…' : 'Следующий кейс'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

  }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.base, paddingBottom: 180 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.base,
    backgroundColor: colors.surface,
  },
  stateTitle: { ...typography.heading, color: colors.text, textAlign: 'center' },

  eyebrow: { ...typography.micro, color: colors.accent, textTransform: 'uppercase' },
  title: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  progressLink: { alignSelf: 'flex-start', marginTop: spacing.xs },
  progressLinkText: { ...typography.caption, color: colors.link },

  progressCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderSoft,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    ...elevation.card,
  },
  progressTitle: { ...typography.caption, color: colors.text, fontWeight: '900' },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  progressTrack: {
    height: 9,
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.success },
  progressValue: { ...typography.caption, color: colors.text, width: 40, textAlign: 'right' },

  card: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  situation: { ...typography.body, color: colors.text },
  prompt: { ...typography.heading, color: colors.text, marginTop: spacing.lg },

  answer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base - 1,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.sm + 2,
  },
  answerSelected: { borderColor: colors.accent, backgroundColor: colors.goldTint },
  number: { ...typography.bodyStrong, color: colors.text },
  numberSelected: { color: colors.accentPressed },
  answerText: { ...typography.body, color: colors.text, flex: 1, fontWeight: '700' },

  result: { borderWidth: 2, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  success: { borderColor: colors.success, backgroundColor: colors.successTint },
  failure: { borderColor: colors.error, backgroundColor: colors.errorTint },
  resultTitle: { ...typography.heading, color: colors.text },
  resultText: { ...typography.body, color: colors.text, marginTop: spacing.xs },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.base,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderTopColor: colors.borderSoft,
  },
  primaryBtn: {
    height: sizes.buttonHeight,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.press(colors.successDark),
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { ...typography.heading, color: colors.card },

  secondaryBtn: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    ...elevation.press(colors.borderSoft),
  },
  secondaryBtnText: { ...typography.bodyStrong, color: colors.text },
});

