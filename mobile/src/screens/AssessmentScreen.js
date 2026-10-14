import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learningApi } from '../api/learning';
import { colors } from '../theme/colors';

/** Initial diagnostic flow. Its session id is attached to every answer. */
export default function AssessmentScreen({ navigation }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(null);
  const [item, setItem] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const start = useQuery({ queryKey: ['assessment-start'], queryFn: learningApi.startAssessment, enabled: !session });
  const answer = useMutation({
    mutationFn: learningApi.submitAssessmentAnswer,
    onSuccess: (data) => { setResult(data); queryClient.invalidateQueries({ queryKey: ['learning-progress'] }); },
  });
  const next = useMutation({
    mutationFn: learningApi.nextAssessment,
    onSuccess: (data) => { if (!data) setCompleted(true); else setItem(data); setSelected(null); setResult(null); },
  });
  const data = session || start.data;
  if (start.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  if (start.error || !data?.case) return <View style={styles.center}><Text style={styles.error}>Не удалось начать диагностику</Text><Pressable style={styles.button} onPress={() => start.refetch()}><Text style={styles.buttonText}>Повторить</Text></Pressable></View>;
  const currentItem = item || data.case;
  const submit = () => {
    if (!selected || answer.isPending || result) return;
    setSession(data);
    answer.mutate({ case_version_id: currentItem.case_version_id, step_id: currentItem.step_id, answer_id: selected, assessment_session_id: data.session_id });
  };
  const finish = () => navigation.replace('AdaptiveLearning');
  const continueAssessment = () => next.mutate(data.session_id);
  if (completed) return <View style={styles.center}><Text style={styles.title}>Диагностика завершена</Text><Text style={styles.resultText}>Мы подобрали обучение по твоим ответам.</Text><Pressable style={styles.button} onPress={finish}><Text style={styles.buttonText}>Перейти к обучению</Text></Pressable></View>;
  return <View style={styles.container}><ScrollView contentContainerStyle={styles.content}><Text style={styles.eyebrow}>НАЧАЛЬНАЯ ДИАГНОСТИКА</Text><Text style={styles.title}>Проверим стартовые знания</Text><View style={styles.card}><Text style={styles.situation}>{currentItem.situation}</Text><Text style={styles.prompt}>{currentItem.prompt}</Text></View>{currentItem.answers.map((option, index) => <Pressable key={option.id} disabled={Boolean(result)} onPress={() => setSelected(option.id)} style={[styles.answer, selected === option.id && styles.selected]}><Text style={styles.number}>{String.fromCharCode(65 + index)}</Text><Text style={styles.answerText}>{option.text}</Text></Pressable>)}{answer.error || next.error ? <Text style={styles.error}>Не удалось сохранить ответ. Проверь соединение и повтори.</Text> : null}{result ? <View style={[styles.result, result.correct ? styles.success : styles.failure]}><Text style={styles.resultTitle}>{result.correct ? 'Ответ записан' : 'Ответ записан, разберём пробелы'}</Text>{result.explanation ? <Text style={styles.resultText}>{result.explanation}</Text> : null}</View> : null}</ScrollView><View style={styles.footer}>{result ? <><Pressable style={styles.button} disabled={next.isPending} onPress={continueAssessment}><Text style={styles.buttonText}>{next.isPending ? 'Загружаем…' : 'Следующий вопрос'}</Text></Pressable><Pressable style={styles.secondaryButton} onPress={finish}><Text style={styles.secondaryButtonText}>Перейти к обучению</Text></Pressable></> : <Pressable disabled={!selected || answer.isPending} style={[styles.button, !selected && styles.disabled]} onPress={submit}><Text style={styles.buttonText}>{answer.isPending ? 'Сохраняем…' : 'Ответить'}</Text></Pressable>}</View></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, content: { padding: 16, paddingBottom: 130 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.background }, eyebrow: { color: colors.accent, fontWeight: '900', fontSize: 12, letterSpacing: 1 }, title: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 8, marginBottom: 16 }, card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 3, borderRadius: 18, padding: 16, marginBottom: 14 }, situation: { color: colors.text, fontSize: 16, lineHeight: 23 }, prompt: { color: colors.text, fontWeight: '900', fontSize: 18, marginTop: 20 }, answer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 15, borderWidth: 3, borderColor: colors.border, backgroundColor: colors.card, marginBottom: 10 }, selected: { borderColor: colors.accent, backgroundColor: '#FFF7DE' }, number: { fontWeight: '900', color: colors.text }, answerText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' }, result: { borderWidth: 3, borderRadius: 15, padding: 14, marginTop: 8 }, success: { borderColor: colors.success, backgroundColor: '#EAF8EE' }, failure: { borderColor: colors.error, backgroundColor: '#FFF0F0' }, resultTitle: { color: colors.text, fontWeight: '900', fontSize: 17 }, resultText: { color: colors.text, marginTop: 6, lineHeight: 20 }, footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: colors.background, borderTopWidth: 3, borderTopColor: colors.border }, button: { backgroundColor: colors.success, borderColor: colors.border, borderWidth: 3, borderRadius: 15, padding: 16, alignItems: 'center' }, secondaryButton: { alignItems: 'center', padding: 10 }, secondaryButtonText: { color: colors.text, fontWeight: '800' }, disabled: { opacity: 0.5 }, buttonText: { color: '#fff', fontWeight: '900', fontSize: 16 }, error: { color: colors.error, fontWeight: '800', textAlign: 'center' },
});