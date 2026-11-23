import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,

} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store';
import { gamificationApi } from '../api/gamification';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { describeLoadError } from '../api/client';
import { PressableScale } from '../components/PressableScale';
import {
  brand,
  KhokhlomaCorners,
  KhokhlomaDivider,
  WaxSeal,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

const leagues = ['Бронза', 'Серебро', 'Золото', 'Мантия', 'Фемида'];

const SHIELD_META = {
  Бронза: { icon: '🥉', bg: '#B07443', lip: '#85532A' },
  Серебро: { icon: '🥈', bg: '#8C969E', lip: '#69737B' },
  Золото: { icon: '🥇', bg: brand.gold, lip: brand.goldDark },
  Мантия: { icon: '⚖️', bg: brand.red, lip: brand.redDark },
  Фемида: { icon: '👑', bg: brand.ink, lip: brand.inkDeep },
};

const AVATAR_COLORS = [brand.red, brand.gold, brand.pine, brand.ink, '#9A5B32'];

/**
 * Экран «Лига» (LeagueScreen):
 * наградная карточка дивизиона в красно-золотой рамке хохломы,
 * золотые счётчики XP (#D9A849), хвойная зона повышения (#315B46)
 * и чистая таблица участников на сливочной бумаге (#F7EFDF).
 */
export default function LeagueScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  // Реальная ведомость лиги с бэкенда. Раньше здесь был захардкоженный
  // список выдуманных людей, и «Ты» с 0 XP стоял посреди чужих результатов.
  const { data: leaderboard, isLoading, error, refetch } = useQuery({
    queryKey: ['gamification-leaderboard'],
    queryFn: () => gamificationApi.leaderboard(30),
  });

  const entries = leaderboard?.entries ?? [];
  const board = entries.map((e) => ({
    name: e.name,
    xp: e.xp,
    me: e.is_me,
    level: e.level,
    position: e.position,
  }));
  const league = leaderboard?.league || user?.league || 'Бронза';
  const curIdx = Math.max(0, leagues.indexOf(league));
  const nextIdx = Math.min(leagues.length - 1, leagues.indexOf(league) + 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <PaperGrain />

      {/* Шапка */}
      <View style={styles.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={[
            styles.backBtn,
          ]}
        >
          <Text style={styles.backText}>←</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.headerKicker}>§ ТУРНИР НЕДЕЛИ</Text>
          <Text style={styles.title}>Лига</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Наградной картуш лиги с точечными уголками хохломы */}
      <View style={styles.shieldsBanner}>
        <KhokhlomaCorners variant="light" size="md" inset={8} />

        <View style={styles.shieldsRow}>
          {leagues.map((l, idx) => {
            const isCur = l === league;
            const isLocked = idx > curIdx;
            const meta = SHIELD_META[l] || SHIELD_META.Бронза;
            return (
              <View key={l} style={styles.shieldCol}>
                <View
                  style={[
                    styles.shield,
                    isCur && styles.shieldCurrent,
                    isLocked
                      ? styles.shieldLocked
                      : {
                          backgroundColor: meta.bg,
                          borderBottomColor: meta.lip,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.shieldEmoji,
                      isCur && styles.shieldEmojiCurrent,
                    ]}
                  >
                    {isLocked ? '🔒' : meta.icon}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.shieldLabel,
                    isCur && styles.shieldLabelCurrent,
                  ]}
                  numberOfLines={1}
                >
                  {l}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.heroTitle}>{league}</Text>
        <Text style={styles.heroSubtitle}>
          Топ 5 переходят в лигу «{leagues[nextIdx]}»
        </Text>

        <KhokhlomaDivider style={styles.bannerDivider} />

        <View style={styles.mascotCheerPill}>
          <AnimatedMascot size={50} emotion="cheer" />
          <Text style={styles.mascotCheerText}>
            Набирайте XP в уроках и поднимайтесь выше в ведомости!
          </Text>
        </View>
      </View>

      {/* Чистая ведомость участников */}
      <View style={styles.list}>
        {isLoading && board.length === 0 ? (
          <LoadingState compact label="Загружаем ведомость лиги…" />
        ) : null}

        {/* Раньше ошибка загрузки выглядела как «в лиге никого нет»: пустая
            ведомость вместо причины. */}
        {!isLoading && error && board.length === 0 ? (
          <ErrorState
            compact
            title="Не удалось загрузить ведомость"
            message={describeLoadError(error, 'лигу')}
            onRetry={() => refetch()}
          />
        ) : null}

        {!isLoading && !error && board.length === 0 ? (
          <EmptyState
            compact
            title="В лиге пока никого нет"
            message="Пройдите урок — и возглавите ведомость."
          />
        ) : null}

        {board.map((r, i) => {
          const isTop3 = i < 3;
          const sealTone = i === 0 ? 'gold' : i === 1 ? 'red' : 'pine';
          const avatarBg = r.me
            ? brand.red
            : AVATAR_COLORS[i % AVATAR_COLORS.length];
          const initial = (r.name || '?').trim().charAt(0).toUpperCase();

          return (
            <React.Fragment key={r.name + i}>
              <View style={[styles.row, r.me && styles.rowMe]}>
                {isTop3 ? (
                  <WaxSeal
                    label={String(i + 1)}
                    size={32}
                    tone={sealTone}
                  />
                ) : (
                  <View style={styles.rankPlain}>
                    <Text
                      style={[
                        styles.rankPlainText,
                        i < 5 && { color: brand.pine },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  </View>
                )}

                <View
                  style={[styles.userAvatar, { backgroundColor: avatarBg }]}
                >
                  <Text
                    style={[
                      styles.userAvatarText,
                      avatarBg === brand.gold && { color: brand.ink },
                    ]}
                  >
                    {initial}
                  </Text>
                </View>

                <Text
                  style={[styles.rowName, r.me && styles.rowNameMe]}
                  numberOfLines={1}
                >
                  {r.name}
                </Text>

                <View style={[styles.xpBadge, r.me && styles.xpBadgeMe]}>
                  <Text style={styles.rowXp}>{r.xp} XP</Text>
                </View>
              </View>

              {i === 4 && (
                <View style={styles.promoDivider}>
                  <View style={styles.promoLine} />
                  <Text style={styles.promoText}>▲ Зона повышения ▲</Text>
                  <View style={styles.promoLine} />
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.subtext,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 48,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    transform: [{ translateY: 1.5 }],
  },
  backText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerKicker: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
    color: brand.muted,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.text,
  },
  headerSpacer: {
    width: 38,
  },

  /* Наградной картуш с рамкой хохломы */
  shieldsBanner: {
    position: 'relative',
    marginHorizontal: 18,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1.8,
    borderBottomWidth: 4,
    borderColor: brand.gold,
    alignItems: 'center',
  },
  shieldsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 2,
    marginBottom: 12,
  },
  shieldCol: {
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  shield: {
    width: 48,
    height: 50,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: brand.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldCurrent: {
    width: 58,
    height: 60,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: brand.gold,
  },
  shieldLocked: {
    backgroundColor: colors.paper,
    borderBottomColor: brand.ruleStrong,
    opacity: 0.72,
  },
  shieldEmoji: {
    fontSize: 19,
  },
  shieldEmojiCurrent: {
    fontSize: 24,
  },
  shieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: brand.muted,
  },
  shieldLabelCurrent: {
    fontWeight: '800',
    color: brand.ink,
  },

  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  heroSubtitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: brand.pine,
    marginTop: 2,
  },
  bannerDivider: {
    marginVertical: 12,
  },
  mascotCheerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: brand.rule,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mascotCheerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 17.5,
  },

  /* Таблица */
  list: {
    marginHorizontal: 18,
    marginTop: 14,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.rule,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowMe: {
    backgroundColor: brand.goldSoft,
    borderColor: brand.gold,
  },
  rankPlain: {
    width: 32,
    alignItems: 'center',
  },
  rankPlainText: {
    fontSize: 14,
    fontWeight: '800',
    color: brand.muted,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: brand.creamText,
    fontSize: 14,
    fontWeight: '800',
  },
  rowName: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.text,
  },
  rowNameMe: {
    fontWeight: '800',
    color: brand.ink,
  },
  xpBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: brand.goldSoft,
  },
  xpBadgeMe: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: brand.gold,
  },
  rowXp: {
    fontSize: 12.5,
    fontWeight: '800',
    color: brand.goldInk,
  },

  promoDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  promoLine: {
    flex: 1,
    height: 1,
    backgroundColor: brand.pineBorder,
  },
  promoText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: brand.pine,
  },
});
