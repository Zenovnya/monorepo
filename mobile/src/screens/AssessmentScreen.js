import React, { useRef, useState } from 'react';
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
import {
  brand,
  serifFamily,
  KhokhlomaCorners,
  KhokhlomaDivider,
  RibbonBookmark,
  WaxSeal,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Экран стартовой диагностики (AssessmentScreen):
 * чистые вопросы на сливочной бумаге (#F7EFDF) с информационной плашкой «Тест» (#7298BC),
 * хвойным верным ответом (#315B46), лаково-красной главной кнопкой (#C9362B)
 * и парадной грамотой хохломы по завершении диагностики.
 */
export default function AssessmentScreen({ navigation }) {
  const queryClient = useQueryClient();
  const scrollRef = useRef(null);
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
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 80);
    },
  });

  const next = useMutation({
    mutationFn: learningApi.nextAssessment,
    onSuccess: (data) => {
      if (!data) setCompleted(true);
      else setItem(data);
      setSelected(null);
      setResult(null);
    },
  });

  const data = session || start.data;

  if (start.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brand.red} />
        <Text style={styles.stateHint}>Подготавливаем диагностику…</Text>
      </View>
    );
  }

  if (start.error || !data?.case) {
    return (
      <View style={styles.center}>
        <View style={styles.stateCard}>
          <WaxSeal label="§" tone="red" size={48} />
          <Text style={styles.error}>Не удалось начать диагностику</Text>
          <Pressable
            style={({ pressed }) => [
              styles.stateBtn,
              pressed && styles.btnPressed,
            ]}
            onPress={() => start.refetch()}
          >
            <Text style={styles.buttonText}>Повторить</Text>
          </Pressable>
        </View>
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

  const finish = () => navigation.replace('AdaptiveLearning');
  const continueAssessment = () => next.mutate(data.session_id);

  /* Финал диагностики — точечная красно-золотая рамка хохломы */
  if (completed) {
    return (
      <View style={styles.center}>
        <PaperGrain />
        <View style={[styles.stateCard, styles.completeCard]}>
          <KhokhlomaCorners variant="light" size="md" inset={9} />
          <Text style={styles.completeKicker}>§ АТТЕСТАЦИЯ ЗАВЕРШЕНА</Text>
          <WaxSeal label="🏆" tone="gold" size={64} />
          <Text style={styles.completeTitle}>Диагностика завершена!</Text>
          <Text style={styles.completeSubtitle}>
            Мы собрали персональную программу обучения по вашим ответам.
          </Text>
          <KhokhlomaDivider />
          <Pressable
            style={({ pressed }) => [
              styles.stateBtn,
              pressed && styles.btnPressed,
            ]}
            onPress={finish}
          >
            <Text style={styles.buttonText}>Перейти к обучению</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const canAnswer = Boolean(selected) && !answer.isPending && !result;

  return (
    <View style={styles.container}>
      <PaperGrain />

      {/* Верхняя полоса с золотым прогрессом и информационным тегом (#7298BC) */}
      <View style={styles.topBar}>
        <View style={styles.topTrack}>
          <View
            style={[
              styles.topFill,
              { width: item ? '68%' : result ? '48%' : '28%' },
            ]}
          />
        </View>
        <View style={styles.testChip}>
          <Text style={styles.testChipText}>ДИАГНОСТИКА</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          result && { paddingBottom: 245 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.categoryRow}>
          <Text style={styles.categorySign}>§</Text>
          <Text style={styles.categoryLabel}>ОПРЕДЕЛЕНИЕ УРОВНЯ</Text>
        </View>

        <Text style={styles.title}>Проверим стартовые знания</Text>

        {/* Лист ситуации с закладкой */}
        <View style={styles.situationCard}>
          <RibbonBookmark
            color={brand.gold}
            symbol="§"
            right={16}
            height={27}
            width={20}
            cutoutColor={colors.card}
          />
          <Text style={styles.docEyebrow}>СИТУАЦИЯ</Text>
          <Text style={styles.situation}>{currentItem.situation}</Text>
        </View>

        <Text style={styles.prompt}>{currentItem.prompt}</Text>

        <View style={styles.answersList}>
          {currentItem.answers.map((option, index) => {
            const isSelected = selected === option.id;
            const isRightSel = Boolean(result) && isSelected && result.correct;
            const isWrongSel = Boolean(result) && isSelected && !result.correct;

            return (
              <Pressable
                key={option.id}
                disabled={Boolean(result)}
                onPress={() => setSelected(option.id)}
                style={({ pressed }) => [
                  styles.answer,
                  isSelected && !result && styles.selected,
                  isRightSel && styles.answerSuccess,
                  isWrongSel && styles.answerFailure,
                  pressed && !result && styles.answerPressed,
                ]}
              >
                <View
                  style={[
                    styles.numberBadge,
                    isSelected && !result && styles.numberBadgeSelected,
                    isRightSel && styles.numberBadgeSuccess,
                    isWrongSel && styles.numberBadgeFailure,
                  ]}
                >
                  <Text
                    style={[
                      styles.number,
                      isSelected && !result && { color: brand.ink },
                      (isRightSel || isWrongSel) && styles.numberActive,
                    ]}
                  >
                    {isRightSel ? '✓' : isWrongSel ? '✕' : index + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.answerText,
                    isSelected && !result && { fontWeight: '700' },
                    isRightSel && { color: brand.pineDark, fontWeight: '700' },
                    isWrongSel && { color: brand.redDark, fontWeight: '700' },
                  ]}
                >
                  {option.text}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {answer.error || next.error ? (
          <View style={styles.inlineErrorBox}>
            <Text style={styles.inlineErrorText}>
              Не удалось сохранить ответ. Проверьте соединение и повторите.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {result ? (
        <View
          style={[
            styles.feedbackSheet,
            result.correct ? styles.sheetRight : styles.sheetWrong,
          ]}
        >
          <View style={styles.sheetHeader}>
            <WaxSeal
              label={result.correct ? '✓' : '!'}
              size={36}
              tone={result.correct ? 'pine' : 'red'}
            />
            <Text
              style={[
                styles.sheetTitle,
                { color: result.correct ? brand.pineDark : brand.redDark },
              ]}
            >
              {result.correct ? 'Верно! Ответ учтён' : 'Ответ учтён'}
            </Text>
          </View>
          {result.explanation ? (
            <Text style={styles.sheetExplain} numberOfLines={3}>
              {result.explanation}
            </Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              result.correct ? styles.buttonPine : styles.buttonRed,
              pressed && !next.isPending && styles.btnPressed,
            ]}
            disabled={next.isPending}
            onPress={continueAssessment}
          >
            <Text style={styles.buttonText}>
              {next.isPending ? 'Загружаем…' : 'Следующий вопрос'}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={finish}>
            <Text style={styles.secondaryButtonText}>Перейти к обучению</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.footer}>
          <Pressable
            disabled={!canAnswer}
            style={({ pressed }) => [
              styles.button,
              canAnswer ? styles.buttonRed : styles.buttonDisabled,
              pressed && canAnswer && styles.btnPressed,
            ]}
            onPress={submit}
          >
            <Text
              style={[
                styles.buttonText,
                !canAnswer && styles.buttonTextDisabled,
              ]}
            >
              {answer.isPending ? 'Сохраняем…' : 'Ответить'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: colors.background,
  },
  stateHint: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subtext,
  },
  stateCard: {
    position: 'relative',
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
  completeCard: {
    borderWidth: 2,
    borderColor: brand.gold,
    paddingVertical: 28,
  },
  completeKicker: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: brand.goldInk,
  },
  completeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  completeSubtitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 19.5,
  },
  error: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  stateBtn: {
    width: '100%',
    height: 50,
    borderRadius: 15,
    backgroundColor: brand.red,
    borderBottomWidth: 4,
    borderBottomColor: brand.redDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  topTrack: {
    flex: 1,
    height: 11,
    borderRadius: 999,
    backgroundColor: brand.rule,
    overflow: 'hidden',
  },
  topFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: brand.gold,
  },
  testChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: brand.infoSoft,
    borderWidth: 1,
    borderColor: brand.infoBorder,
  },
  testChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: brand.infoInk,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 28,
    gap: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categorySign: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: serifFamily,
    color: brand.red,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: brand.goldInk,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },

  situationCard: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    padding: 16,
    gap: 7,
  },
  docEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: brand.muted,
    paddingRight: 26,
  },
  situation: {
    fontSize: 14.5,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 21.5,
  },

  prompt: {
    fontSize: 17.5,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 23,
  },
  answersList: {
    gap: 10,
  },
  answer: {
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
  selected: {
    backgroundColor: brand.goldSoft,
    borderColor: brand.gold,
  },
  answerSuccess: {
    backgroundColor: brand.pineSoft,
    borderColor: brand.pine,
  },
  answerFailure: {
    backgroundColor: brand.redSoft,
    borderColor: brand.red,
  },
  answerPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 1.5,
  },
  numberBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1.2,
    borderColor: brand.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBadgeSelected: {
    backgroundColor: brand.gold,
    borderColor: brand.goldDark,
  },
  numberBadgeSuccess: {
    backgroundColor: brand.pine,
    borderColor: brand.pineDark,
  },
  numberBadgeFailure: {
    backgroundColor: brand.red,
    borderColor: brand.redDark,
  },
  number: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.subtext,
  },
  numberActive: {
    color: brand.creamText,
  },
  answerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 19.5,
  },

  inlineErrorBox: {
    backgroundColor: brand.redSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.redBorder,
    padding: 12,
  },
  inlineErrorText: {
    fontSize: 13,
    fontWeight: '700',
    color: brand.redDark,
  },

  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.card,
    borderTopWidth: 1.5,
    borderTopColor: brand.rule,
  },
  feedbackSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 2,
    gap: 9,
  },
  sheetRight: {
    backgroundColor: brand.pineSoft,
    borderTopColor: brand.pine,
  },
  sheetWrong: {
    backgroundColor: brand.redSoft,
    borderTopColor: brand.red,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetTitle: {
    fontSize: 17.5,
    fontWeight: '800',
  },
  sheetExplain: {
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 19,
  },
  button: {
    height: 50,
    borderRadius: 15,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRed: {
    backgroundColor: brand.red,
    borderBottomColor: brand.redDark,
  },
  buttonPine: {
    backgroundColor: brand.pine,
    borderBottomColor: brand.pineDark,
  },
  buttonDisabled: {
    backgroundColor: brand.rule,
    borderBottomWidth: 0,
  },
  btnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  buttonText: {
    color: brand.creamText,
    fontSize: 14.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  buttonTextDisabled: {
    color: colors.locked,
  },
  secondaryButton: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
