import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { useMascot } from '../hooks/useMascot';
import { gamificationApi } from '../api/gamification';
import { colors, radius, sizes, spacing, typography } from '../theme/tokens';

/**
 * Экран «Кабинет мишки» LexBear.
 */
export default function BearScreen() {
  const user = useAuthStore((s) => s.user);

  const [pose, setPose] = useState(user?.streak >= 7 ? 'cheer' : user?.streak >= 3 ? 'wave' : 'think');
  const [tab, setTab] = useState('pet');
  const [busy, setBusy] = useState(false);
  const [speech, setSpeech] = useState(null);

  // Геймификация: счётчик поглаживаний и фразы маскота через API.
  const { pet, petCount, react, isLoadingPet } = useMascot();

  // Актуальная геймификация пользователя (XP, уровень, стрик).
  const { data: gamification } = useQuery({
    queryKey: ['gamification-me'],
    queryFn: gamificationApi.me,
  });

  const handlePet = async () => {
    setBusy(true);
    setPose('cheer');
    try {
      await pet();
      // Реакция маскота после поглаживания.
      const phrase = await react('pet');
      if (phrase?.phrase) setSpeech(phrase.phrase);
    } catch {
      // Игнорируем — мишка всё равно рад.
    } finally {
      setTimeout(() => {
        setPose('wave');
        setBusy(false);
      }, 900);
    }
  };

  const mood = user?.bear_mood ?? 80;
  const hunger = user?.bear_hunger ?? 70;
  const bearLevel = gamification?.level ?? user?.bear_level ?? 1;
  const streak = gamification?.streak ?? user?.streak ?? 0;

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
          {speech && (
            <View style={styles.speechBubble}>
              <Text style={styles.speechText}>{speech}</Text>
            </View>
          )}
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
          disabled={busy || isLoadingPet}
          onPress={handlePet}
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
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'pet' && (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Настроение зависит от стрика</Text>
          <Text style={styles.infoText}>
            Занимайся каждый день — мишка бодр и в форме.
          </Text>
          <Text style={[styles.infoText, styles.infoTextSpaced]}>
            Поглаживаний: <Text style={{ fontWeight: '900' }}>{petCount}</Text>
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
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.base, paddingBottom: spacing.xxl * 3 },

  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1 },
  headerMeta: {
    ...typography.micro,
    color: colors.subtext,
    textTransform: 'uppercase',
  },
  headerTitle: { ...typography.title, color: colors.text },
  streakChip: {
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.streakTint,
  },
  streakText: { ...typography.caption, color: colors.text },

  room: {
    marginTop: spacing.md,
    height: 360,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.roomFloor,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  roomFloor: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: colors.roomWood,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  bearWrap: { marginBottom: 40, alignItems: 'center' },
  speechBubble: {
    position: 'absolute',
    top: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: 280,
  },
  speechText: { ...typography.caption, color: colors.text, textAlign: 'center' },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base },
  statBar: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  statLabel: {
    ...typography.micro,
    color: colors.subtext,
    textTransform: 'uppercase',
    marginBottom: spacing.xs + 2,
  },
  statTrack: {
    height: 10,
    backgroundColor: colors.track,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  statFill: { height: '100%', borderRadius: radius.pill },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base },
  actionBtn: {
    flex: 1,
    height: sizes.minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGreen: { backgroundColor: colors.success },
  btnWhite: { backgroundColor: colors.surfaceRaised },
  actionBtnText: { ...typography.caption, color: colors.card },
  actionBtnDarkText: { ...typography.caption, color: colors.text },

  tabs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  tab: {
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  tabActive: { backgroundColor: colors.border },
  tabText: { ...typography.caption, color: colors.text },
  tabTextActive: { color: colors.card },

  infoCard: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginTop: spacing.md,
  },
  infoTitle: { ...typography.bodyStrong, color: colors.text, marginBottom: spacing.xs },
  infoText: { ...typography.caption, color: colors.subtext },
  infoTextSpaced: { marginTop: spacing.sm },

  wearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  wearItem: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wearIcon: { fontSize: 28 },
  lock: { position: 'absolute', top: spacing.xs, right: spacing.xs, fontSize: 12 },

  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  roomItem: {
    width: '30%',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  roomIcon: { fontSize: 26 },
  roomLabel: { ...typography.micro, color: colors.text, marginTop: spacing.xs },
});

