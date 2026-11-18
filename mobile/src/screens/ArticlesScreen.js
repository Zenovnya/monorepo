import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { lexbearApi } from '../api/lexbear';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { describeLoadError } from '../api/client';
import { PressableScale } from '../components/PressableScale';
import { FadeInView } from '../components/motion/FadeInView';
import {
  brand,
  serifFamily,
  KhokhlomaGarland,
  WaxSeal,
  RibbonBookmark,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Экран «Мои статьи» (ArticlesScreen):
 * свод изученных норм в духе старинного кодекса — лаково-красный заголовок главы
 * с золотым фризом хохломы, круглые сургучные печати «ст. N», шёлковые закладки-ляссе,
 * хвойный статус «✓ открыто» (#315B46) и приглушённо-синие ссылки на кодексы (#7298BC).
 */
export default function ArticlesScreen({ navigation }) {
  const { data: articles, isLoading, error, refetch } = useQuery({
    queryKey: ['lexbear-articles'],
    queryFn: lexbearApi.articles,
  });

  if (isLoading) {
    return <LoadingState label="Открываем свод статей…" />;
  }

  // Раньше ошибка не обрабатывалась вообще: при сбое список приходил пустым,
  // и экран показывал «Изучено: 0 из 0» — то есть врал про прогресс.
  if (error) {
    return (
      <ErrorState
        title="Не удалось загрузить статьи"
        message={describeLoadError(error, 'статьи')}
        onRetry={() => refetch()}
        illustration={<WaxSeal label="§" tone="red" size={48} />}
      />
    );
  }

  const all = Array.isArray(articles) ? articles : [];
  const learned = all.filter((a) => a.learned);
  const pct =
    all.length > 0 ? Math.round((learned.length / all.length) * 100) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
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
        <View>
          <Text style={styles.kicker}>§ КОДЕКСЫ И УЛОЖЕНИЯ</Text>
          <Text style={styles.title}>Мои статьи</Text>
        </View>
      </View>

      {/* Лаково-красный заголовок свода с золотым бордюром хохломы */}
      <View style={styles.heroBanner}>
        <KhokhlomaGarland variant="onRed" count={6} />

        <View style={styles.heroTopRow}>
          <AnimatedMascot size={74} emotion="strict" />
          <View style={styles.heroCenter}>
            <Text style={styles.heroEyebrow}>СВОД СТАТЕЙ ЮРИСТА</Text>
            <Text style={styles.subtitle}>
              Изучено: {learned.length} из {all.length}
            </Text>
          </View>
          <View style={styles.pctBadge}>
            <Text style={styles.pctText}>{pct}%</Text>
          </View>
        </View>

        <View style={styles.heroTrack}>
          <View
            style={[
              styles.heroFill,
              { width: `${Math.max(pct, pct > 0 ? 8 : 0)}%` },
            ]}
          >
            <View style={styles.heroShine} />
          </View>
        </View>
      </View>

      {/* Пустой свод: без сида контента экран выглядел как «всё изучено» */}
      {all.length === 0 ? (
        <EmptyState
          compact
          title="Свод пока пуст"
          message="Статьи появятся здесь, как только мы загрузим кодексы. Начните с уроков — они уже доступны."
        />
      ) : null}

      {/* Листы статей с сургучными печатями и закладками */}
      <View style={styles.list}>
        {all.map((a, idx) => (
          <FadeInView
            key={a.id}
            index={idx}
            style={[styles.card, !a.learned && styles.cardLocked]}
          >
            {a.learned ? (
              <RibbonBookmark
                color={brand.gold}
                symbol="§"
                right={16}
                height={27}
                width={20}
                cutoutColor={colors.card}
              />
            ) : null}

            <View style={styles.row}>
              <WaxSeal
                sub="ст."
                label={String(a.number)}
                size={52}
                tone={a.learned ? 'red' : 'locked'}
              />

              <View style={styles.titleBody}>
                <Text style={styles.articleTitle}>{a.title}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.codexPill}>
                    <Text style={styles.codexText}>{a.codex}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      a.learned
                        ? styles.statusPillOpen
                        : styles.statusPillClosed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        a.learned
                          ? styles.statusTextOpen
                          : styles.statusTextClosed,
                      ]}
                    >
                      {a.learned ? '✓ изучено' : '🔒 закрыто'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {a.learned && (
              <View style={styles.articleBody}>
                <View style={styles.plainBox}>
                  <Text style={styles.plainLabel}>ПРОСТЫМИ СЛОВАМИ</Text>
                  <Text style={styles.plain}>«{a.plain}»</Text>
                </View>
                <Text style={styles.full}>{a.full}</Text>
              </View>
            )}
          </FadeInView>
        ))}
      </View>
    </ScrollView>
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
    paddingBottom: 48,
    gap: 15,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: brand.muted,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },

  /* Заголовок главы/свода — лаковый красный + золото хохломы */
  heroBanner: {
    backgroundColor: brand.red,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(217, 168, 73, 0.5)',
    borderBottomWidth: 5,
    borderBottomColor: brand.redDark,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 15,
    gap: 11,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroCenter: {
    flex: 1,
    gap: 3,
  },
  heroEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: brand.goldLight,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '800',
    color: brand.creamText,
  },
  pctBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 13,
    backgroundColor: 'rgba(48, 40, 32, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(241, 217, 153, 0.4)',
  },
  pctText: {
    fontSize: 14,
    fontWeight: '800',
    color: brand.goldLight,
  },
  heroTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(48, 40, 32, 0.26)',
    overflow: 'hidden',
  },
  heroFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: brand.gold,
  },
  heroShine: {
    height: 3,
    marginHorizontal: 4,
    marginTop: 1.5,
    borderRadius: 999,
    backgroundColor: 'rgba(252, 248, 240, 0.45)',
  },

  list: {
    gap: 12,
  },
  card: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    padding: 16,
    gap: 12,
  },
  cardLocked: {
    opacity: 0.72,
    backgroundColor: brand.paperSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 22,
  },
  titleBody: {
    flex: 1,
    gap: 6,
  },
  articleTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 20.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  codexPill: {
    paddingHorizontal: 8.5,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: brand.infoSoft,
    borderWidth: 1,
    borderColor: brand.infoBorder,
  },
  codexText: {
    fontSize: 11,
    fontWeight: '700',
    color: brand.infoInk,
  },
  statusPill: {
    paddingHorizontal: 8.5,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillOpen: {
    backgroundColor: brand.pineSoft,
  },
  statusPillClosed: {
    backgroundColor: colors.paper,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextOpen: {
    color: brand.pine,
  },
  statusTextClosed: {
    color: brand.muted,
  },

  articleBody: {
    gap: 10,
  },
  plainBox: {
    backgroundColor: brand.goldSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.goldBorder,
    borderLeftWidth: 3.5,
    borderLeftColor: brand.gold,
    padding: 12,
    gap: 4,
  },
  plainLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: brand.goldInk,
  },
  plain: {
    fontSize: 13.5,
    fontWeight: '600',
    fontFamily: serifFamily,
    color: colors.text,
    lineHeight: 19.5,
  },
  full: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.subtext,
    lineHeight: 19,
  },
});
