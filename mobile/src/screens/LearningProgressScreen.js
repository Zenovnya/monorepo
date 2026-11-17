import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { learningApi } from '../api/learning';
import {
  brand,
  KhokhlomaCorners,
  WaxSeal,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/**
 * Экран «Компетенции» (LearningProgressScreen):
 * сводная карточка освоения в красно-золотой рамке хохломы,
 * чистые ведомости компетенций на сливочной бумаге (#F7EFDF),
 * хвойные правильные ответы (#315B46), приглушённо-синяя уверенность (#7298BC)
 * и лаково-красная главная кнопка (#C9362B).
 */
export default function LearningProgressScreen({ navigation }) {
  const {
    data: progress = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['learning-progress'],
    queryFn: learningApi.progress,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brand.red} />
        <Text style={styles.stateHint}>Загружаем ведомость…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <View style={styles.stateCard}>
          <WaxSeal label="§" tone="red" size={48} />
          <Text style={styles.error}>Не удалось загрузить прогресс</Text>
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

  const avgMastery =
    progress.length > 0
      ? Math.round(
          (progress.reduce((sum, s) => sum + (s.mastery || 0), 0) /
            progress.length) *
            100
        )
      : 0;
  const totalAttempts = progress.reduce(
    (sum, s) => sum + (s.attempts || 0),
    0
  );
  const totalCorrect = progress.reduce(
    (sum, s) => sum + (s.correct_count || 0),
    0
  );

  return (
    <View style={styles.container}>
      <PaperGrain />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>§ ВЕДОМОСТЬ ЗНАНИЙ</Text>
        <Text style={styles.title}>Компетенции</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Сводная наградная карточка освоения с точечными уголками хохломы */}
        {progress.length > 0 ? (
          <View style={styles.summaryBanner}>
            <KhokhlomaCorners variant="light" size="md" inset={8} />

            <View style={styles.summaryTopRow}>
              <View>
                <Text style={styles.summaryLabel}>СРЕДНЕЕ ОСВОЕНИЕ</Text>
                <Text style={styles.summaryBig}>{avgMastery}%</Text>
              </View>
              <WaxSeal label="🏆" tone="gold" size={50} />
            </View>

            <View style={styles.summaryTrack}>
              <View
                style={[
                  styles.summaryFill,
                  { width: `${Math.max(10, avgMastery)}%` },
                ]}
              />
            </View>

            <View style={styles.summaryStatsRow}>
              <View style={styles.summaryPill}>
                <Text style={[styles.summaryStatVal, { color: brand.ink }]}>
                  {progress.length}
                </Text>
                <Text style={styles.summaryStatKey}>навыков</Text>
              </View>
              <View style={styles.summaryPill}>
                <Text style={[styles.summaryStatVal, { color: brand.goldInk }]}>
                  {totalAttempts}
                </Text>
                <Text style={styles.summaryStatKey}>попыток</Text>
              </View>
              <View style={styles.summaryPill}>
                <Text style={[styles.summaryStatVal, { color: brand.pine }]}>
                  {totalCorrect}
                </Text>
                <Text style={styles.summaryStatKey}>верных</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Чистые карточки отдельных компетенций */}
        {progress.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>
              Решите несколько кейсов — здесь появится ведомость ваших компетенций.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {progress.map((state, idx) => {
              const mastery = Math.round(state.mastery * 100);
              const confidence = Math.round(state.confidence * 100);
              const isHigh = mastery >= 70;
              const barColor = isHigh ? brand.pine : brand.gold;
              const numTone = isHigh ? 'pine' : 'gold';

              return (
                <View key={state.competency_id} style={styles.card}>
                  <View style={styles.row}>
                    <WaxSeal
                      label={ROMAN[idx] || String(idx + 1)}
                      size={44}
                      tone={numTone}
                    />
                    <View style={styles.skillHeaderBody}>
                      <View style={styles.skillTitleRow}>
                        <Text style={styles.cardTitle}>
                          Компетенция {idx + 1}
                        </Text>
                        <Text
                          style={[
                            styles.percent,
                            { color: isHigh ? brand.pine : brand.goldInk },
                          ]}
                        >
                          {mastery}%
                        </Text>
                      </View>
                      <View style={styles.track}>
                        <View
                          style={[
                            styles.fill,
                            {
                              width: `${Math.max(10, mastery)}%`,
                              backgroundColor: barColor,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.metaGrid}>
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipValue}>{state.attempts}</Text>
                      <Text style={styles.metaChipLabel}>Попыток</Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Text
                        style={[styles.metaChipValue, { color: brand.pine }]}
                      >
                        {state.correct_count}
                      </Text>
                      <Text style={styles.metaChipLabel}>Правильных</Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Text
                        style={[styles.metaChipValue, { color: brand.infoInk }]}
                      >
                        {confidence}%
                      </Text>
                      <Text style={styles.metaChipLabel}>Уверенность</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.btnPressed]}
          onPress={() => navigation.navigate('AdaptiveLearning')}
        >
          <Text style={styles.buttonText}>Продолжить обучение</Text>
        </Pressable>
      </View>
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
  error: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  stateBtn: {
    height: 46,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: brand.red,
    borderBottomWidth: 4,
    borderBottomColor: brand.redDark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    color: brand.muted,
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 28,
    gap: 14,
  },

  /* Сводная карточка наград/освоения */
  summaryBanner: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1.8,
    borderBottomWidth: 4,
    borderColor: brand.gold,
    padding: 18,
    gap: 12,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: brand.goldInk,
  },
  summaryBig: {
    fontSize: 32,
    fontWeight: '800',
    color: brand.ink,
    marginTop: 2,
  },
  summaryTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: brand.paper,
    overflow: 'hidden',
  },
  summaryFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: brand.gold,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryPill: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brand.rule,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 1,
  },
  summaryStatVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  summaryStatKey: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.subtext,
  },

  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: brand.rule,
    padding: 24,
    alignItems: 'center',
  },
  empty: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subtext,
    textAlign: 'center',
    lineHeight: 20,
  },

  list: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    padding: 15,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skillHeaderBody: {
    flex: 1,
    gap: 7,
  },
  skillTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  percent: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: brand.paper,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },

  metaGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metaChip: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 11,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 1,
  },
  metaChipValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  metaChipLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: brand.muted,
  },

  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.card,
    borderTopWidth: 1.5,
    borderTopColor: brand.rule,
  },
  button: {
    height: 52,
    borderRadius: 16,
    backgroundColor: brand.red,
    borderBottomWidth: 4,
    borderBottomColor: brand.redDark,
    alignItems: 'center',
    justifyContent: 'center',
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
});
