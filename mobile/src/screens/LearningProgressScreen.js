import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { learningApi } from '../api/learning';
import { AnimatedButton } from '../components/AnimatedButton';
import { FadeInView } from '../components/motion/FadeInView';
import { ProgressBar } from '../components/ProgressBar';
import { ErrorState, LoadingState } from '../components/StateViews';
import { colors, radius, spacing, typography } from '../theme/tokens';

export default function LearningProgressScreen({ navigation }) {
  const { data: progress = [], isLoading, error, refetch } = useQuery({
    queryKey: ['learning-progress'],
    queryFn: learningApi.progress,
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LoadingState label="РЎС‡РёС‚Р°РµРј РїСЂРѕРіСЂРµСЃСЃвЂ¦" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState
          title="РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РїСЂРѕРіСЂРµСЃСЃ"
          message="РџСЂРѕРІРµСЂСЊ СЃРѕРµРґРёРЅРµРЅРёРµ Рё РїРѕРїСЂРѕР±СѓР№ СЃРЅРѕРІР°."
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  // РЎСЂРµРґРЅСЏСЏ РѕСЃРІРѕРµРЅРЅРѕСЃС‚СЊ вЂ” РєРѕСЂРѕС‚РєР°СЏ СЃРІРѕРґРєР° РЅР°Рґ СЃРїРёСЃРєРѕРј РєРѕРјРїРµС‚РµРЅС†РёР№.
  const overall = progress.length
    ? progress.reduce((sum, item) => sum + (item.mastery ?? 0), 0) / progress.length
    : 0;
  const totalCorrect = progress.reduce((sum, item) => sum + (item.correct_count ?? 0), 0);
  const totalAttempts = progress.reduce((sum, item) => sum + (item.attempts ?? 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>РњРћР™ РџР РћР“Р Р•РЎРЎ</Text>
        <Text style={styles.title}>РљРѕРјРїРµС‚РµРЅС†РёРё</Text>

        {progress.length === 0 ? (
          <FadeInView>
            <Text style={styles.empty}>
              РћС‚РІРµС‚СЊ РЅР° РЅРµСЃРєРѕР»СЊРєРѕ РєРµР№СЃРѕРІ вЂ” Р·РґРµСЃСЊ РїРѕСЏРІРёС‚СЃСЏ С‚РІРѕР№ РїСЂРѕРіСЂРµСЃСЃ.
            </Text>
          </FadeInView>
        ) : (
          <>
            <FadeInView>
              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryValue}>{Math.round(overall * 100)}%</Text>
                  <Text style={styles.summaryLabel}>РѕСЃРІРѕРµРЅРѕ РІ СЃСЂРµРґРЅРµРј</Text>
                </View>
                <ProgressBar value={overall} />
                <Text style={styles.summaryMeta}>
                  РџСЂР°РІРёР»СЊРЅС‹С… РѕС‚РІРµС‚РѕРІ: {totalCorrect} РёР· {totalAttempts}
                </Text>
              </View>
            </FadeInView>

            {progress.map((state, index) => {
              const mastery = Math.round((state.mastery ?? 0) * 100);
              return (
                <FadeInView key={state.competency_id} index={index + 1}>
                  <View style={styles.card}>
                    <View style={styles.row}>
                      <Text style={styles.cardTitle}>{state.name ?? 'РљРѕРјРїРµС‚РµРЅС†РёСЏ'}</Text>
                      <Text style={styles.percent}>{mastery}%</Text>
                    </View>
                    <ProgressBar value={mastery / 100} />
                    <Text style={styles.meta}>
                      РџРѕРїС‹С‚РѕРє: {state.attempts} В· РїСЂР°РІРёР»СЊРЅС‹С…: {state.correct_count} В· СѓРІРµСЂРµРЅРЅРѕСЃС‚СЊ:{' '}
                      {Math.round((state.confidence ?? 0) * 100)}%
                    </Text>
                  </View>
                </FadeInView>
              );
            })}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <AnimatedButton
          title="РџСЂРѕРґРѕР»Р¶РёС‚СЊ РѕР±СѓС‡РµРЅРёРµ"
          onPress={() => navigation.navigate('AdaptiveLearning')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.base, paddingBottom: 120 },
  eyebrow: { ...typography.micro, color: colors.accent, textTransform: 'uppercase' },
  title: {
    ...typography.display,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  summary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 3,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.md + 2,
    gap: spacing.md,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  summaryValue: { ...typography.display, color: colors.success },
  summaryLabel: { ...typography.caption, fontWeight: '600', color: colors.subtext, flex: 1 },
  summaryMeta: { ...typography.caption, fontWeight: '600', color: colors.subtext },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 3,
    borderRadius: radius.lg,
    padding: spacing.base - 1,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...typography.heading, color: colors.text, flex: 1 },
  percent: { ...typography.heading, color: colors.success },
  meta: { ...typography.caption, fontWeight: '600', color: colors.subtext },
  empty: { ...typography.body, color: colors.subtext },
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
