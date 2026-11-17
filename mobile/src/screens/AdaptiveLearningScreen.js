import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Linking,
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
 * Адаптивная сессия LexBear:
 * чистый рабочий экран с закладкой дела и приглушённо-синей ссылкой на статью (#7298BC),
 * хвойным верным ответом (#315B46), лаково-красной главной кнопкой (#C9362B)
 * и праздничной грамотой хохломы при завершении всех кейсов.
 */
export default function AdaptiveLearningScreen({ navigation }) {
  const queryClient = useQueryClient();
  const scrollRef = useRef(null);
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
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 80);
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
        <ActivityIndicator size="large" color={brand.red} />
        <Text style={styles.stateHint}>Подбираем следующий кейс…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <View style={styles.stateCard}>
          <WaxSeal label="!" tone="red" size={48} />
          <Text style={styles.error}>Не удалось загрузить следующий кейс</Text>
          <Pressable
            style={({ pressed }) => [
              styles.stateBtn,
              pressed && styles.btnPressed,
            ]}
            onPress={() => refetch()}
          >
            <Text style={styles.buttonText}>Повторить</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* Экран завершения обучения — точечная рамка хохломы */
  if (!item) {
    return (
      <View style={styles.center}>
        <PaperGrain />
        <View style={[styles.stateCard, styles.completeCard]}>
          <KhokhlomaCorners variant="light" size="md" inset={9} />
          <Text style={styles.completeKicker}>§ ПРАКТИКУМ ЗАВЕРШЁН</Text>
          <WaxSeal label="★" tone="gold" size={62} />
          <Text style={styles.stateTitle}>Все доступные кейсы пройдены</Text>
          <KhokhlomaDivider />
          <Pressable
            style={({ pressed }) => [
              styles.stateBtn,
              pressed && styles.btnPressed,
            ]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Вернуться</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const topProgress = progress.slice(0, 3);
  const avgPct =
    progress.length > 0
      ? Math.round(
          (progress.reduce((sum, s) => sum + (s.mastery || 0), 0) /
            progress.length) *
            100
        )
      : 35;
  const canSubmit = Boolean(selected) && !result && !attempt.isPending;

  return (
    <View style={styles.container}>
      <PaperGrain />

      {/* Верхняя полоса */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Вернуться назад"
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <View style={styles.topTrack}>
          <View
            style={[styles.topFill, { width: `${Math.max(12, avgPct)}%` }]}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.statsPill,
            pressed && styles.pillPressed,
          ]}
          onPress={() => navigation.navigate('LearningProgress')}
        >
          <Text style={styles.statsPillText}>{avgPct}%</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          result && { paddingBottom: 230 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.categoryRow}>
          <Text style={styles.categorySign}>§</Text>
          <Text style={styles.categoryLabel}>АДАПТИВНЫЙ ПРАКТИКУМ</Text>
        </View>

        <Text style={styles.title}>Разберём ситуацию</Text>

        {/* Компактная полоска навыков */}
        {topProgress.length > 0 ? (
          <Pressable
            style={({ pressed }) => [
              styles.progressCard,
              pressed && styles.pillPressed,
            ]}
            onPress={() => navigation.navigate('LearningProgress')}
          >
            <View style={styles.progressBarsGroup}>
              {topProgress.map((state, idx) => {
                const pct = Math.round(state.mastery * 100);
                const isHigh = pct >= 70;
                const barC = isHigh ? brand.pine : brand.gold;
                const txtC = isHigh ? brand.pine : brand.goldInk;
                return (
                  <View key={state.competency_id} style={styles.progressItem}>
                    <View style={styles.progressItemTop}>
                      <Text style={styles.progressItemLabel}>
                        Навык {idx + 1}
                      </Text>
                      <Text style={[styles.progressValue, { color: txtC }]}>
                        {pct}%
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.max(10, pct)}%`,
                            backgroundColor: barC,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ) : null}

        {/* Карточка ситуации со шёлковой закладкой и синей ссылкой на статью (#7298BC) */}
        {item.image_url ? (
          <ImageBackground
            source={{ uri: item.image_url }}
            imageStyle={styles.caseImage}
            style={styles.caseImageWrap}
          >
            <View style={styles.imageOverlay}>
              <Text style={styles.situationOnImage}>{item.situation}</Text>
            </View>
          </ImageBackground>
        ) : (
          <View style={styles.situationCard}>
            <RibbonBookmark
              color={brand.red}
              symbol="§"
              right={16}
              height={28}
              width={20}
              cutoutColor={colors.card}
            />
            <Text style={styles.docEyebrow}>ФАБУЛА ДЕЛА</Text>
            <Text style={styles.situation}>{item.situation}</Text>
            {item.article_url ? (
              <Pressable
                onPress={() => Linking.openURL(item.article_url)}
                style={styles.articlePill}
              >
                <Text style={styles.articleLinkText}>📖 Статья закона ↗</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {item.image_url && item.article_url ? (
          <Pressable
            onPress={() => Linking.openURL(item.article_url)}
            style={styles.articlePill}
          >
            <Text style={styles.articleLinkText}>
              📖 Открыть статью закона ↗
            </Text>
          </Pressable>
        ) : null}

        <Text style={styles.prompt}>{item.prompt}</Text>

        {/* Чистые карточки вариантов ответа */}
        <View style={styles.answersList}>
          {item.answers.map((answer, index) => {
            const isSelected = selected === answer.id;
            const isRightSel = Boolean(result) && isSelected && result.correct;
            const isWrongSel = Boolean(result) && isSelected && !result.correct;

            return (
              <Pressable
                key={answer.id}
                disabled={Boolean(result)}
                onPress={() => setSelected(answer.id)}
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
                  {answer.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Нижняя шторка разбора */}
      {result ? (
        <View
          style={[
            styles.feedbackSheet,
            result.correct ? styles.sheetRight : styles.sheetWrong,
          ]}
        >
          <View style={styles.sheetHeader}>
            <WaxSeal
              label={result.correct ? '✓' : '§'}
              size={36}
              tone={result.correct ? 'pine' : 'red'}
            />
            <Text
              style={[
                styles.sheetTitle,
                { color: result.correct ? brand.pineDark : brand.redDark },
              ]}
            >
              {result.correct ? 'Верно!' : 'Разберём норму'}
            </Text>
          </View>
          {result.explanation ? (
            <Text style={styles.sheetExplain} numberOfLines={4}>
              {result.explanation}
            </Text>
          ) : null}
          <Pressable
            onPress={next}
            style={({ pressed }) => [
              styles.button,
              result.correct ? styles.buttonPine : styles.buttonRed,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.buttonText}>Следующий кейс</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.footer}>
          <Pressable
            disabled={!canSubmit}
            onPress={submit}
            style={({ pressed }) => [
              styles.button,
              canSubmit ? styles.buttonRed : styles.buttonDisabled,
              pressed && canSubmit && styles.btnPressed,
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                !canSubmit && styles.buttonTextDisabled,
              ]}
            >
              {attempt.isPending ? 'Проверяем…' : 'Проверить'}
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
    gap: 14,
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
  stateTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
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
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '700',
    color: brand.muted,
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
  statsPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: brand.infoSoft,
    borderWidth: 1,
    borderColor: brand.infoBorder,
  },
  pillPressed: {
    transform: [{ translateY: 1.5 }],
  },
  statsPillText: {
    fontSize: 12,
    fontWeight: '800',
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

  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: brand.rule,
    padding: 12,
  },
  progressBarsGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  progressItem: {
    flex: 1,
    gap: 5,
  },
  progressItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressItemLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: brand.muted,
  },
  progressValue: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: brand.paper,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '600',
    color: brand.muted,
  },

  caseImageWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 150,
    justifyContent: 'flex-end',
  },
  caseImage: {
    borderRadius: 18,
  },
  imageOverlay: {
    backgroundColor: 'rgba(48, 40, 32, 0.78)',
    padding: 16,
  },
  situationOnImage: {
    fontSize: 14,
    fontWeight: '500',
    color: brand.creamText,
    lineHeight: 20.5,
  },

  situationCard: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    padding: 16,
    gap: 8,
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
  articlePill: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    borderRadius: 10,
    backgroundColor: brand.infoSoft,
    borderWidth: 1,
    borderColor: brand.infoBorder,
  },
  articleLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: brand.infoInk,
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
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 2,
    gap: 10,
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
    height: 52,
    borderRadius: 16,
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
});
