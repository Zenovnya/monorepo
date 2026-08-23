import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { lexbearApi } from '../api/lexbear';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { colors } from '../theme/colors';

/**
 * Экран прохождения отдельного кейса (адаптация веб-CaseClient).
 * Данные кейса подтягиваются по id через GET /lexbear/cases/{id}.
 */
export default function CaseDetailScreen({ route, navigation }) {
  const { caseId } = route.params;
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(null); // null | 'right' | 'wrong'

  const { data: caseData, isLoading, error } = useQuery({
    queryKey: ['lexbear-case', caseId],
    queryFn: () => lexbearApi.getCase(caseId),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error || !caseData) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Не удалось загрузить кейс</Text>
      </View>
    );
  }

  const options = caseData?.options ?? [];
  const correctIndex = caseData?.correct;

  const check = () => {
    if (sel === null) return;
    setChecked(sel === correctIndex ? 'right' : 'wrong');
  };

  const explanation = caseData?.explanation;

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{caseData?.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.codexChip}>
          <Text style={styles.codexText}>{caseData?.codex}</Text>
        </View>
        <View style={styles.caseCard}>
          <Text style={styles.caseText}>{caseData?.case_text}</Text>
        </View>

        <Text style={styles.questionTitle}>Квалификация?</Text>

        <View style={styles.options}>
          {options.map((opt, i) => {
            const isSel = sel === i;
            const isCorrect = checked && i === correctIndex;
            const isWrongPick = checked === 'wrong' && isSel;
            return (
              <Pressable
                key={String(i)}
                onPress={() => !checked && setSel(i)}
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

        {/* Обратная связь */}
        {checked && (
          <View style={[styles.feedback, { backgroundColor: checked === 'right' ? '#DFF5E5' : '#FDE0DC' }]}>
            <AnimatedMascot size={70} emotion={checked === 'right' ? 'cheer' : 'sad'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.feedbackTitle}>
                {checked === 'right' ? 'Верно!' : 'Не то'}
              </Text>
              <Text style={styles.feedbackText}>{explanation}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Кнопка */}
      <View style={styles.footer}>
        {!checked ? (
          <Pressable
            style={[styles.btn, { opacity: sel === null ? 0.55 : 1 }]}
            disabled={sel === null}
            onPress={check}
          >
            <Text style={styles.btnText}>Проверить</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
            <Text style={styles.btnText}>К списку кейсов</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 15, fontWeight: '700', color: colors.error },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 18, fontWeight: '900', color: colors.text },
  headerTitle: { fontSize: 18, fontWeight: '900', color: colors.text, flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 120 },
  codexChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: 12,
  },
  codexText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  caseCard: {
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
  },
  caseText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  questionTitle: { fontSize: 20, fontWeight: '900', color: colors.text, marginTop: 24 },
  options: { gap: 12, marginTop: 12 },
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
  optionLetter: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterText: { fontSize: 13, fontWeight: '700', color: colors.text },
  optionText: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderTopWidth: 3,
    borderTopColor: colors.border,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
  },
  feedbackTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  feedbackText: { fontSize: 14, color: colors.text, marginTop: 4, lineHeight: 20 },
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
  btnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});