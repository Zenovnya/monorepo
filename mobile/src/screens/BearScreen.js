import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { PressableScale } from '../components/PressableScale';
import { TactilePressable } from '../components/TactilePressable';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { useMascot } from '../hooks/useMascot';
import { gamificationApi } from '../api/gamification';
import {
  brand,
  serifFamily,
  KhokhlomaGarland,
  KhokhlomaCorners,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Экран «Кабинет мишки» (BearScreen):
 * тёплый кабинет юриста на сливочной бумаге (#F7EFDF) с точечным красно-золотым
 * карнизом хохломы, живым скелетным мишкой на Reanimated и лаково-красной
 * главной кнопкой «ПОГЛАДИТЬ» (#C9362B).
 */

/**
 * Всплывающее сердечко «Поглаживания» (анимация при тапе).
 *
 * Поднимается, растёт и исчезает — как поощрение в Duolingo.
 */
function HeartBurst({ visible }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);
  const y = useSharedValue(0);

  React.useEffect(() => {
    if (!visible) return;
    opacity.value = withTiming(1, { duration: 150 });
    scale.value = withSpring(1, { damping: 12, stiffness: 220 });
    y.value = withSequence(
      withTiming(-24, { duration: 300, easing: Animated.Easing.out(Animated.Easing.quad) }),
      withTiming(-58, { duration: 320, easing: Animated.Easing.in(Animated.Easing.quad) })
    );
  }, [visible, opacity, scale, y]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: y.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.heart, animatedStyle]} pointerEvents="none">
      <Text style={styles.heartText}>❤️</Text>
    </Animated.View>
  );
}

