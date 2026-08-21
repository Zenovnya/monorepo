import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { progressApi } from '../api/progress';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { Confetti } from '../components/Confetti';
import { AnimatedButton } from '../components/AnimatedButton';
import { colors } from '../theme/colors';

export default function ResultScreen({ route, navigation }) {
  const { lesson, score } = route.params;
  const [completed, setCompleted] = useState(null);
  const [xpText, setXpText] = useState('+0 XP');

  const completeMutation = useMutation({
    mutationFn: (payload) => progressApi.complete(payload),
    onSuccess: (data) => {
      setCompleted(data);
      setXpText(`Лучший результат: ${data.best_score}%`);
    },
  });

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeMutation.mutate({ lesson_id: lesson.id, score });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crowns = completed?.crowns ?? 0;

  return (
    <View style={styles.container}>
      <Confetti active={!!completed} />

      <Text style={styles.title}>Урок пройден!</Text>
      <Text style={styles.subtitle}>Ты становишься сильнее ⚖️</Text>

      <View style={styles.mascot}>
        <AnimatedMascot />
      </View>

      <View style={styles.stats}>
        <StatCard label="Результат" value={`${score}%`} />
        <StatCard label="Короны" value={'👑'.repeat(crowns) || '—'} />
      </View>

      <View style={styles.crownsRow}>
        {[1, 2, 3].map((i) => (
          <Text
            key={i}
            style={[
              styles.crown,
              i <= crowns ? {} : styles.crownLocked,
            ]}
          >
            👑
          </Text>
        ))}
      </View>

      <View style={styles.footer}>
        <AnimatedButton title="На путь" onPress={() => navigation.popToTop()} />
      </View>
    </View>
  );
}

function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#B8860B' },
  subtitle: { fontSize: 15, color: colors.subtext, marginTop: 8 },
  mascot: { marginVertical: 24 },
  stats: { flexDirection: 'row', gap: 12, marginTop: 8 },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.subtext, marginTop: 4 },
  crownsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  crown: { fontSize: 36 },
  crownLocked: { opacity: 0.3 },
  footer: { alignSelf: 'stretch', marginTop: 32 },
});