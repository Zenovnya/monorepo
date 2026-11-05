import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { lexbearApi } from '../api/lexbear';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { AnimatedButton } from '../components/AnimatedButton';
import { FeedbackCard } from '../components/FeedbackCard';
import { FadeInView } from '../components/motion/FadeInView';
import { AnimatedStep } from '../components/motion/AnimatedStep';
import { ErrorState, LoadingState } from '../components/StateViews';
import { SpeechBubble } from '../components/SpeechBubble';
import { LegalText } from '../components/LegalText';
import { AnswerRow } from './assessment/AnswerRow';
import { colors, radius, spacing, typography, sizes } from '../theme/tokens';

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

  const { data: caseData, isLoading, error, refetch } = useQuery({
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
      <View style={styles.container}>
        <LoadingState label="Открываем дело…" />
      </View>
    );
  }

  if (error || !caseData) {
    return (
      <View style={styles.container}>
        <ErrorState
          title="Не удалось загрузить кейс"
          message="Проверь соединение и попробуй снова."
          onRetry={() => refetch()}
        />
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.codexChip}>
          <Text style={styles.codexText}>{caseData?.codex}</Text>
        </View>

        {/* Медведь + реплика: состояние меняется вместе с фазой кейса. */}
        <View style={styles.bearRow}>
          <AnimatedMascot size={110} {...bearProps} />
          <View style={styles.bubbleWrap}>
            <SpeechBubble text={bearText} />
          </View>
        </View>

        {/* Текст кейса. */}
        <FadeInView>
          <View style={styles.caseCard}>
            <LegalText style={styles.caseText}>{caseData?.case_text}</LegalText>
          </View>
        </FadeInView>

        <AnimatedStep step={checked ? 1 : 0} direction="forward">
          <Text style={styles.questionTitle}>Квалификация?</Text>

          <View style={styles.options}>
            {options.map((opt, i) => {
              const isSel = sel === i;
              const isAnswer = checked && i === correctIndex;
              const isWrongPick = checked === 'wrong' && isSel;
              return (
                <FadeInView key={String(i)} index={i}>
                  <AnswerRow
                    index={i}
                    text={opt?.text ?? opt}
                    selected={isSel}
                    disabled={Boolean(checked)}
                    status={
                      isAnswer
                        ? 'correct'
                        : isWrongPick
                          ? 'incorrect'
                          : isSel
                            ? 'selected'
                            : 'idle'
                    }
                    onPress={() => !checked && setSel(i)}
                  />
                </FadeInView>
              );
            })}
          </View>

          {/* «Подсказка» — медведь произносит её в облачке, без отдельной карточки. */}
          {hint && !checked && !hintShown ? (
            <FadeInView delay={80}>
              <Pressable style={styles.hintBtn} onPress={() => setHintShown(true)}>
                <Text style={styles.hintBtnText}>💡 Попросить подсказку у мишки</Text>
              </Pressable>
            </FadeInView>
          ) : null}
        </AnimatedStep>

        {/* Разбор после проверки — с кликабельными ссылками на статьи. */}
        {checked && explanation ? (
          <FeedbackCard
            status={checked === 'right' ? 'correct' : 'incorrect'}
            title={checked === 'right' ? 'Почему верно' : 'Почему нет'}
            style={styles.explainCard}
          />
        ) : null}
        {checked && explanation ? (
          <FadeInView delay={60} style={styles.explainBody}>
            <LegalText style={styles.explainText}>{explanation}</LegalText>
          </FadeInView>
        ) : null}
      </ScrollView>

      {/* Нижняя кнопка: всегда одна — следующее логичное действие. */}
      <View style={styles.footer}>
        {!checked ? (
          <AnimatedButton
            title="Проверить"
            disabled={sel === null}
            onPress={check}
          />
        ) : (
          <AnimatedButton title="К списку кейсов" onPress={() => navigation.goBack()} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
  },
  backBtn: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: sizes.iconButton / 2,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { ...typography.heading, color: colors.text },
  headerTitle: { ...typography.heading, color: colors.text, flex: 1 },
  content: { paddingHorizontal: spacing.base, paddingBottom: 140 },
  codexChip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
  },
  codexText: { ...typography.caption, color: colors.text },

  // minHeight убран: пузырь растёт по тексту и не «прыгает».
  bearRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  bubbleWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: spacing.md,
  },

  caseCard: {
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.base,
  },
  caseText: { ...typography.body, color: colors.text },
  questionTitle: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.xl,
  },
  options: { gap: spacing.xs, marginTop: spacing.md },

  hintBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.base,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
    backgroundColor: colors.goldTint,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  hintBtnText: { ...typography.caption, color: colors.text },

  explainCard: { marginTop: spacing.lg },
  explainBody: {
    marginTop: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    padding: spacing.md + 2,
  },
  explainText: { ...typography.caption, fontWeight: '600', color: colors.text },

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
});
