import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { progressApi } from '../api/progress';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { LexEntrance } from '../components/LexEntrance';
import { SpeechBubble } from '../components/SpeechBubble';
import { Confetti } from '../components/Confetti';
import { AnimatedButton } from '../components/AnimatedButton';
import { colors } from '../theme/colors';

export default function CaseScreen({ route, navigation }) {
  const { lesson, cases, index } = route.params;
  const caseItem = cases[index];
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(null); // null | 'right' | 'wrong'
  const [entranceDone, setEntranceDone] = useState(
    caseItem.case_type !== 'lex_entrance'
  );

  const answerMutation = useMutation({
    mutationFn: (payload) => progressApi.answer(payload),
  });

  const handleCheck = async () => {
    if (selected === null || checked) return;
    const selectedOption = caseItem.options[selected];
    try {
      const data = await answerMutation.mutateAsync({
        case_id: caseItem.id,
        option_id: selectedOption.id,
      });
      const isRight = data.is_correct;
      setChecked(isRight ? 'right' : 'wrong');
      Haptics.notificationAsync(
        isRight
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );
    } catch {
      // локальная проверка при ошибке сети
      const isRight = selectedOption?.is_correct ?? false;
      setChecked(isRight ? 'right' : 'wrong');
    }
  };

  const handleNext = () => {
    if (index + 1 < cases.length) {
      navigation.replace('Case', {
        lesson,
        cases,
        index: index + 1,
      });
    } else {
      // Урок пройден
      navigation.replace('Result', { lesson, score: 100 });
    }
  };

  // Для lex_entrance сначала показываем анимацию въезда Lex
  if (!entranceDone) {
    return (
      <View style={styles.entranceContainer}>
        <LexEntrance
          hint={caseItem.lex_hint_text}
          onDone={() => setEntranceDone(true)}
        />
        <AnimatedButton title="Понятно, поехали" onPress={() => setEntranceDone(true)} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Confetti active={checked === 'right'} />

      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Кейс {index + 1}/{cases.length}</Text>
      </View>

      <View style={styles.caseCard}>
        <Text style={styles.caseType}>
          {caseItem.case_type === 'lex_entrance' ? '⚖️ Lex въезжает' : '📋 Кейс'}
        </Text>
        <Text style={styles.caseText}>{caseItem.situation}</Text>
      </View>

      <Text style={styles.questionTitle}>Как поступишь?</Text>

      <View style={styles.options}>
        {caseItem.options.map((opt, i) => {
          const isSel = selected === i;
          const isCorrect = checked && opt.is_correct;
          const isWrongPick = checked === 'wrong' && isSel;
          return (
            <Pressable
              key={opt.id}
              onPress={() => !checked && setSelected(i)}
              style={[
                styles.option,
                isSel && !checked && styles.optionSelected,
                isCorrect && styles.optionCorrect,
                isWrongPick && styles.optionWrong,
              ]}
            >
              <Text style={styles.optionLetter}>
                {String.fromCharCode(65 + i)}
              </Text>
              <Text style={styles.optionText}>{opt.text}</Text>
            </Pressable>
          );
        })}
      </View>

      {checked && (
        <View
          style={[
            styles.feedback,
            checked === 'right' ? styles.feedbackRight : styles.feedbackWrong,
          ]}
        >
          <View style={styles.feedbackRow}>
            <AnimatedMascot />
            <View style={styles.feedbackBody}>
              <Text style={styles.feedbackTitle}>
                {checked === 'right' ? 'Верно!' : 'Не то'}
              </Text>
              {caseItem.options[selected]?.explanation ? (
                <Text style={styles.feedbackText}>
                  {caseItem.options[selected].explanation}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        {!checked ? (
          <AnimatedButton
            title="Проверить"
            onPress={handleCheck}
            loading={answerMutation.isPending}
            disabled={selected === null}
          />
        ) : (
          <AnimatedButton
            title={index + 1 < cases.length ? 'Следующий' : 'Завершить'}
            onPress={handleNext}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  entranceContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backText: { fontSize: 18, fontWeight: '800', color: colors.text },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  caseCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 18,
    marginHorizontal: 20,
    marginTop: 20,
  },
  caseType: { fontSize: 12, fontWeight: '800', color: colors.accent, textTransform: 'uppercase' },
  caseText: { fontSize: 17, lineHeight: 24, color: colors.text, marginTop: 8 },
  questionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, paddingHorizontal: 20, marginTop: 20 },
  options: { paddingHorizontal: 20, marginTop: 12, gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  optionSelected: { backgroundColor: '#FFF7DE', borderColor: colors.accent },
  optionCorrect: { backgroundColor: '#DFF5E5', borderColor: '#43A35D' },
  optionWrong: { backgroundColor: '#FDE0DC', borderColor: '#E85D4C' },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '800',
    color: colors.text,
    marginRight: 10,
  },
  optionText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  feedback: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 14,
  },
  feedbackRight: { backgroundColor: '#DFF5E5' },
  feedbackWrong: { backgroundColor: '#FDE0DC' },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  feedbackBody: { flex: 1 },
  feedbackTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  feedbackText: { fontSize: 14, color: colors.text, marginTop: 4, lineHeight: 20 },
  footer: { paddingHorizontal: 20, marginTop: 24 },
});