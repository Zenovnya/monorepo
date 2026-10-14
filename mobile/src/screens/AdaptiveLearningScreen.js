import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learningApi } from '../api/learning';
import { colors } from '../theme/colors';

/** Adaptive session: the server chooses the case and evaluates the answer. */
export default function AdaptiveLearningScreen({ navigation }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const { data: item, isLoading, error, refetch } = useQuery({
    queryKey: ['learning-next'],
    queryFn: learningApi.next,
  });
  const { data: progress = [] } = useQuery({
    queryKey: ['learning-progress'],
    queryFn: learningApi.progress,
  });
  const attempt = useMutation({
    mutationFn: learningApi.submitAttempt,
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['learning-progress'] });
    },
  });

  const submit = () => {
    if (!selected || !item || attempt.isPending) return;
    attempt.mutate({ case_version_id: item.case_version_id, step_id: item.step_id, answer_id: selected });
  };
  const next = () => {
    setSelected(null);
    setResult(null);
    refetch();
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>Не удалось загрузить следующий кейс</Text><Pressable style={styles.button} onPress={() => refetch()}><Text style={styles.buttonText}>Повторить</Text></Pressable></View>;
  if (!item) return <View style={styles.center}><Text style={styles.title}>Все доступные кейсы пройдены</Text><Pressable style={styles.button} onPress={() => navigation.goBack()}><Text style={styles.buttonText}>Вернуться</Text></Pressable></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>АДАПТИВНАЯ СЕССИЯ</Text>
        <Text style={styles.title}>Разберём ситуацию</Text>
        <Pressable style={styles.progressLink} onPress={() => navigation.navigate('LearningProgress')}><Text style={styles.progressLinkText}>Открыть полный прогресс →</Text></Pressable>
        {progress.length > 0 ? (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Прогресс компетенций</Text>
            {progress.slice(0, 3).map((state) => (
              <View key={state.competency_id} style={styles.progressRow}>
                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(state.mastery * 100)}%` }]} /></View>
                <Text style={styles.progressValue}>{Math.round(state.mastery * 100)}%</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.card}><Text style={styles.situation}>{item.situation}</Text><Text style={styles.prompt}>{item.prompt}</Text></View>
        {item.answers.map((answer, index) => (
          <Pressable key={answer.id} disabled={Boolean(result)} onPress={() => setSelected(answer.id)} style={[styles.answer, selected === answer.id && styles.selected]}>
            <Text style={styles.number}>{String.fromCharCode(65 + index)}</Text><Text style={styles.answerText}>{answer.text}</Text>
          </Pressable>
        ))}
        {result ? <View style={[styles.result, result.correct ? styles.success : styles.failure]}><Text style={styles.resultTitle}>{result.correct ? 'Верно' : 'Разберём ошибку'}</Text>{result.explanation ? <Text style={styles.resultText}>{result.explanation}</Text> : null}</View> : null}
      </ScrollView>
      <View style={styles.footer}><Pressable disabled={!selected || Boolean(result) || attempt.isPending} onPress={submit} style={[styles.button, (!selected || result) && styles.disabled]}><Text style={styles.buttonText}>{attempt.isPending ? 'Проверяем…' : 'Проверить'}</Text></Pressable>{result ? <Pressable onPress={next} style={styles.next}><Text style={styles.nextText}>Следующий кейс</Text></Pressable> : null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, paddingBottom: 150 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.background },
  eyebrow: { color: colors.accent, fontWeight: '900', fontSize: 12, letterSpacing: 1 }, title: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 8, marginBottom: 16 }, progressCard: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 3, borderRadius: 15, padding: 12, marginBottom: 14 }, progressTitle: { color: colors.text, fontWeight: '900', marginBottom: 8 }, progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }, progressTrack: { height: 9, flex: 1, borderRadius: 8, backgroundColor: colors.paper, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 8, backgroundColor: colors.success }, progressValue: { width: 40, color: colors.text, fontWeight: '800', textAlign: 'right' }, card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 3, borderRadius: 18, padding: 16, marginBottom: 14 }, situation: { color: colors.text, fontSize: 16, lineHeight: 23 }, prompt: { color: colors.text, fontWeight: '900', fontSize: 18, marginTop: 20 }, answer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 15, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 10 }, selected: { borderColor: colors.accent, backgroundColor: '#FFF7DE' }, number: { fontWeight: '900', color: colors.text }, answerText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' }, result: { borderWidth: 3, borderRadius: 15, padding: 14, marginTop: 8 }, success: { borderColor: colors.success, backgroundColor: '#EAF8EE' }, failure: { borderColor: colors.error, backgroundColor: '#FFF0F0' }, resultTitle: { color: colors.text, fontWeight: '900', fontSize: 17 }, resultText: { color: colors.text, marginTop: 6, lineHeight: 20 }, footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: colors.background, borderTopWidth: 3, borderTopColor: colors.border }, button: { backgroundColor: colors.success, borderColor: colors.border, borderWidth: 3, borderRadius: 15, padding: 16, alignItems: 'center' }, disabled: { opacity: 0.5 }, buttonText: { color: '#fff', fontWeight: '900', fontSize: 16 }, next: { alignItems: 'center', padding: 12 }, nextText: { color: colors.text, fontWeight: '900' }, error: { color: colors.error, fontWeight: '800', textAlign: 'center' },
});