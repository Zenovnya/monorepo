import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { lexbearApi } from '../api/lexbear';
import { gamificationApi } from '../api/gamification';
import { TopStats } from '../components/TopStats';
import { AnimatedMascot } from '../components/AnimatedMascot';
import {
  brand,
  serifFamily,
  KhokhlomaGarland,
  KhokhlomaSprig,
  KhokhlomaDivider,
  RibbonBookmark,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

// Классическая пара фонов хохломы для заголовков глав:
// Лаковый красный (#C9362B) и благородный Чернильный лак (#302820) с золотом (#D9A849).
// Синий не используется в главах, чтобы не спорить с красно-золотым фирменным стилем.
const CHAPTER_THEMES = [
  {
    bg: brand.red,
    lip: brand.redDark,
    garland: 'onRed',
    eyebrow: brand.goldLight,
    crownBg: 'rgba(48, 40, 32, 0.24)',
    trackBg: 'rgba(48, 40, 32, 0.26)',
    ribbon: brand.gold,
  },
  {
    bg: brand.ink,
    lip: brand.inkDeep,
    garland: 'onDark',
    eyebrow: brand.gold,
    crownBg: 'rgba(217, 168, 73, 0.16)',
    trackBg: 'rgba(252, 248, 240, 0.14)',
    ribbon: brand.red,
  },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const SNAKE_OFFSETS = [0, -46, -24, 34, 46, 12];

/**
 * Экран «Учёба» LexBear:
 * современная карта уроков на сливочной бумаге (#F7EFDF),
 * точечная хохлома в заголовках глав, лаково-красные главные действия (#C9362B)
 * и золотые награды/XP (#D9A849).
 */
export default function LearnScreen({ navigation }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['lexbear-learn'],
    queryFn: lexbearApi.learnPath,
  });

  // Ежедневная цель: daily_goal задаётся в онбординге, но раньше нигде не
  // отображался — пользователь не видел, выполнил ли норму за день.
  const { data: dailyGoal } = useQuery({
    queryKey: ['gamification-daily-goal'],
    queryFn: gamificationApi.dailyGoal,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <AnimatedMascot size={112} emotion="thinking" />
        <ActivityIndicator size="small" color={brand.red} />
        <Text style={styles.stateHint}>Открываем свод уроков…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <View style={styles.stateCard}>
          <AnimatedMascot size={104} emotion="sad" error />
          <Text style={styles.errorText}>Не удалось загрузить программу</Text>
          {error.message ? (
            <Text style={styles.errorDetail}>{error.message}</Text>
          ) : null}
          <Pressable
            onPress={() => refetch()}
            style={({ pressed }) => [styles.retryBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.retryBtnText}>Повторить</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // API currently returns a plain array; tolerate legacy/object envelopes too.
  const units = Array.isArray(data)
    ? data
    : Array.isArray(data?.units)
    ? data.units
    : Array.isArray(data?.data)
    ? data.data
    : [];

  let globalSeenIncomplete = false;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PaperGrain />
      <TopStats />

      {/* Чистая шапка с приветственным мишкой и двумя карточками быстрой практики */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleBody}>
            <Text style={styles.docKicker}>§ СВОД ЗНАНИЙ · LEXBEAR</Text>
            <View style={styles.titleLine}>
              <Text style={styles.title}>Учёба</Text>
              <KhokhlomaSprig compact style={styles.titleSprig} />
            </View>
            <Text style={styles.subtitle}>
              Короткие уроки, живые кейсы и право на каждый день
            </Text>
          </View>
          <AnimatedMascot size={76} emotion="neutral" wave />
        </View>

        <View style={styles.questRow}>
          <Pressable
            style={({ pressed }) => [
              styles.questCard,
              styles.questCardPrimary,
              pressed && styles.questPressed,
            ]}
            onPress={() => navigation.navigate('Cases')}
          >
            <View style={styles.questTopRow}>
              <View style={styles.sealMiniRed}>
                <Text style={styles.sealMiniText}>§</Text>
              </View>
              <View style={styles.goldTag}>
                <Text style={styles.goldTagText}>ДЛЯ ВАС</Text>
              </View>
            </View>
            <Text style={styles.questTitle}>Рекомендации</Text>
            <Text style={styles.questDesc} numberOfLines={2}>
              Подборка дел по вашим слабым темам и ошибкам
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.questCard,
              pressed && styles.questPressed,
            ]}
            onPress={() => navigation.navigate('Cases')}
          >
            <View style={styles.questTopRow}>
              <View style={styles.sealMiniGold}>
                <Text style={styles.sealMiniDarkText}>№</Text>
              </View>
              <View style={styles.infoTag}>
                <Text style={styles.infoTagText}>50 ДЕЛ</Text>
              </View>
            </View>
            <Text style={styles.questTitle}>Архив кейсов</Text>
            <Text style={styles.questDesc} numberOfLines={2}>
              Полное собрание из 50 жизненных ситуаций
            </Text>
          </Pressable>
        </View>

        {dailyGoal && dailyGoal.goal > 0 ? (
          <View style={styles.dailyGoalCard}>
            <View style={styles.dailyGoalHead}>
              <Text style={styles.dailyGoalKicker}>§ ЦЕЛЬ ДНЯ</Text>
              <Text style={styles.dailyGoalValue}>
                {dailyGoal.done} / {dailyGoal.goal} XP
              </Text>
            </View>
            <View style={styles.dailyGoalTrack}>
              <View
                style={[
                  styles.dailyGoalFill,
                  {
                    width: `${Math.min(
                      100,
                      Math.round((dailyGoal.done / dailyGoal.goal) * 100)
                    )}%`,
                  },
                  dailyGoal.completed && styles.dailyGoalFillDone,
                ]}
              />
            </View>
            <Text style={styles.dailyGoalHint}>
              {dailyGoal.completed
                ? 'Норма выполнена — отличная работа!'
                : `Осталось ${dailyGoal.remaining} XP. Один короткий урок закроет цель.`}
            </Text>
          </View>
        ) : null}
      </View>

      {units.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptySign}>§</Text>
          <Text style={styles.emptyText}>Программа скоро появится</Text>
        </View>
      ) : (
        units.map((unit, uIdx) => {
          const theme = CHAPTER_THEMES[uIdx % CHAPTER_THEMES.length];
          const roman = ROMAN[uIdx] || String(uIdx + 1);
          const lessons = Array.isArray(unit.lessons) ? unit.lessons : [];
          const doneCount = lessons.filter((l) => l.completed).length;
          const pct =
            lessons.length > 0
              ? Math.round((doneCount / lessons.length) * 100)
              : 0;

          return (
            <View key={unit.id ?? uIdx} style={styles.unitSection}>
              {uIdx > 0 ? (
                <KhokhlomaDivider style={styles.chapterDivider} />
              ) : null}

              {/* Заголовок главы с точечной красно-золотой хохломой и закладкой кодекса */}
              <View
                style={[
                  styles.unitBanner,
                  {
                    backgroundColor: theme.bg,
                    borderBottomColor: theme.lip,
                  },
                ]}
              >
                <RibbonBookmark
                  color={theme.ribbon}
                  symbol={roman}
                  right={16}
                  height={28}
                  width={22}
                  cutoutColor={theme.bg}
                />

                <KhokhlomaGarland
                  variant={theme.garland}
                  count={5}
                  style={styles.bannerGarland}
                />

                <View style={styles.bannerTop}>
                  <View style={styles.bannerTextWrap}>
                    <Text style={[styles.bannerEyebrow, { color: theme.eyebrow }]}>
                      ГЛАВА {roman} · РАЗДЕЛ {uIdx + 1}
                    </Text>
                    <Text style={styles.bannerTitle}>{unit.title}</Text>
                    {unit.description ? (
                      <Text style={styles.bannerDesc}>{unit.description}</Text>
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.crownBox,
                      { backgroundColor: theme.crownBg },
                    ]}
                  >
                    <Text style={styles.crownEmoji}>👑</Text>
                    <Text style={styles.crownCount}>
                      {doneCount}/{lessons.length}
                    </Text>
                  </View>
                </View>

                {lessons.length > 0 ? (
                  <View
                    style={[
                      styles.bannerTrack,
                      { backgroundColor: theme.trackBg },
                    ]}
                  >
                    <View
                      style={[
                        styles.bannerFill,
                        { width: `${Math.max(pct, pct > 0 ? 10 : 0)}%` },
                      ]}
                    >
                      <View style={styles.bannerShine} />
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Чистая S-образная тропа уроков на сливочной бумаге */}
              <View style={styles.pathContainer}>
                {lessons.map((lesson, lIdx) => {
                  const isLocked = !lesson.completed && globalSeenIncomplete;
                  const isCurrent = !lesson.completed && !globalSeenIncomplete;
                  if (!lesson.completed) globalSeenIncomplete = true;

                  const offsetX = SNAKE_OFFSETS[lIdx % SNAKE_OFFSETS.length];
                  const nextOffsetX =
                    lIdx < lessons.length - 1
                      ? SNAKE_OFFSETS[(lIdx + 1) % SNAKE_OFFSETS.length]
                      : offsetX;
                  const midOffsetX = Math.round((offsetX + nextOffsetX) / 2);

                  return (
                    <View key={lesson.id} style={styles.nodeWrapper}>
                      <View
                        style={[
                          styles.nodeColumn,
                          { transform: [{ translateX: offsetX }] },
                        ]}
                      >
                        {/* Плашка «НАЧАТЬ» над текущим уроком */}
                        {isCurrent && (
                          <View style={styles.startTooltipWrap}>
                            <View style={styles.startTooltip}>
                              <Text style={styles.startTooltipText}>
                                НАЧАТЬ
                              </Text>
                            </View>
                            <View style={styles.startTooltipTail} />
                          </View>
                        )}

                        <View
                          style={[
                            styles.puckAnchor,
                            isCurrent && styles.currentHalo,
                          ]}
                        >
                          <Pressable
                            disabled={isLocked}
                            onPress={() =>
                              navigation.navigate('Lesson', {
                                lessonId: lesson.id,
                                title: lesson.title,
                              })
                            }
                            style={({ pressed }) => [
                              styles.puck,
                              lesson.completed
                                ? styles.puckDone
                                : isLocked
                                ? styles.puckLocked
                                : styles.puckCurrent,
                              pressed && !isLocked && styles.puckPressed,
                            ]}
                          >
                            <View
                              style={[
                                styles.puckInnerRing,
                                isLocked && styles.puckInnerRingLocked,
                              ]}
                            />
                            <Text
                              style={[
                                styles.puckIcon,
                                lesson.completed && styles.puckIconDone,
                                isCurrent && styles.puckIconCurrent,
                                isLocked && styles.puckIconLocked,
                              ]}
                            >
                              {lesson.completed ? '👑' : isLocked ? '🔒' : '★'}
                            </Text>
                          </Pressable>

                          {/* Золотая награда +XP и хвойная отметка у пройденного урока */}
                          {lesson.completed && lesson.xp_reward ? (
                            <View style={styles.xpFloatingBadge}>
                              <Text style={styles.xpFloatingText}>
                                +{lesson.xp_reward} XP
                              </Text>
                            </View>
                          ) : null}
                          {lesson.completed ? (
                            <View style={styles.doneCheckDot}>
                              <Text style={styles.doneCheckText}>✓</Text>
                            </View>
                          ) : null}
                        </View>

                        <Pressable
                          disabled={isLocked}
                          onPress={() =>
                            navigation.navigate('Lesson', {
                              lessonId: lesson.id,
                              title: lesson.title,
                            })
                          }
                          style={[
                            styles.nodeLabelPill,
                            isCurrent && styles.nodeLabelPillCurrent,
                          ]}
                        >
                          <Text
                            style={[
                              styles.lessonTitle,
                              isCurrent && styles.lessonTitleCurrent,
                              isLocked && styles.lessonTitleLocked,
                            ]}
                            numberOfLines={2}
                          >
                            {lesson.title}
                          </Text>
                        </Pressable>
                      </View>

                      {/* Аккуратные пунктирные точки-вехи между уроками */}
                      {lIdx < lessons.length - 1 ? (
                        <View
                          style={[
                            styles.connectorWrap,
                            { transform: [{ translateX: midOffsetX }] },
                          ]}
                        >
                          <View
                            style={[
                              styles.connectorDot,
                              lesson.completed && styles.connectorDotDone,
                            ]}
                          />
                          <View
                            style={[
                              styles.connectorDotSmall,
                              lesson.completed && styles.connectorDotDone,
                            ]}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dailyGoalCard: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: brand.rule,
    backgroundColor: colors.card,
  },
  dailyGoalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dailyGoalKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: colors.subtext,
  },
  dailyGoalValue: {
    fontSize: 13,
    fontWeight: '800',
    color: brand.goldInk,
  },
  dailyGoalTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  dailyGoalFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: brand.gold,
  },
  dailyGoalFillDone: {
    backgroundColor: brand.pine,
  },
  dailyGoalHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: colors.subtext,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 112,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
    gap: 12,
  },
  stateHint: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subtext,
  },
  stateCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    borderColor: brand.rule,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.subtext,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 6,
    height: 46,
    paddingHorizontal: 26,
    borderRadius: 14,
    backgroundColor: brand.red,
    borderBottomWidth: 4,
    borderBottomColor: brand.redDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  retryBtnText: {
    color: brand.creamText,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  /* Шапка */
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleBody: {
    flex: 1,
  },
  docKicker: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    color: brand.muted,
    marginBottom: 2,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  titleSprig: {
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.subtext,
    marginTop: 3,
    lineHeight: 18,
  },

  /* Две чистые карточки быстрых действий */
  questRow: {
    flexDirection: 'row',
    gap: 10,
  },
  questCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    padding: 13,
    gap: 5,
  },
  questCardPrimary: {
    borderColor: brand.goldBorder,
  },
  questPressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 1.5,
  },
  questTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  sealMiniRed: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: brand.red,
    borderBottomWidth: 2,
    borderBottomColor: brand.redDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealMiniText: {
    color: brand.creamText,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: serifFamily,
  },
  sealMiniGold: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: brand.goldSoft,
    borderWidth: 1.2,
    borderColor: brand.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealMiniDarkText: {
    color: brand.goldInk,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: serifFamily,
  },
  goldTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: brand.goldSoft,
    borderWidth: 1,
    borderColor: brand.goldBorder,
  },
  goldTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: brand.goldInk,
    letterSpacing: 0.5,
  },
  infoTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: brand.infoSoft,
    borderWidth: 1,
    borderColor: brand.infoBorder,
  },
  infoTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: brand.infoInk,
    letterSpacing: 0.5,
  },
  questTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  questDesc: {
    fontSize: 11.5,
    fontWeight: '500',
    color: colors.subtext,
    lineHeight: 15.5,
  },

  emptyCard: {
    margin: 18,
    padding: 28,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: brand.rule,
    alignItems: 'center',
    gap: 8,
  },
  emptySign: {
    fontSize: 28,
    fontFamily: serifFamily,
    color: brand.gold,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subtext,
  },

  /* Глава (Unit) */
  unitSection: {
    marginTop: 12,
    paddingHorizontal: 18,
  },
  chapterDivider: {
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  unitBanner: {
    position: 'relative',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(217, 168, 73, 0.45)',
    borderBottomWidth: 5,
    gap: 11,
  },
  bannerGarland: {
    paddingRight: 32,
  },
  bannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bannerTextWrap: {
    flex: 1,
    gap: 3,
  },
  bannerEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bannerTitle: {
    fontSize: 18.5,
    fontWeight: '800',
    color: brand.creamText,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  bannerDesc: {
    fontSize: 12.5,
    fontWeight: '500',
    color: 'rgba(252, 248, 240, 0.84)',
    lineHeight: 17,
    marginTop: 1,
  },
  crownBox: {
    minWidth: 50,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(241, 217, 153, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 2,
  },
  crownEmoji: {
    fontSize: 16,
  },
  crownCount: {
    fontSize: 12,
    fontWeight: '800',
    color: brand.creamText,
  },
  bannerTrack: {
    height: 9,
    borderRadius: 999,
    overflow: 'hidden',
  },
  bannerFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: brand.gold,
  },
  bannerShine: {
    height: 3,
    marginHorizontal: 4,
    marginTop: 1.5,
    borderRadius: 999,
    backgroundColor: 'rgba(252, 248, 240, 0.45)',
  },

  /* Тропа уроков */
  pathContainer: {
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 10,
  },
  nodeWrapper: {
    alignItems: 'center',
  },
  nodeColumn: {
    alignItems: 'center',
  },
  startTooltipWrap: {
    alignItems: 'center',
    marginBottom: 7,
  },
  startTooltip: {
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.red,
  },
  startTooltipText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: brand.red,
  },
  startTooltipTail: {
    width: 9,
    height: 9,
    backgroundColor: colors.card,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: brand.red,
    transform: [{ rotate: '45deg' }],
    marginTop: -5,
  },

  puckAnchor: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentHalo: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: brand.redSoft,
    borderWidth: 2,
    borderColor: brand.red,
  },
  puck: {
    width: 72,
    height: 68,
    borderRadius: 36,
    borderBottomWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puckDone: {
    backgroundColor: brand.gold,
    borderBottomColor: brand.goldDark,
  },
  puckCurrent: {
    backgroundColor: brand.red,
    borderBottomColor: brand.redDark,
  },
  puckLocked: {
    backgroundColor: colors.paper,
    borderBottomColor: brand.ruleStrong,
  },
  puckPressed: {
    transform: [{ translateY: 3 }],
    borderBottomWidth: 3,
  },
  puckInnerRing: {
    position: 'absolute',
    width: 56,
    height: 52,
    borderRadius: 28,
    borderWidth: 1.2,
    borderColor: 'rgba(252, 248, 240, 0.42)',
  },
  puckInnerRingLocked: {
    borderColor: 'rgba(150, 133, 113, 0.25)',
  },
  puckIcon: {
    fontSize: 24,
  },
  puckIconDone: {
    fontSize: 24,
  },
  puckIconCurrent: {
    fontSize: 25,
    color: brand.creamText,
  },
  puckIconLocked: {
    fontSize: 20,
    opacity: 0.65,
  },

  /* Золотой XP и хвойная галочка выполненного урока */
  xpFloatingBadge: {
    position: 'absolute',
    top: -7,
    right: -24,
    backgroundColor: brand.goldSoft,
    borderWidth: 1.5,
    borderColor: brand.gold,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  xpFloatingText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: brand.goldInk,
  },
  doneCheckDot: {
    position: 'absolute',
    bottom: 2,
    left: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: brand.pine,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCheckText: {
    fontSize: 11,
    fontWeight: '900',
    color: brand.creamText,
  },

  nodeLabelPill: {
    marginTop: 8,
    maxWidth: 196,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  nodeLabelPillCurrent: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: brand.rule,
  },
  lessonTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 18,
  },
  lessonTitleCurrent: {
    fontWeight: '800',
    color: brand.ink,
  },
  lessonTitleLocked: {
    color: colors.locked,
    fontWeight: '600',
  },

  connectorWrap: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  connectorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: brand.ruleStrong,
  },
  connectorDotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: brand.ruleStrong,
  },
  connectorDotDone: {
    backgroundColor: brand.gold,
  },
});
