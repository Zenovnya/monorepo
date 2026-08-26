import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useAuthStore } from '../store';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { colors } from '../theme/colors';

const leagues = ['Бронза', 'Серебро', 'Золото', 'Мантия', 'Фемида'];

const fake = [
  { name: 'Артём К.', xp: 340 },
  { name: 'Мария С.', xp: 315 },
  { name: 'Ты', xp: 0, me: true },
  { name: 'Игорь Д.', xp: 260 },
  { name: 'Полина В.', xp: 245 },
  { name: 'Никита М.', xp: 220 },
  { name: 'Алина Ф.', xp: 200 },
  { name: 'Сергей Т.', xp: 190 },
  { name: 'Кристина О.', xp: 170 },
  { name: 'Роман Б.', xp: 155 },
];

export default function LeagueScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);
  const board = fake
    .map((f) => (f.me ? { ...f, xp: user?.xp ?? 0, name: user?.name || 'Ты' } : f))
    .sort((a, b) => b.xp - a.xp);
  const league = user?.league || 'Бронза';
  const nextIdx = Math.min(leagues.length - 1, leagues.indexOf(league) + 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Лига</Text>
      </View>

      <View style={styles.hero}>
        <AnimatedMascot size={64} emotion="cheer" />
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>{league}</Text>
          <Text style={styles.heroSubtitle}>Топ 5 идут в {leagues[nextIdx]}</Text>
        </View>
      </View>

      <View style={styles.leagueChips}>
        {leagues.map((l) => (
          <View
            key={l}
            style={[styles.leagueChip, l === league && styles.leagueChipActive]}
          >
            <Text style={[styles.leagueChipText, l === league && { color: '#fff' }]}>{l}</Text>
          </View>
        ))}
      </View>

      <View style={styles.list}>
        {board.map((r, i) => (
          <View
            key={r.name + i}
            style={[styles.row, r.me && styles.rowMe]}
          >
            <View
              style={[
                styles.rank,
                {
                  backgroundColor:
                    i === 0 ? '#C9A227' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : colors.card,
                },
              ]}
            >
              <Text style={[styles.rankText, { color: i < 3 ? '#fff' : colors.text }]}>
                {i + 1}
              </Text>
            </View>
            <Text style={[styles.rowName, r.me && { fontWeight: '900' }]}>{r.name}</Text>
            <Text style={styles.rowXp}>{r.xp} XP</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  title: { fontSize: 26, fontWeight: '900', color: colors.text },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF7DE',
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
  },
  heroTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  heroSubtitle: { fontSize: 14, color: colors.subtext, marginTop: 2 },
  leagueChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  leagueChip: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  leagueChipActive: { backgroundColor: colors.accent },
  leagueChipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  list: { marginTop: 16, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.track,
    borderRadius: 14,
    padding: 12,
  },
  rowMe: { backgroundColor: '#E8F6EE', borderColor: colors.success },
  rank: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 15, fontWeight: '900' },
  rowName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  rowXp: { fontSize: 14, fontWeight: '700', color: colors.subtext },
});