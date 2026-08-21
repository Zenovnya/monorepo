import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { gamificationApi } from '../api/gamification';
import { progressApi } from '../api/progress';
import { useMascot } from '../hooks/useMascot';
import { colors } from '../theme/colors';

export default function ProfileScreen({ navigation }) {
  const user = useAuthStore((state) => state.user);
  const mascot = useMascot();

  const { data: gamification, isLoading } = useQuery({
    queryKey: ['gamification'],
    queryFn: gamificationApi.me,
  });

  const { data: progress } = useQuery({
    queryKey: ['progress-me'],
    queryFn: progressApi.me,
  });

  const achievements = gamification?.achievements ?? [];

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const levelXp = gamification?.xp ?? 0;
  const nextLevelXp = gamification?.next_level_xp || 100;
  const xpProgress = Math.min(100, Math.round((levelXp / nextLevelXp) * 100));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Профиль</Text>

      {/* Header с пользователем и маскотом */}
      <View style={styles.headerCard}>
        <AnimatedMascot />
        <View style={styles.userInfo}>
          <Text style={styles.username}>{user?.username || user?.email || 'Юрист'}</Text>
          <Text style={styles.level}>Уровень {gamification?.level ?? 1}</Text>
        </View>
      </View>

      {/* Статистика */}
      <View style={styles.statsRow}>
        <StatCard icon="🔥" value={gamification?.streak ?? 0} label="Стрик" />
        <StatCard icon="⭐" value={gamification?.xp ?? 0} label="XP" />
        <StatCard icon="💎" value={gamification?.gems ?? 0} label="Гемы" />
        <StatCard
          icon="✅"
          value={progress?.total_completed ?? 0}
          label="Уроки"
        />
      </View>

      {/* Прогресс уровня */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Прогресс уровня</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${xpProgress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {levelXp} / {nextLevelXp} XP до следующего уровня
        </Text>
      </View>

      {/* Достижения */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Достижения</Text>
        {achievements.length === 0 ? (
          <Text style={styles.emptyText}>
            Пока нет достижений. Погладь Lex 10 раз, чтобы получить «Друг Lex»!
          </Text>
        ) : (
          achievements.map((a) => (
            <View key={a.code} style={styles.achievement}>
              <Text style={styles.achievementTitle}>🏅 {a.title}</Text>
              <Text style={styles.achievementDesc}>{a.description}</Text>
            </View>
          ))
        )}
        {mascot.petCount > 0 && (
          <View style={styles.petProgress}>
            <Text style={styles.petProgressText}>
              🐻 Поглаживаний Lex: {mascot.petCount} / 10
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.logoutBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.logoutText}>⚙️ Настройки</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, value, label }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 16 },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 18,
    gap: 16,
  },
  userInfo: { flex: 1 },
  username: { fontSize: 20, fontWeight: '800', color: colors.text },
  level: { fontSize: 14, color: colors.subtext, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
  },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 },
  statLabel: { fontSize: 11, color: colors.subtext, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    marginTop: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },
  progressTrack: {
    height: 12,
    backgroundColor: '#E6DFCE',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 6 },
  progressText: { fontSize: 12, color: colors.subtext, marginTop: 8 },
  emptyText: { fontSize: 13, color: colors.subtext, lineHeight: 20 },
  achievement: { marginBottom: 12 },
  achievementTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  achievementDesc: { fontSize: 13, color: colors.subtext, marginTop: 2 },
  petProgress: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E6DFCE' },
  petProgressText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  footer: { marginTop: 24 },
  logoutBtn: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: colors.text },
});