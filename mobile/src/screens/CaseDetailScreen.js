import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,

  ActivityIndicator,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lexbearApi } from '../api/lexbear';
import { describeLoadError } from '../api/client';
import { progressApi } from '../api/progress';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { PressableScale } from '../components/PressableScale';
import { SpeechBubble } from '../components/SpeechBubble';
import { LegalText } from '../components/LegalText';
import {
  brand,
  serifFamily,
  KhokhlomaCorners,
  RibbonBookmark,
  WaxSeal,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Экран разбора кейса (CaseDetailScreen):
 * лист судебного дела на сливочной бумаге (#F7EFDF) с закладкой-ляссе,
 * приглушённо-синей кнопкой подсказки (#7298BC), хвойным верным ответом (#315B46),
 * лаково-красным главным действием (#C9362B) и живым мишкой-юристом (5 эмоций).
 */
export default function CaseDetailScreen({ route, navigation }) {
  const { caseId } = route.params || {};
  const queryClient = useQueryClient();
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(null);
  const [hintShown, setHintShown] = useState(false);
  const [saved, setSaved] = useState(false);

  const {
    data: caseData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['lexbear-case', caseId],
    queryFn: () => lexbearApi.getCase(caseId),
  });

  const options = Array.isArray(caseData?.options) ? caseData.options : [];

  const answerMutation = useMutation({
    mutationFn: ({ optionId }) =>
      progressApi.answer({ case_id: String(caseId), option_id: optionId }),
    onSuccess: () => {
      // Обновляем список повторений и сводку прогресса.
      queryClient.invalidateQueries({ queryKey: ['srs-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['progress-overview'] });
    },
  });
  const correctIndex = caseData?.correct;
  const explanation = caseData?.explanation;
  const hint = caseData?.hint;
  const isSpecialCase = caseData?.difficulty === 'hard';

  const { bearText, bearProps } = useMemo(() => {
    if (checked === 'right') {
      return {
        bearText: 'Отлично! Верное правовое решение — смотри разбор.',
        bearProps: { emotion: 'happy', celebrate: true, talking: true },
      };
    }
    if (checked === 'wrong') {
      return {
        bearText:
          'Не переживай, ситуация непростая. Давай спокойно разберём норму вместе.',
        bearProps: { emotion: 'sad', error: true, talking: true },
      };
    }
    if (hintShown && hint) {
      return {
        bearText: hint,
        bearProps: { emotion: 'strict', talking: true },
      };
    }
    if (sel !== null) {
      return {
        bearText: 'Сверяем с нормой закона… Уверен в этом варианте?',
        bearProps: { emotion: 'thinking', talking: true },
      };
    }
    return {
      bearText: 'Внимательно изучаем обстоятельства дела и выбираем решение.',
      bearProps: { emotion: 'thinking', talking: true },
    };
  }, [checked, hintShown, hint, sel]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <AnimatedMascot size={114} emotion="thinking" />
        <ActivityIndicator size="small" color={brand.red} />
        <Text style={styles.loadingHint}>Изучаем материалы дела…</Text>
      </View>
    );
  }

  if (error || !caseData) {
    // Раньше здесь был только текст без единого действия: пользователь упирался
    // в тупик и мог лишь вернуться назад. Теперь есть повтор и понятная причина.
    return (
      <View style={styles.center}>
        <AnimatedMascot size={124} emotion="sad" networkError />
        <Text style={styles.errorText}>Не удалось загрузить кейс</Text>
        <Text style={styles.errorDetail}>
          {describeLoadError(error, 'кейс')}
        </Text>
        <PressableScale
          onPress={() => refetch()}
          style={styles.retryBtn}
          scale={0.95}
        >
          <Text style={styles.retryBtnText}>Повторить</Text>
        </PressableScale>
        <PressableScale
          onPress={() => navigation.goBack()}
          style={styles.backLink}
          scale={0.95}
        >
          <Text style={styles.backLinkText}>К списку кейсов</Text>
        </PressableScale>
      </View>
    );
  }

  const check = () => {
    if (sel === null) return;
    setChecked(sel === correctIndex ? 'right' : 'wrong');

    // Отправляем ответ на сервер: только так обновляется расписание SM-2
    // и статистика. Раньше разбор кейса был полностью локальным — ответ
    // нигде не сохранялся, и повторения (GET /srs/reviews) не появлялись.
    const optionId = options[sel]?.id;
    if (optionId !== undefined && optionId !== null) {
      answerMutation.mutate({ optionId });
    }
  };

  const leave = () => navigation.goBack();

  return (
    <View style={styles.container}>
      <PaperGrain />

      {/* Шапка документа с информационным тегом кодекса (#7298BC) */}
      <View style={styles.header}>
        <PressableScale
          onPress={leave}
          hitSlop={8}
          style={[
            styles.backBtn,
          ]}
        >
          <Text style={styles.backText}>←</Text>
        </PressableScale>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {caseData?.title}
        </Text>
        {caseData?.codex ? (
          <View style={styles.codexChip}>
            <Text style={styles.codexText}>{caseData.codex}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          checked && styles.contentWithSheet,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Мишка-юрист + реплика */}
        <View style={styles.bearRow}>
          <AnimatedMascot size={94} {...bearProps} />
          <View style={styles.bubbleWrap}>
            <SpeechBubble text={bearText} />
          </View>
        </View>

        {/* Лист дела со старинной закладкой-ляссе (и рамкой хохломы для особого кейса) */}
        <View
          style={[
            styles.caseCard,
            isSpecialCase && styles.caseCardSpecial,
          ]}
        >
          {isSpecialCase ? (
            <KhokhlomaCorners variant="light" size="md" inset={7} />
          ) : null}
          <RibbonBookmark
            color={brand.red}
            symbol="§"
            right={isSpecialCase ? 34 : 18}
            height={30}
            width={21}
            cutoutColor={colors.card}
          />
          <View style={styles.caseLabelRow}>
            <Text style={styles.caseSign}>§</Text>
            <Text style={styles.caseLabel}>
              {isSpecialCase ? 'ОСОБОЕ ДЕЛО · ФАБУЛА' : 'МАТЕРИАЛЫ ДЕЛА'}
            </Text>
          </View>
          <View style={styles.caseRule} />
          <LegalText style={styles.caseText}>{caseData?.case_text}</LegalText>
        </View>

        {/* Вопрос + приглушённо-синяя кнопка подсказки (#7298BC) */}
        <View style={styles.questionRow}>
          <Text style={styles.questionTitle}>Правовая квалификация</Text>
          {hint && !checked && !hintShown && (
            <PressableScale
              style={[
                styles.hintBtn,
              ]}
              onPress={() => setHintShown(true)}
            >
              <Text style={styles.hintBtnText}>💡 Подсказка</Text>
            </PressableScale>
          )}
        </View>

        {hintShown && hint && !checked ? (
          <View style={styles.hintBanner}>
            <Text style={styles.hintBannerLabel}>СПРАВКА ЮРИСТА</Text>
            <LegalText style={styles.hintBannerText}>{hint}</LegalText>
          </View>
        ) : null}

        {/* Чистые округлые карточки вариантов ответа */}
        <View style={styles.options}>
          {options.map((opt, i) => {
            const isSel = sel === i;
            const isCorrect = Boolean(checked) && i === correctIndex;
            const isWrongPick = checked === 'wrong' && isSel;

            return (
              <PressableScale
                key={String(i)}
                disabled={Boolean(checked)}
                onPress={() => !checked && setSel(i)}
                style={[
                  styles.option,
                  isSel && !checked && styles.optionSelected,
                  isCorrect && styles.optionCorrect,
                  isWrongPick && styles.optionWrong,
                ]}
              >
                <View
                  style={[
                    styles.optionLetter,
                    isSel && !checked && styles.optionLetterSelected,
                    isCorrect && styles.optionLetterCorrect,
                    isWrongPick && styles.optionLetterWrong,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLetterText,
                      isSel && !checked && styles.optionLetterTextSelected,
                      (isCorrect || isWrongPick) &&
                        styles.optionLetterTextLight,
                    ]}
                  >
                    {isCorrect
                      ? '✓'
                      : isWrongPick
                      ? '✕'
                      : String.fromCharCode(65 + i)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.optionText,
                    isSel && !checked && styles.optionTextSelected,
                    isCorrect && styles.optionTextCorrect,
                    isWrongPick && styles.optionTextWrong,
                  ]}
                >
                  {opt?.text ?? opt}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>

      {/* Нижняя шторка правового заключения или панель проверки */}
      {checked ? (
        <View
          style={[
            styles.explainSheet,
            checked === 'right' ? styles.sheetRight : styles.sheetWrong,
          ]}
        >
          <View style={styles.sheetTopRow}>
            <WaxSeal
              label={checked === 'right' ? '✓' : '§'}
              size={36}
              tone={checked === 'right' ? 'pine' : 'red'}
            />
            <Text
              style={[
                styles.explainTitle,
                {
                  color: checked === 'right' ? brand.pineDark : brand.redDark,
                },
              ]}
            >
              {checked === 'right' ? 'Верное решение' : 'Правовой разбор'}
            </Text>
          </View>

          {explanation ? (
            <LegalText style={styles.explainText}>{explanation}</LegalText>
          ) : null}

          <PressableScale
            style={[
              styles.btn,
              checked === 'right' ? styles.btnPine : styles.btnRed,
            ]}
            onPress={leave}
          >
            <Text style={styles.btnText}>К списку кейсов</Text>
          </PressableScale>
        </View>
      ) : (
        <View style={styles.footer}>
          <PressableScale
            style={[
              styles.btn,
              sel === null ? styles.btnDisabled : styles.btnRed,
            ]}
            disabled={sel === null}
            onPress={check}
          >
            <Text
              style={[styles.btnText, sel === null && styles.btnTextDisabled]}
            >
              Проверить
            </Text>
          </PressableScale>
          <PressableScale
            style={styles.saveBtn}
            onPress={() => {
              setSaved(true);
              leave();
            }}
          >
            <Text style={styles.saveText}>
              {saved ? 'Сохранено' : 'Сохранить и выйти'}
            </Text>
          </PressableScale>
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
    backgroundColor: colors.background,
    padding: 24,
    gap: 12,
  },
  loadingHint: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subtext,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.subtext,
    textAlign: 'center',
    maxWidth: 300,
  },
  retryBtn: {
    marginTop: 6,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 14,
    backgroundColor: brand.red,
    borderBottomWidth: 3.5,
    borderBottomColor: brand.redDark,
  },
  retryBtnText: {
    color: brand.creamText || '#FCF8F0',
    fontSize: 14,
    fontWeight: '900',
  },
  backLink: { paddingVertical: 6 },
  backLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.subtext,
    textDecorationLine: 'underline',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: colors.card,
    borderBottomWidth: 1.5,
    borderBottomColor: brand.rule,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: brand.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallPressed: {
    transform: [{ translateY: 1.5 }],
  },
  backText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15.5,
    fontWeight: '800',
    color: colors.text,
  },
  codexChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: brand.infoSoft,
    borderWidth: 1,
    borderColor: brand.infoBorder,
  },
  codexText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: brand.infoInk,
  },

  content: {
    padding: 18,
    paddingBottom: 28,
    gap: 15,
  },
  contentWithSheet: {
    paddingBottom: 220,
  },

  bearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bubbleWrap: {
    flex: 1,
  },

  /* Карточка обстоятельств дела (лист документа) */
  caseCard: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    padding: 18,
    gap: 8,
  },
  caseCardSpecial: {
    borderColor: brand.gold,
    padding: 20,
  },
  caseLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 28,
  },
  caseSign: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: serifFamily,
    color: brand.red,
  },
  caseLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: brand.muted,
  },
  caseRule: {
    height: 1,
    backgroundColor: brand.rule,
    opacity: 0.8,
  },
  caseText: {
    fontSize: 14.5,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 21.5,
  },

  /* Вопрос и кнопка подсказки (#7298BC) */
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  questionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  hintBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: brand.infoSoft,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.info,
  },
  hintBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: brand.infoInk,
  },
  hintBanner: {
    backgroundColor: brand.infoSoft,
    borderRadius: 15,
    borderWidth: 1.2,
    borderColor: brand.infoBorder,
    borderLeftWidth: 4,
    borderLeftColor: brand.info,
    padding: 13,
    gap: 4,
  },
  hintBannerLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: brand.infoInk,
  },
  hintBannerText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 19,
  },

  /* Варианты ответа */
  options: {
    gap: 10,
  },
  option: {
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
  optionSelected: {
    backgroundColor: brand.goldSoft,
    borderColor: brand.gold,
  },
  optionCorrect: {
    backgroundColor: brand.pineSoft,
    borderColor: brand.pine,
  },
  optionWrong: {
    backgroundColor: brand.redSoft,
    borderColor: brand.red,
  },
  optionPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 1.5,
  },
  optionLetter: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1.2,
    borderColor: brand.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterSelected: {
    backgroundColor: brand.gold,
    borderColor: brand.goldDark,
  },
  optionLetterCorrect: {
    backgroundColor: brand.pine,
    borderColor: brand.pineDark,
  },
  optionLetterWrong: {
    backgroundColor: brand.red,
    borderColor: brand.redDark,
  },
  optionLetterText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.subtext,
  },
  optionLetterTextSelected: {
    color: brand.ink,
  },
  optionLetterTextLight: {
    color: brand.creamText,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 19.5,
  },
  optionTextSelected: {
    fontWeight: '700',
    color: brand.ink,
  },
  optionTextCorrect: {
    fontWeight: '700',
    color: brand.pineDark,
  },
  optionTextWrong: {
    fontWeight: '700',
    color: brand.redDark,
  },

  /* Подвал и шторка заключения */
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: colors.card,
    borderTopWidth: 1.5,
    borderTopColor: brand.rule,
    gap: 8,
  },
  explainSheet: {
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
    gap: 11,
  },
  sheetRight: {
    backgroundColor: brand.pineSoft,
    borderTopColor: brand.pine,
  },
  sheetWrong: {
    backgroundColor: brand.redSoft,
    borderTopColor: brand.red,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  explainTitle: {
    fontSize: 17.5,
    fontWeight: '800',
  },
  explainText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 19.5,
  },
  btn: {
    height: 50,
    borderRadius: 15,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRed: {
    backgroundColor: brand.red,
    borderBottomColor: brand.redDark,
  },
  btnPine: {
    backgroundColor: brand.pine,
    borderBottomColor: brand.pineDark,
  },
  btnDisabled: {
    backgroundColor: brand.rule,
    borderBottomWidth: 0,
  },
  btnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  btnText: {
    color: brand.creamText,
    fontSize: 14.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  btnTextDisabled: {
    color: colors.locked,
  },
  saveBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.subtext,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
