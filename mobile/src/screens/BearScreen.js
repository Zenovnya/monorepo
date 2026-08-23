import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../api/user';
import { useAuthStore } from '../store';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { colors } from '../theme/colors';

/**
 * Экран «Кабинет мишки» LexBear.
 */
export default function BearScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [pose, setPose] = useState(user?.streak >= 7 ? 'cheer' : user?.streak >= 3 ? 'wave' : 'think');
  const [tab, setTab] = useState('pet');
  const [busy, setBusy] = useState(false);

  const petMutation = useMutation({
    mutationFn: userApi.petBear,
    onMutate: () => {
      setBusy(true);
      setPose('cheer');
    },
    onSuccess: (data) => {
      // Обновляем пользователя в сторе новым настроением мишки.
      setUser({ bear_mood: data.bear_mood });
      queryClient.invalidateQueries(['gamification']);
    },
    onSettled: () => {
      setTimeout(() => {
        setPose('wave');
        setBusy(false);
      }, 900);
    },
  });

  const mood = user?.bear_mood ?? 80;
  const hunger = user?.bear_hunger ?? 70;
  const bearLevel = user?.bear_level ?? 1;
  const streak = user?.streak ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerMeta}>Кабинет</Text>
          <Text style={styles.headerTitle}>Мишка · Уровень {bearLevel}</Text>
        </View>
        <View style={styles.streakChip}>
          <Text style={styles.streakText}>🔥 {streak}</Text>
        </View>
      </View>

      {/* Комната */}
      <View style={styles.room}>
        <View style={styles.roomFloor} />
        <View style={styles.bearWrap}>
          <AnimatedMascot size={240} emotion={pose} />
        </View>
      </View>

      {/* Статистика */}
      <View style={styles.statsRow}>
        <StatBar label="Настрой" value={mood} color={colors.success} />
        <StatBar label="Знания" value={hunger} color={colors.accent} />
        <StatBar label="Уровень" value={(bearLevel % 10) * 10} color={colors.skyDark} />
      </View>

      {/* Действия */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, styles.btnGreen, busy && { opacity: 0.6 }]}
          disabled={busy}
          onPress={() => petMutation.mutate()}
        >
          <Text style={styles.actionBtnText}>👋 Погладить</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.btnWhite]} onPress={() => setTab('wear')}>
          <Text style={styles.actionBtnDarkText}>👔 Надеть</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.btnWhite]} onPress={() => setTab('room')}>
          <Text style={styles.actionBtnDarkText}>🏠 Комната</Text>
        </Pressable>
      </View>

      {/* Табы */}
      <View style={styles.tabs}>
        {[['pet', 'О мишке'], ['wear', 'Костюм'], ['room', 'Комната']].map(([k, l]) => (
          <Pressable
            key={k}
            style={[styles.tab, tab === k && styles.tabActive]}
            onPress={() => setTab(k)}
          >
            <Text style={[styles.tabText, tab === k && { color: '#fff' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'pet' && (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Настроение зависит от стрика</Text>
          <Text style={styles.infoText}>
            Занимайся каждый день — мишка бодр и в форме.
          </Text>
        </View>
      )}
      {tab === 'wear' && (
        <View style={styles.wearGrid}>
          {['🎀', '👓', '🔨', '📕', '🎩', '🧣', '🏅', '⚖️'].map((icon, i) => (
            <View key={i} style={[styles.wearItem, i > 2 && { opacity: 0.5 }]}>
              <Text style={styles.wearIcon}>{icon}</Text>
              {i > 2 && <Text style={styles.lock}>🔒</Text>}
            </View>
          ))}
        </View>
      )}
      {tab === 'room' && (
        <View style={styles.roomGrid}>
          {['Кабинет', 'Библиотека', 'Суд', 'Дача', 'Кремль', 'Космос'].map((n, i) => (
            <View key={n} style={[styles.roomItem, i > 0 && { opacity: 0.5 }]}>
              <Text style={styles.roomIcon}>🏛️</Text>
              <Text style={styles.roomLabel}>{n}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function StatBar({ label, value, color }) {
  return (
    <View style={styles.statBar}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statTrack}>
        <View style={[styles.statFill, { width: `${Math.max(6, Math.min(100, value))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerMeta: { fontSize: 12, fontWeight: '800', color: colors.subtext, textTransform: 'uppercase' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  streakChip: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: '#FFF4D1' },
  streakText: { fontSize: 14, fontWeight: '800', color: colors.text },
  room: {
    marginTop: 12,
    height: 360,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: '#EFE3C8',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  roomFloor: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: '#5A3620', borderTopWidth: 3, borderTopColor: colors.border },
  bearWrap: { marginBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  statBar: { flex: 1, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.track, borderRadius: 12, padding: 8 },
  statLabel: { fontSize: 11, fontWeight: '800', color: colors.subtext, textTransform: 'uppercase', marginBottom: 6 },
  statTrack: { height: 10, backgroundColor: colors.track, borderRadius: 5, overflow: 'hidden' },
  statFill: { height: '100%', borderRadius: 5 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGreen: { backgroundColor: colors.success },
  btnWhite: { backgroundColor: colors.card },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  actionBtnDarkText: { color: colors.text, fontWeight: '800', fontSize: 14 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 20 },
  tab: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  tabActive: { backgroundColor: colors.border },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.text },
  infoCard: { backgroundColor: colors.card, borderWidth: 3, borderColor: colors.border, borderRadius: 18, padding: 16, marginTop: 12 },
  infoTitle: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: 4 },
  infoText: { fontSize: 14, color: colors.subtext, lineHeight: 20 },
  wearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  wearItem: { width: '22%', aspectRatio: 1, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.track, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  wearIcon: { fontSize: 28 },
  lock: { position: 'absolute', top: 4, right: 6, fontSize: 12 },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  roomItem: { width: '30%', backgroundColor: colors.card, borderWidth: 2, borderColor: colors.track, borderRadius: 14, padding: 12, alignItems: 'center' },
  roomIcon: { fontSize: 26 },
  roomLabel: { fontSize: 11, fontWeight: '700', color: colors.text, marginTop: 4 },
});