export default function BearScreen() {
  const user = useAuthStore((s) => s.user);

  const [pose, setPose] = useState(
    user?.streak >= 3 ? 'neutral' : 'thinking'
  );
  const [tab, setTab] = useState('pet');
  const [busy, setBusy] = useState(false);
  const [speech, setSpeech] = useState(null);
  const [burst, setBurst] = useState(0);

  const { pet, petCount, react, isLoadingPet } = useMascot();

  const { data: gamification } = useQuery({
    queryKey: ['gamification-me'],
    queryFn: gamificationApi.me,
  });

  const handlePet = async () => {
    setBusy(true);
    setPose('cheer');
    if (petCount > 0) setBurst((n) => n + 1);
    try {
      await pet();
      const phrase = await react('pet');
      if (phrase?.phrase) setSpeech(phrase.phrase);
    } catch {
      // Игнорируем — мишка всё равно рад.
    } finally {
      setTimeout(() => {
        setPose('neutral');
        setBusy(false);
      }, 1800);
    }
  };

  const mood = user?.bear_mood ?? 80;
  const hunger = user?.bear_hunger ?? 70;
  const bearLevel = gamification?.level ?? user?.bear_level ?? 1;
  const streak = gamification?.streak ?? user?.streak ?? 0;

  return (
    <ScreenWrapper scroll contentStyle={styles.content}>
      <PaperGrain />

      {/* Шапка кабинета с золотой наградой стрика */}
      <View style={styles.header}>
        <View style={styles.headerBody}>
          <Text style={styles.headerMeta}>§ КАБИНЕТ МИШКИ</Text>
          <Text style={styles.headerTitle}>Уровень {bearLevel}</Text>
        </View>
        <View style={styles.streakChip}>
          <Text style={styles.streakFire}>🔥</Text>
          <Text style={styles.streakText}>{streak}</Text>
        </View>
      </View>

      {/* Сцена кабинета юриста: лаково-золотой карниз хохломы, сливочный ореол и дубовый пол */}
      <View style={styles.room}>
        <View style={styles.corniceBar}>
          <KhokhlomaGarland variant="onRed" count={6} />
        </View>

        <View style={styles.roomHalo} />
        <View style={styles.roomHaloInner} />

        <View style={styles.roomBaseboard} />
        <View style={styles.roomFloor}>
          <View style={styles.roomRug}>
            <View style={styles.roomRugInner} />
          </View>
        </View>

        {speech ? (
          <View style={styles.speechWrap}>
            <View style={styles.speechBubble}>
              <Text style={styles.speechText}>{speech}</Text>
            </View>
            <View style={styles.speechTail} />
          </View>
        ) : (
          <View style={styles.nameplatePill}>
            <Text style={styles.nameplateSign}>§</Text>
            <Text style={styles.nameplateText}>СТРЯПЧИЙ LEXBEAR</Text>
          </View>
        )}

        <TactilePressable
          style={styles.bearWrap}
          onPress={() => {
            setPose('wave');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setTimeout(() => setPose('neutral'), 600);
          }}
          haptic
          hapticStyle="medium"
          scale={0.97}
        >
          <AnimatedMascot
            size={222}
            emotion={pose}
            wave={pose === 'neutral' || pose === 'wave'}
          />
        </TactilePressable>
      </View>

      {/* 3 чистые карточки показателей: хвойный · золотой · приглушённый синий */}
      <View style={styles.statsRow}>
        <StatBar
          label="Настрой"
          value={mood}
          barColor={brand.pine}
          textColor={brand.pine}
        />
        <StatBar
          label="Знания"
          value={hunger}
          barColor={brand.gold}
          textColor={brand.goldInk}
        />
        <StatBar
          label="Опыт"
          value={(bearLevel % 10) * 10}
          barColor={brand.info}
          textColor={brand.infoInk}
        />
      </View>

      {/* Главная кнопка действия — 3D-кнопка TactilePressable.
          Ноль поглаживаний: серо-бежевый #E5DEC9, подсказка «Пройдите 1 урок…».
          Более одного: терракота с золотым badge и анимация сердечек. */}
      <TactilePressable
        style={[
          styles.petBtn,
          petCount === 0 ? styles.petBtnIdle : null,
          (busy || isLoadingPet) && styles.btnBusy,
        ]}
        disabled={busy || isLoadingPet || petCount === 0}
        onPress={handlePet}
        haptic
        hapticStyle="light"
        scale={0.95}
      >
        <Text style={[styles.petBtnText, petCount === 0 ? styles.petBtnTextIdle : null]}>
          {petCount === 0 ? '👋 Погладить' : '❤️ Погладить'}
        </Text>
        <View style={styles.petBadge}>
          <Text style={styles.petBadgeText}>{petCount}</Text>
        </View>
      </TactilePressable>
      <HeartBurst key={burst} visible />
      {petCount === 0 ? (
        <Text style={styles.petHint}>Пройдите 1 урок, чтобы разбудить лапу дружбы.</Text>
      ) : null}

      {/* Чистые вкладки кабинета */}
      <View style={styles.tabs}>
        {[
          ['pet', 'О мишке'],
          ['wear', 'Гардероб'],
          ['room', 'Кабинет'],
        ].map(([k, l]) => {
          const active = tab === k;
          return (
            <PressableScale
              key={k}
              style={[
                styles.tab,
                active && styles.tabActive,
              ]}
              onPress={() => setTab(k)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {l}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {tab === 'pet' && (
        <View style={styles.infoCard}>
          <View style={styles.infoBadge}>
            <Text style={styles.infoBadgeText}>🔥</Text>
          </View>
          <View style={styles.infoBody}>
            <Text style={styles.infoTitle}>Настроение зависит от стрика</Text>
            <Text style={styles.infoText}>
              Занимайтесь каждый день — мишка бодр, собран и готов к новым делам.
            </Text>
            <View style={styles.petStatPill}>
              <Text style={styles.petStatText}>
                Поглаживаний: {petCount}
              </Text>
            </View>
          </View>
        </View>
      )}

      {tab === 'wear' && (
        <View style={styles.wearGrid}>
          {['🎀', '👓', '🔨', '📕', '🎩', '🧣', '🏅', '⚖️'].map((icon, i) => {
            const locked = i > 2;
            return (
              <View
                key={i}
                style={[
                  styles.wearItem,
                  locked ? styles.tileLocked : styles.tileUnlocked,
                ]}
              >
                {!locked ? (
                  <KhokhlomaCorners variant="light" size="sm" inset={4} />
                ) : null}
                <Text style={styles.wearIcon}>{icon}</Text>
                {locked && <Text style={styles.lock}>🔒</Text>}
              </View>
            );
          })}
        </View>
      )}

      {tab === 'room' && (
        <View style={styles.roomGrid}>
          {['Кабинет', 'Библиотека', 'Суд', 'Усадьба', 'Сенат', 'Архив'].map(
            (n, i) => {
              const locked = i > 0;
              return (
                <View
                  key={n}
                  style={[
                    styles.roomItem,
                    locked ? styles.tileLocked : styles.roomItemActive,
                  ]}
                >
                  {!locked ? (
                    <KhokhlomaCorners variant="light" size="sm" inset={5} />
                  ) : null}
                  <Text style={styles.roomIcon}>🏛️</Text>
                  <Text style={styles.roomLabel} numberOfLines={1}>
                    {n}
                  </Text>
                  {locked && <Text style={styles.lock}>🔒</Text>}
                </View>
              );
            }
          )}
        </View>
      )}
    </ScreenWrapper>
  );
}

function StatBar({ label, value, barColor, textColor }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statVal, { color: textColor }]}>{pct}%</Text>
      <View style={styles.statTrack}>
        <View
          style={[
            styles.statFill,
            { width: `${Math.max(pct, 8)}%`, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 112,
    gap: 13,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBody: {
    gap: 2,
  },
  headerMeta: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    color: brand.muted,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: brand.goldSoft,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.gold,
  },
  streakFire: {
    fontSize: 16,
  },
  streakText: {
    fontSize: 15,
    fontWeight: '800',
    color: brand.goldInk,
  },

  /* Сцена кабинета */
  room: {
    position: 'relative',
    height: 294,
    borderRadius: 24,
    backgroundColor: '#F3E8D2',
    borderWidth: 1.8,
    borderBottomWidth: 4,
    borderColor: brand.goldBorder,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  corniceBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 7,
    paddingBottom: 3,
    backgroundColor: brand.red,
    borderBottomWidth: 2,
    borderBottomColor: brand.gold,
    zIndex: 3,
  },
  roomHalo: {
    position: 'absolute',
    top: 46,
    width: 214,
    height: 214,
    borderRadius: 107,
    backgroundColor: colors.card,
    opacity: 0.72,
  },
  roomHaloInner: {
    position: 'absolute',
    top: 66,
    width: 174,
    height: 174,
    borderRadius: 87,
    borderWidth: 1,
    borderColor: brand.goldBorder,
    opacity: 0.65,
  },
  roomBaseboard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 58,
    height: 3,
    backgroundColor: brand.gold,
  },
  roomFloor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 58,
    backgroundColor: '#563D2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomRug: {
    width: 196,
    height: 28,
    borderRadius: 999,
    backgroundColor: brand.red,
    borderWidth: 2,
    borderColor: brand.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  roomRugInner: {
    width: 178,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(241, 217, 153, 0.55)',
  },

  nameplatePill: {
    position: 'absolute',
    top: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 4.5,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1.2,
    borderColor: brand.gold,
    zIndex: 4,
  },
  nameplateSign: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: serifFamily,
    color: brand.red,
  },
  nameplateText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: brand.ink,
  },
  speechWrap: {
    position: 'absolute',
    top: 31,
    alignItems: 'center',
    maxWidth: '84%',
    zIndex: 5,
  },
  speechBubble: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: brand.gold,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  speechText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  speechTail: {
    width: 8,
    height: 8,
    backgroundColor: colors.card,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: brand.gold,
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
  },
  bearWrap: {
    marginBottom: 14,
    zIndex: 4,
  },

  /* Шкалы характеристик */
  statsRow: {
    flexDirection: 'row',
    gap: 9,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.rule,
    padding: 11,
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: brand.muted,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  statTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: brand.paper,
    overflow: 'hidden',
    marginTop: 2,
  },
  statFill: {
    height: '100%',
    borderRadius: 999,
  },

  /* Главная кнопка действия — Лаковый красный */
  petBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 16,
    backgroundColor: brand.red,
    borderBottomWidth: 4,
    borderBottomColor: brand.redDark,
  },
  btnBusy: {
    opacity: 0.88,
  },
  btnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  petBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: brand.creamText,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  petBtnIdle: {
    backgroundColor: '#E5DEC9',
    borderBottomColor: '#C9C0A8',
  },
  petBtnTextIdle: { color: '#8C8278' },
  petHint: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.subtext,
  },
  heart: {
    position: 'absolute',
    alignSelf: 'center',
    top: -44,
    fontSize: 30,
  },
  heartText: { fontSize: 26 },
  petBadge: {
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: 'rgba(48, 40, 32, 0.25)',
  },
  petBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: brand.goldLight,
  },

  /* Табы */
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  tabPressed: {
    transform: [{ translateY: 1.5 }],
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.subtext,
  },
  tabTextActive: {
    color: colors.card,
    fontWeight: '800',
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.rule,
    padding: 15,
  },
  infoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: brand.goldSoft,
    borderWidth: 1,
    borderColor: brand.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBadgeText: {
    fontSize: 19,
  },
  infoBody: {
    flex: 1,
    gap: 5,
  },
  infoTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.text,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.subtext,
    lineHeight: 18.5,
  },
  petStatPill: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: brand.infoSoft,
  },
  petStatText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: brand.infoInk,
  },

  wearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  wearItem: {
    position: 'relative',
    width: '22.5%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileUnlocked: {
    backgroundColor: colors.card,
    borderColor: brand.gold,
  },
  tileLocked: {
    backgroundColor: colors.paper,
    borderColor: brand.rule,
    opacity: 0.72,
  },
  wearIcon: {
    fontSize: 24,
  },
  lock: {
    position: 'absolute',
    top: 5,
    right: 6,
    fontSize: 11,
  },

  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roomItem: {
    position: 'relative',
    width: '31%',
    borderRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 5,
  },
  roomItemActive: {
    backgroundColor: colors.card,
    borderColor: brand.gold,
  },
  roomIcon: {
    fontSize: 22,
  },
  roomLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
});
