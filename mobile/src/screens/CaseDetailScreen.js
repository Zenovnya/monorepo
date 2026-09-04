import React, { useMemo, useState } from 'react';
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
import { SpeechBubble } from '../components/SpeechBubble';
import { LegalText } from '../components/LegalText';
import { colors } from '../theme/colors';

/**
 * Экран прохождения отдельного кейса.
 *
 * Медведь встроен в экран сверху и «говорит» через SpeechBubble:
 * реплики меняются в зависимости от фазы (вступление → размышление →
 * подсказка → результат). Кнопка «Подсказка» не рисует отдельный
 * card — она заставляет медведя произнести hint через облачко.
 *
 * Ссылки на статьи и законы в тексте (case_text, explanation, hint)
 * автоматически кликабельны — открывают Консультант Плюс.
 */
export default function CaseDetailScreen({ route, navigation }) {
  const { caseId } = route.params;
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(null); // null | 'right' | 'wrong'
  const [hintShown, setHintShown] = useState(false);

  const { data: caseData, isLoading, error } = useQuery({
    queryKey: ['lexbear-case', caseId],
    queryFn: () => lexbearApi.getCase(caseId),
  });

  const options = caseData?.options ?? [];
  const correctIndex = caseData?.correct;
  const explanation = caseData?.explanation;
  const hint = caseData?.hint;

  // Реплика и настроение медведя в текущей фазе кейса.
  const { bearText, bearProps } = useMemo(() => {
    // 1) Результат проверки — реагируем.
    if (checked === 'right') {
      return {
        bearText: 'Верно! Смотри, почему именно так.',
        bearProps: { celebrate: true, talking: true },
      };
    }
    if (checked === 'wrong') {
      return {
        bearText: 'Не то. Разбираем правильный вариант.',
        bearProps: { error: true, talking: true },
      };
    }
    // 2) Подсказка (пока не проверили).
    if (hintShown && hint) {
      return {
        bearText: hint,
        bearProps: { emotion: 'happy', mood: 'excited', talking: true },
      };
    }
    // 3) Выбрали вариант, но ещё не проверили — «думаем вместе».
    if (sel !== null) {
      return {
        bearText: 'Уверен? Проверь ещё раз, если сомневаешься.',
        bearProps: { emotion: 'think', talking: true },
      };
    }
    // 4) Дефолт — вступление.
    return {
      bearText: 'Разберём эту ситуацию как юристы. Выбирай вариант.',
      bearProps: { emotion: 'happy', talking: true },
    };
  }, [checked, hintShown, hint, sel]);

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
        <AnimatedMascot size={120} networkError />
        <Text style={styles.errorText}>Не удалось загрузить кейс</Text>
      </View>
    );
  }

  const check = () => {
    if (sel === null) return;
    setChecked(sel === correctIndex ? 'right' : 'wrong');
  };

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {caseData?.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.codexChip}>
          <Text style={styles.codexText}>{caseData?.codex}</Text>
        </View>

        {/* --- Медведь + его облачко: всегда сверху экрана кейса --- */}
        <View style={styles.bearRow}>
          <AnimatedMascot size={110} {...bearProps} />
          <View style={styles.bubbleWrap}>
            <SpeechBubble text={bearText} />
          </View>
        </View>

        {/* Текст кейса */}
        <View style={styles.caseCard}>
          <LegalText style={styles.caseText}>{caseData?.case_text}</LegalText>
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
                  <Text style={styles.optionLetterText}>
                    {String.fromCharCode(65 + i)}
                  </Text>
                </View>
                <Text style={styles.optionText}>{opt?.text ?? opt}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Кнопка «Подсказка» — до проверки, если есть hint.
            По клику меняем состояние медведя — он произнесёт hint в облачке. */}
        {hint && !checked && !hintShown && (
          <Pressable
            style={styles.hintBtn}
            onPress={() => setHintShown(true)}
          >
            <Text style={styles.hintBtnText}>💡 Попросить подсказку у мишки</Text>
          </Pressable>
        )}

        {/* Разбор после проверки — с кликабельными ссылками на статьи. */}
        {checked && explanation ? (
          <View
            style={[
              styles.explainCard,
              {
                backgroundColor: checked === 'right' ? '#DFF5E5' : '#FDE0DC',
                borderColor: checked === 'right' ? colors.success : colors.error,
              },
            ]}
          >
            <Text style={styles.explainTitle}>
              {checked === 'right' ? 'Почему верно' : 'Почему нет'}
            </Text>
            <LegalText style={styles.explainText}>{explanation}</LegalText>
          </View>
        ) : null}
      </ScrollView>

      {/* Нижняя кнопка */}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 12 },
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
  content: { paddingHorizontal: 16, paddingBottom: 140 },
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

  bearRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
    minHeight: 130,
  },
  bubbleWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 12,
  },

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

  hintBtn: {
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFF7DE',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  hintBtnText: { fontWeight: '800', color: colors.text, fontSize: 14 },

  explainCard: {
    marginTop: 20,
    borderWidth: 3,
    borderRadius: 16,
    padding: 14,
  },
  explainTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  explainText: { fontSize: 14, color: colors.text, marginTop: 6, lineHeight: 20 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.background,
    borderTopWidth: 3,
    borderTopColor: colors.border,
  },
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
