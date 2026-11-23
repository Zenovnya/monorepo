import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Medal } from 'lucide-react-native';
import { useAuthStore } from '../store';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { TactilePressable } from '../components/TactilePressable';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { useTabBarContentBottom } from '../navigation/tabBar';
import { gamificationApi } from '../api/gamification';
import { adaptiveApi } from '../api/adaptive';
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
  reviews: { label: '↻', tone: 'gold' },
  applications: { label: '§', tone: 'red' },
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
  const insets = useSafeAreaInsets();
  const tabBarBottom = useTabBarContentBottom();

  // Редактирование имени: до этого сменить имя было нельзя вообще —
  // в профиле навсегда оставался дефолт «Юрист».
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name ?? '');
  const [nameError, setNameError] = useState(null);

  const saveName = useMutation({
    mutationFn: (value) => userApi.updateMe(value),
    onSuccess: (profile) => {
      setUser({ name: profile.name });
      queryClient.invalidateQueries({ queryKey: ['gamification-me'] });
      setEditingName(false);
      setNameError(null);
    },
    onError: () => setNameError('Не удалось сохранить имя. Попробуйте ещё раз.'),
  });

  const { data: gamification } = useQuery({
    queryKey: ['gamification-me'],
    queryFn: gamificationApi.me,
    staleTime: 0,
  });

  // Прогресс по темам: единственный источник правды о том, что пройдено.
  // Раньше здесь читался /progress по старым урокам — их больше нет.
  const { data: overview } = useQuery({
    queryKey: ['adaptive-overview'],
    queryFn: adaptiveApi.overview,
    staleTime: 0,
  });
  const topics = overview?.topics ?? [];

  const { data: achData } = useQuery({
    queryKey: ['gamification-achievements'],
    queryFn: gamificationApi.achievements,
  });
  const achievements = achData?.achievements ?? [];

  const lessonsPractised = topics.reduce((sum, t) => sum + t.lessons_practised, 0);
  const mistakesRecent = topics.reduce((sum, t) => sum + t.errors, 0);
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
      value: lessonsPractised,
      label: 'Уроки',
      accent: brand.goldInk,
    },
    {
      icon: '⚖️',
      value: mistakesRecent,
      label: 'Ошибки',
      accent: brand.pine,
    },
  ];

  const rows = [
    {
      key: 'league',
      title: 'Лига',
      hint: 'Рейтинг и награды недели',
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
      key: 'applications',
      title: 'Заявления',
      hint: 'Шаблоны жалоб, обращений и заявлений',
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
      topics: 'Learn',
      // «Повторить» — кейсы со сроком повторения. Открытие ведёт на экран
      // адаптивной практики: там уже есть режим повтора (выбор с kind ===
      // 'review'), и отдельный экран только бы дублировал его. Раньше
      // ключа reviews в map не было — navigation.navigate(undefined)
      // падал с ошибкой, и кнопка «Повторить» выглядела как сломанная.
      reviews: 'Adaptive',
      league: 'League',
      shop: 'Shop',
      applications: 'Applications',
      premium: 'Premium',
    };
    navigation.navigate(map[key]);
  };

  const regularRows = rows.filter((r) => !r.gold);
  const premiumRow = rows.find((r) => r.gold);

  return (
    <ScreenWrapper scroll contentStyle={[styles.content, { paddingBottom: tabBarBottom }]}>
      <PaperGrain />

      {/* Парадная шапка на тёплой бумаге с медальоном хохломы.
          Значок настроек и медведь с кругом опущены ниже: раньше они
          лежали в верхней части и на iPhone близко к статус-бару (время,
          wifi, заряд). */}
      <View style={styles.coverBanner}>
        <TactilePressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Настройки"
          style={[
            styles.settingsBtn,
            { marginTop: insets.top + 26 },
          ]}
          onPress={() => navigation.navigate('Settings')}
          haptic
          scale={0.92}
        >
          <Edit2 size={18} color={colors.text} />
        </TactilePressable>

        <View style={{ marginTop: 20 }}>
          <KhokhlomaMedallion size={146}>
            <AnimatedMascot
              size={120}
              levelUp={levelUpPulse}
              mood={levelUpPulse ? undefined : 'neutral'}
              wave={!levelUpPulse}
            />
          </KhokhlomaMedallion>
        </View>

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
          <TactilePressable
            accessibilityRole="button"
            accessibilityLabel="Изменить имя"
            onPress={() => {
              setNameDraft(user?.name ?? '');
              setEditingName(true);
            }}
            style={[
              styles.nameRow,
            ]}
            haptic
            scale={0.96}
          >
            <Text style={styles.name}>{user?.name || 'Юрист'}</Text>
            <View style={styles.editBadge}>
              <Edit2 size={14} color={colors.text} />
            </View>
          </TactilePressable>
        )}

        {nameError ? (
          <Text style={styles.nameError}>{nameError}</Text>
        ) : null}
        <View style={styles.pillsRow}>
          <TactilePressable
            accessibilityRole="button"
            accessibilityLabel="Лига"
            style={styles.leaguePill}
            haptic
            scale={0.96}
          >
            <Text style={styles.leaguePillText}>
              🏆 {user?.league || 'Бронза'}
            </Text>
          </TactilePressable>
          <TactilePressable
            accessibilityRole="button"
            accessibilityLabel="Уровень"
            style={styles.levelPill}
            haptic
            scale={0.96}
          >
            <Text style={styles.levelPillText}>Уровень {level}</Text>
          </TactilePressable>
        </View>
      </View>

      {/* Парадная лаковая карточка LexBear Plus (чернильный лак + золото и красный хохломы) */}
      {premiumRow && (
        <TactilePressable
          style={[
            styles.superCard,
          ]}
          onPress={() => navigate(premiumRow.key)}
          haptic
          scale={0.97}
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
        </TactilePressable>
      )}

      {/* Чистая сетка «Обзор» 2×2 — объёмные карточки с 3D-бортиком */}
      <DocumentSectionHeader title="Обзор" style={styles.sectionHeader} />
      <View style={styles.metricsGrid}>
        {metrics.map((m) => {
          const isMistakes = m.label === 'Ошибки';
          const content = (
            <>
              <Text style={[styles.metricIcon, { color: brand.gold }]}>
                {m.icon}
              </Text>
              <View style={styles.metricBody}>
                <Text style={[styles.metricValue, { color: m.accent }]}>
                  {m.value}
                </Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
              {isMistakes ? (
                <View style={styles.metricArrow}>
                  <Text style={styles.metricArrowText}>→</Text>
                </View>
              ) : null}
            </>
          );
          return (
            <TactilePressable
              key={m.label}
              accessibilityRole="button"
              accessibilityLabel={m.label}
              style={styles.metricCard}
              onPress={isMistakes ? () => navigate('Adaptive') : undefined}
              haptic={isMistakes}
              scale={0.97}
            >
              {content}
            </TactilePressable>
          );
        })}
      </View>

      {/* Блок «Достижения» — сетка медалей в стиле Chess.com */}
      {achievements.length > 0 && (
        <View>
          <DocumentSectionHeader
            title="Достижения"
            meta={`${achievements.length} наград`}
            style={styles.sectionHeader}
          />
          <View style={styles.achGrid}>
            {achievements.map((a, idx) => {
              const tone = idx % 2 === 0 ? 'gold' : 'red';
              const color =
                tone === 'gold' ? brand.goldBorder : brand.redDark;
              const bg = tone === 'gold' ? brand.goldSoft : brand.redSoft;
              return (
                <View key={a.code} style={[styles.medalCard, { borderColor: color }]}>
                  <View style={[styles.medalInner, { backgroundColor: bg }]}>
                    <Medal size={24} color={color} />
                  </View>
                  <Text style={styles.medalTitle} numberOfLines={2}>
                    {a.title}
                  </Text>
                  {a.description ? (
                    <Text style={styles.medalDesc} numberOfLines={2}>
                      {a.description}
                    </Text>
                  ) : null}
                </View>
              );
            })}
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
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: brand.rule,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: brand.goldSoft,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: brand.gold,
    borderBottomColor: brand.goldBorder,
  },
  leaguePillText: {
    fontSize: 13,
    fontWeight: '900',
    color: brand.goldInk,
  },
  levelPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: brand.infoSoft,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: brand.infoBorder,
    borderBottomColor: brand.info,
  },
  levelPillText: {
    fontSize: 13,
    fontWeight: '900',
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
    borderWidth: 1.5,
    borderBottomWidth: 5,
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
    borderBottomWidth: 4,
    borderColor: brand.rule,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  metricArrow: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.goldSoft,
  },
  metricArrowText: {
    fontSize: 15,
    fontWeight: '800',
    color: brand.goldInk,
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

  /* Сетка медалей в стиле Chess.com */
  achGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    gap: 10,
  },
  medalCard: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    paddingVertical: 13,
    paddingHorizontal: 10,
  },
  medalInner: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: brand.gold,
  },
  medalTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  medalDesc: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.subtext,
    textAlign: 'center',
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
