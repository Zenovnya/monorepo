import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { PressableScale } from '../components/PressableScale';
import { lexbearApi } from '../api/lexbear';
import { gamificationApi } from '../api/gamification';
import { progressApi } from '../api/progress';
import { userApi } from '../api/user';
import {
  brand,
  KhokhlomaCorners,
  KhokhlomaGarland,
  KhokhlomaMedallion,
  WaxSeal,
  DocumentSectionHeader,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

const ROW_SEAL = {
  bear: { label: '§', tone: 'red' },
  league: { label: 'I', tone: 'gold' },
  articles: { label: 'ст', tone: 'red' },
  reviews: { label: '↻', tone: 'gold' },
  shop: { label: '✦', tone: 'gold' },
};

/**
 * Экран профиля LexBear:
 * чистые карточки обзора и разделов на сливочной бумаге (#F7EFDF),
 * точечные красно-золотые рамки хохломы вокруг достижений и парадной карточки LexBear Plus,
 * заголовки разделов и сургучные печати в духе старинных документов.
 */
export default function ProfileScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  // Редактирование имени: до этого сменить имя было нельзя вообще —
  // в профиле навсегда оставался дефолт «Юрист».
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name ?? '');
  const [nameError, setNameError] = useState(null);

  const saveName = useMutation({
    mutationFn: (value) => userApi.updateMe(value),
    onSuccess: (profile) => {
      setUser({ name: profile.name });
      queryClient.invalidateQueries(['gamification-me']);
      setEditingName(false);
      setNameError(null);
    },
    onError: () => setNameError('Не удалось сохранить имя. Попробуйте ещё раз.'),
  });

  const { data: articles } = useQuery({
    queryKey: ['lexbear-articles'],
    queryFn: lexbearApi.articles,
  });

  const { data: gamification } = useQuery({
    queryKey: ['gamification-me'],
    queryFn: gamificationApi.me,
  });

  const { data: progress } = useQuery({
    queryKey: ['progress-overview'],
    queryFn: progressApi.overview,
  });

  const { data: achData } = useQuery({
    queryKey: ['gamification-achievements'],
    queryFn: gamificationApi.achievements,
  });
  const achievements = achData?.achievements ?? [];

  const learnedCount = (articles ?? []).filter((a) => a.learned).length;
  const totalCrowns = progress?.total_crowns ?? 0;
  const level = gamification?.level ?? user?.level ?? 1;

  const prevLevelRef = useRef(level);
  const [levelUpPulse, setLevelUpPulse] = useState(false);
  useEffect(() => {
    if (prevLevelRef.current != null && level > prevLevelRef.current) {
      setLevelUpPulse(true);
      const t = setTimeout(() => setLevelUpPulse(false), 2500);
      return () => clearTimeout(t);
    }
    prevLevelRef.current = level;
  }, [level]);

  const metrics = [
    {
      icon: '🔥',
      value: gamification?.streak ?? user?.streak ?? 0,
      label: 'Стрик',
      accent: brand.red,
    },
    {
      icon: '✦',
      value: gamification?.xp ?? user?.xp ?? 0,
      label: 'XP',
      accent: brand.goldInk,
    },
    {
      icon: '👑',
      value: totalCrowns,
      label: 'Короны',
      accent: brand.goldInk,
    },
    {
      icon: '📖',
      value: learnedCount,
      label: 'Статьи',
      accent: brand.pine,
    },
  ];

  const rows = [
    {
      key: 'bear',
      title: 'Оформление мишки',
      hint: 'Костюмы, галстуки, кабинет',
    },
    {
      key: 'league',
      title: 'Лига',
      hint: 'Рейтинг и награды недели',
    },
    {
      key: 'articles',
      title: 'Мои статьи',
      hint: `Изучено статей: ${learnedCount}`,
    },
    {
      key: 'reviews',
      title: 'Повторить',
      hint: 'Кейсы, срок повторения которых наступил',
    },
    {
      key: 'shop',
      title: 'Лавка наград',
      hint: 'Кристаллы, жизни, атрибуты',
    },
    {
      key: 'premium',
      title: 'LexBear Plus',
      hint: 'Без лимита жизней и полный архив',
      gold: true,
    },
  ];

  const navigate = (key) => {
    const map = {
      bear: 'Bear',
      league: 'League',
      articles: 'Articles',
      reviews: 'Reviews',
      shop: 'Shop',
      premium: 'Premium',
    };
    navigation.navigate(map[key]);
  };

  const regularRows = rows.filter((r) => !r.gold);
  const premiumRow = rows.find((r) => r.gold);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PaperGrain />

      {/* Парадная шапка на тёплой бумаге с медальоном хохломы */}
      <View style={styles.coverBanner}>
        <PressableScale
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Настройки"
          style={[
            styles.settingsBtn,
          ]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </PressableScale>

        <KhokhlomaMedallion size={146}>
          <AnimatedMascot
            size={120}
            levelUp={levelUpPulse}
            mood={levelUpPulse ? undefined : 'neutral'}
            wave={!levelUpPulse}
          />
        </KhokhlomaMedallion>

        <KhokhlomaGarland
          variant="light"
          count={5}
          style={styles.coverGarland}
        />
      </View>

      {/* Имя, золотой чин лиги и информационная плашка уровня (#7298BC) */}
      <View style={styles.identitySection}>
        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              value={nameDraft}
              onChangeText={(t) => {
                setNameDraft(t);
                setNameError(null);
              }}
              maxLength={40}
              autoFocus
              placeholder="Как вас зовут?"
              placeholderTextColor={colors.locked}
              style={styles.nameInput}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (nameDraft.trim()) saveName.mutate(nameDraft.trim());
              }}
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Сохранить имя"
              disabled={!nameDraft.trim() || saveName.isPending}
              onPress={() => saveName.mutate(nameDraft.trim())}
              style={[
                styles.nameSaveBtn,
                (!nameDraft.trim() || saveName.isPending) && { opacity: 0.45 },
              ]}
            >
              {saveName.isPending ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Text style={styles.nameSaveText}>OK</Text>
              )}
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Отменить"
              onPress={() => {
                setEditingName(false);
                setNameDraft(user?.name ?? '');
                setNameError(null);
              }}
              style={[
                styles.nameCancelBtn,
              ]}
            >
              <Text style={styles.nameCancelText}>✕</Text>
            </PressableScale>
          </View>
        ) : (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Изменить имя"
            onPress={() => {
              setNameDraft(user?.name ?? '');
              setEditingName(true);
            }}
            style={[
              styles.nameRow,
            ]}
          >
            <Text style={styles.name}>{user?.name || 'Юрист'}</Text>
            <Text style={styles.namePencil}>✎</Text>
          </PressableScale>
        )}

        {nameError ? (
          <Text style={styles.nameError}>{nameError}</Text>
        ) : null}
        <View style={styles.pillsRow}>
          <View style={styles.leaguePill}>
            <Text style={styles.leaguePillText}>
              🏆 {user?.league || 'Бронза'}
            </Text>
          </View>
          <View style={styles.levelPill}>
            <Text style={styles.levelPillText}>Уровень {level}</Text>
          </View>
        </View>
      </View>

      {/* Парадная лаковая карточка LexBear Plus (чернильный лак + золото и красный хохломы) */}
      {premiumRow && (
        <PressableScale
          style={[
            styles.superCard,
          ]}
          onPress={() => navigate(premiumRow.key)}
        >
          <KhokhlomaCorners variant="onDark" size="sm" inset={7} />
          <WaxSeal label="+" tone="red" size={44} />
          <View style={styles.superBody}>
            <Text style={styles.superBadgeText}>ОСОБАЯ ГРАМОТА</Text>
            <Text style={styles.superTitle}>{premiumRow.title}</Text>
            <Text style={styles.superHint}>{premiumRow.hint}</Text>
          </View>
          <View style={styles.superCtaCircle}>
            <Text style={styles.superCtaArrow}>→</Text>
          </View>
        </PressableScale>
      )}

      {/* Чистая сетка «Обзор» 2×2 */}
      <DocumentSectionHeader title="Обзор" style={styles.sectionHeader} />
      <View style={styles.metricsGrid}>
        {metrics.map((m) => (
          <View key={m.label} style={styles.metricCard}>
            <Text style={[styles.metricIcon, { color: brand.gold }]}>
              {m.icon}
            </Text>
            <View style={styles.metricBody}>
              <Text style={[styles.metricValue, { color: m.accent }]}>
                {m.value}
              </Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Рамки достижений — точечные красно-золотые уголки хохломы и сургучные медали */}
      {achievements.length > 0 && (
        <View>
          <DocumentSectionHeader
            title="Достижения"
            meta={`${achievements.length} наград`}
            style={styles.sectionHeader}
          />
          <View style={styles.achList}>
            {achievements.map((a, idx) => (
              <View key={a.code} style={styles.achFrame}>
                <KhokhlomaCorners variant="light" size="sm" inset={6} />
                <WaxSeal
                  label="★"
                  size={44}
                  tone={idx % 2 === 0 ? 'gold' : 'red'}
                />
                <View style={styles.achBody}>
                  <Text style={styles.achTitle}>{a.title}</Text>
                  {a.description ? (
                    <Text style={styles.achDesc}>{a.description}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Чистые карточки разделов (без лишнего орнамента) */}
      <DocumentSectionHeader title="Разделы" style={styles.sectionHeader} />
      <View style={styles.groupCard}>
        {regularRows.map((r, idx) => {
          const seal = ROW_SEAL[r.key] || ROW_SEAL.bear;
          return (
            <PressableScale
              key={r.key}
              onPress={() => navigate(r.key)}
              style={[
                styles.navRow,
                idx < regularRows.length - 1 && styles.rowDivider,
              ]}
            >
              <WaxSeal label={seal.label} tone={seal.tone} size={38} />
              <View style={styles.navBody}>
                <Text style={styles.navTitle}>{r.title}</Text>
                <Text style={styles.navHint}>{r.hint}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </PressableScale>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  namePencil: {
    fontSize: 15,
    color: colors.subtext,
    marginTop: 2,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nameInput: {
    minWidth: 150,
    maxWidth: 230,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: brand.gold,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  nameSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: brand.pine,
    minWidth: 46,
    alignItems: 'center',
  },
  nameSaveText: {
    color: colors.card,
    fontWeight: '800',
    fontSize: 13,
  },
  nameCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: brand.rule,
  },
  nameCancelText: {
    color: colors.subtext,
    fontWeight: '800',
    fontSize: 13,
  },
  nameError: {
    marginTop: 8,
    color: brand.red,
    fontSize: 12.5,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 112,
  },

  coverBanner: {
    position: 'relative',
    backgroundColor: colors.paper,
    paddingTop: 18,
    paddingBottom: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: brand.rule,
  },
  settingsBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: brand.rule,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  smallPressed: {
    transform: [{ translateY: 1.5 }],
  },
  settingsIcon: {
    fontSize: 17,
  },
  coverGarland: {
    marginTop: 12,
  },

  identitySection: {
    paddingHorizontal: 18,
    paddingTop: 14,
    gap: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  leaguePill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: brand.goldSoft,
    borderWidth: 1.2,
    borderColor: brand.gold,
  },
  leaguePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: brand.goldInk,
  },
  levelPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: brand.infoSoft,
    borderWidth: 1.2,
    borderColor: brand.infoBorder,
  },
  levelPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: brand.infoInk,
  },

  /* Парадная лаковая шкатулка LexBear Plus */
  superCard: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 18,
    marginTop: 15,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: brand.ink,
    borderWidth: 1.8,
    borderBottomWidth: 4,
    borderColor: brand.gold,
  },
  superPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  superBody: {
    flex: 1,
    gap: 2,
  },
  superBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: brand.gold,
  },
  superTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: brand.creamText,
  },
  superHint: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(252, 248, 240, 0.78)',
  },
  superCtaCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: brand.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  superCtaArrow: {
    fontSize: 16,
    fontWeight: '800',
    color: brand.ink,
  },

  sectionHeader: {
    marginHorizontal: 18,
    marginTop: 20,
    marginBottom: 10,
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    gap: 10,
  },
  metricCard: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.rule,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  metricIcon: {
    fontSize: 20,
  },
  metricBody: {
    gap: 1,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.subtext,
  },

  /* Рамки достижений с хохломой */
  achList: {
    paddingHorizontal: 18,
    gap: 10,
  },
  achFrame: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.6,
    borderBottomWidth: 3.5,
    borderColor: brand.gold,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  achBody: {
    flex: 1,
    gap: 2,
  },
  achTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.text,
  },
  achDesc: {
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.subtext,
    lineHeight: 17.5,
  },

  /* Разделы */
  groupCard: {
    marginHorizontal: 18,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  navRowPressed: {
    backgroundColor: colors.background,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: brand.rule,
  },
  navBody: {
    flex: 1,
    gap: 2,
  },
  navTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.text,
  },
  navHint: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.subtext,
  },
  chevron: {
    fontSize: 22,
    fontWeight: '600',
    color: brand.muted,
  },
});
