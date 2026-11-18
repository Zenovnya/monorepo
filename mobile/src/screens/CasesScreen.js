import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { lexbearApi } from '../api/lexbear';
import { describeLoadError } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { TopStats } from '../components/TopStats';
import { PressableScale } from '../components/PressableScale';
import {
  brand,
  KhokhlomaCorners,
  KhokhlomaDivider,
  WaxSeal,
  RibbonBookmark,
  DocumentSectionHeader,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

// Сложность дел в рамках фирменной палитры:
// Лёгкий — хвойный (#315B46), Средний — золотой (#D9A849), Сложный/особый — лаковый красный (#C9362B).
const diffMap = {
  easy: {
    label: 'Лёгкий',
    sealTone: 'pine',
    tint: brand.pineSoft,
    border: brand.pineBorder,
    text: brand.pine,
  },
  medium: {
    label: 'Средний',
    sealTone: 'gold',
    tint: brand.goldSoft,
    border: brand.goldBorder,
    text: brand.goldInk,
  },
  hard: {
    label: 'Особый · Сложный',
    sealTone: 'red',
    tint: brand.redSoft,
    border: brand.redBorder,
    text: brand.red,
  },
};

const codexSealTone = {
  УК: 'red',
  Конституция: 'red',
  ГК: 'gold',
  ТК: 'pine',
  КоАП: 'gold',
};

const filters = ['Все', 'УК', 'КоАП', 'ГК', 'ТК', 'Конституция'];

/**
 * Экран «Кейсы» LexBear:
 * чистые современные карточки судебной практики, сургучные печати кодексов,
 * приглушённо-синие (#7298BC) информационные теги и точечные красно-золотые
 * рамки хохломы исключительно вокруг особых кейсов («Кейс дня» и сложных дел).
 */
export default function CasesScreen({ navigation }) {
  const [activeFilter, setActiveFilter] = useState('Все');
  const { data: cases, isLoading, error, refetch } = useQuery({
    queryKey: ['lexbear-cases'],
    queryFn: lexbearApi.cases,
  });

  // Массив стабилен между рендерами: раньше `all` создавался заново на каждый
  // рендер, из-за чего useMemo ниже пересчитывал фильтрацию вхолостую.
  const all = useMemo(
    () =>
      Array.isArray(cases)
        ? cases
        : Array.isArray(cases?.cases)
        ? cases.cases
        : Array.isArray(cases?.data)
        ? cases.data
        : [],
    [cases]
  );

  const filtered = useMemo(
    () =>
      activeFilter === 'Все'
        ? all
        : all.filter(
            (c) => c.codex === activeFilter || c.codex_name === activeFilter
          ),
    [all, activeFilter]
  );

  if (isLoading) {
    return <LoadingState label="Подбираем архив дел…" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Не удалось загрузить кейсы"
        message={describeLoadError(error, 'кейсы')}
        onRetry={() => refetch()}
        illustration={<WaxSeal label="!" tone="red" size={48} />}
      />
    );
  }

  const openCase = (c) => navigation.navigate('CaseDetail', { caseId: c.id });
  const featured =
    filtered.length > 0 && activeFilter === 'Все' ? filtered[0] : null;
  const listItems = filtered.slice(activeFilter === 'Все' ? 1 : 0);

  return (
    <View style={styles.container}>
      {/* Текстура бумаги — абсолютный слой над всем экраном, вне скролла:
          внутри ListHeaderComponent она бы растянулась только на шапку. */}
      <PaperGrain />
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        data={listItems}
        // 100 карточек в ScrollView рендерились целиком до первого кадра — это
        // и ощущалось как «кейсы долго грузятся», хотя сеть уже ответила.
        // FlatList монтирует окно и подгружает остальное по скроллу.
        keyExtractor={(c) => String(c.id)}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
        // Всё, что выше списка (шапка, фильтры, «особый кейс»), едет в заголовке.
        ListHeaderComponent={
          <>
      <TopStats />

      {/* Типографическая шапка архива */}
      <View style={styles.header}>
        <Text style={styles.docKicker}>§ АРХИВ ДЕЛ · СУДЕБНАЯ ПРАКТИКА</Text>
        <Text style={styles.title}>Кейсы</Text>
        <Text style={styles.subtitle}>
          Реальные ситуации из жизни — разберись как юрист
        </Text>
      </View>

      {/* Чистые фильтры по кодексам РФ (активный — лаковый красный) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {filters.map((f) => {
          const isActive = activeFilter === f;
          return (
            <PressableScale
              key={f}
              onPress={() => setActiveFilter(f)}
              style={[styles.filterChip, isActive && styles.filterActive]}
              scale={0.94}
              haptic
            >
              <Text
                style={[styles.filterText, isActive && styles.filterTextActive]}
              >
                {f}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* ОСОБЫЙ КЕЙС («Кейс дня») — точечная красно-золотая рамка хохломы + закладка-ляссе */}
      {featured && (
        <View style={styles.featuredCard}>
          <KhokhlomaCorners variant="light" size="md" inset={8} />
          <RibbonBookmark
            color={brand.red}
            symbol="§"
            right={36}
            height={32}
            width={22}
            cutoutColor={colors.card}
          />

          <View style={styles.featuredTopRow}>
            <View style={styles.specialBadge}>
              <Text style={styles.specialBadgeText}>✦ ОСОБЫЙ КЕЙС ДНЯ</Text>
            </View>
            {featured.codex ? (
              <View style={styles.codexInfoPill}>
                <Text style={styles.codexInfoText}>{featured.codex} РФ</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.featuredTitle}>{featured.title}</Text>

          {featured.case_text ? (
            <Text style={styles.featuredText} numberOfLines={3}>
              {featured.case_text}
            </Text>
          ) : null}

          <KhokhlomaDivider style={styles.featuredDivider} />

          <View style={styles.featuredFooter}>
            {featured.difficulty ? (
              <View
                style={[
                  styles.diffPill,
                  {
                    backgroundColor:
                      (diffMap[featured.difficulty] || diffMap.medium).tint,
                    borderColor:
                      (diffMap[featured.difficulty] || diffMap.medium).border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.diffPillText,
                    {
                      color:
                        (diffMap[featured.difficulty] || diffMap.medium).text,
                    },
                  ]}
                >
                  {(diffMap[featured.difficulty] || diffMap.medium).label}
                </Text>
              </View>
            ) : (
              <View />
            )}

            <PressableScale
              style={styles.featuredBtn}
              scale={0.95}
              pressDepth={2}
              haptic
              onPress={() => openCase(featured)}
            >
              <Text style={styles.featuredBtnText}>Разобрать →</Text>
            </PressableScale>
          </View>
        </View>
      )}

      {/* Заголовок списка дел в стиле старинного реестра */}
      {listItems.length > 0 && (
        <DocumentSectionHeader
          title={
            activeFilter === 'Все'
              ? 'Реестр дел'
              : `Кодекс · ${activeFilter}`
          }
          meta={`${listItems.length} шт.`}
          style={styles.sectionHeader}
        />
      )}

      <View style={styles.list}>
        {filtered.length === 0 && (
          <EmptyState
            compact
            title={
              activeFilter === 'Все'
                ? 'Архив пока пуст'
                : `В разделе «${activeFilter}» пока нет дел`
            }
            // Пустой архив — это не «выберите другой кодекс»: фильтр уже
            // «Все», и такой совет вводит в заблуждение. Такое состояние
            // бывает при первом запуске без сида контента.
            message={
              activeFilter === 'Все'
                ? 'Кейсы появятся здесь, как только мы загрузим практику.'
                : 'Попробуйте другой кодекс — в остальных дела уже есть.'
            }
            actionTitle={activeFilter !== 'Все' ? 'Показать все кейсы' : undefined}
            onAction={activeFilter !== 'Все' ? () => setActiveFilter('Все') : undefined}
          />
        )}
      </View>
          </>
        }
        // Одна карточка дела. Раньше это был .map() внутри ScrollView.
        renderItem={({ item: c, index: idx }) => {
          const isSpecial = c.difficulty === 'hard';
          const diff = diffMap[c.difficulty] || diffMap.medium;
          const sealTone = codexSealTone[c.codex] || diff.sealTone;
          const shortCode =
            c.codex === 'Конституция' ? 'КРФ' : c.codex || '§';

          return (
            <PressableScale
              key={c.id}
              style={[styles.caseCard, isSpecial && styles.caseCardSpecial]}
              scale={0.985}
              pressDepth={2}
              onPress={() => openCase(c)}
            >
              {/* Точечные уголки хохломы только у особых (сложных) кейсов */}
              {isSpecial ? (
                <KhokhlomaCorners variant="light" size="sm" inset={6} />
              ) : null}

              <WaxSeal
                sub={`№${idx + 2}`}
                label={shortCode}
                size={50}
                tone={sealTone}
              />

              <View style={styles.caseBody}>
                <Text style={styles.caseTitle} numberOfLines={2}>
                  {c.title}
                </Text>
                <View style={styles.caseMeta}>
                  {c.difficulty ? (
                    <View
                      style={[
                        styles.diffPill,
                        {
                          backgroundColor: diff.tint,
                          borderColor: diff.border,
                        },
                      ]}
                    >
                      <Text style={[styles.diffPillText, { color: diff.text }]}>
                        {diff.label}
                      </Text>
                    </View>
                  ) : null}
                  {c.codex ? (
                    <View style={styles.codexMiniPill}>
                      <Text style={styles.codexMiniText}>{c.codex}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View
                style={[
                  styles.arrowCircle,
                  isSpecial && styles.arrowCircleSpecial,
                ]}
              >
                <Text
                  style={[
                    styles.arrowText,
                    isSpecial && styles.arrowTextSpecial,
                  ]}
                >
                  →
                </Text>
              </View>
            </PressableScale>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  emptyReset: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: brand.rule,
    backgroundColor: colors.card,
  },
  emptyResetText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: brand.red,
  },
  errorDetail: {
    fontSize: 13,
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
    fontSize: 13.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  docKicker: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    color: brand.muted,
    marginBottom: 2,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.subtext,
    marginTop: 3,
  },

  filtersScroll: {
    marginTop: 4,
  },
  filtersContent: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.rule,
  },
  filterActive: {
    backgroundColor: brand.red,
    borderColor: brand.redDark,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  filterTextActive: {
    color: brand.creamText,
    fontWeight: '800',
  },

  /* Особый кейс дня с красно-золотой рамкой хохломы */
  featuredCard: {
    position: 'relative',
    marginHorizontal: 18,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1.8,
    borderBottomWidth: 4,
    borderColor: brand.gold,
    gap: 9,
  },
  featuredTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 30,
    flexWrap: 'wrap',
  },
  specialBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: brand.goldSoft,
    borderWidth: 1,
    borderColor: brand.goldBorder,
  },
  specialBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: brand.goldInk,
    letterSpacing: 0.6,
  },
  codexInfoPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    backgroundColor: brand.infoSoft,
    borderWidth: 1,
    borderColor: brand.infoBorder,
  },
  codexInfoText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: brand.infoInk,
  },
  featuredTitle: {
    fontSize: 18.5,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  featuredText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.subtext,
    lineHeight: 19.5,
  },
  featuredDivider: {
    marginVertical: 2,
  },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  featuredBtn: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 13,
    backgroundColor: brand.red,
    borderBottomWidth: 3.5,
    borderBottomColor: brand.redDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredBtnText: {
    color: brand.creamText,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  sectionHeader: {
    marginHorizontal: 18,
    marginTop: 20,
    marginBottom: 10,
  },

  list: {
    paddingHorizontal: 18,
    gap: 10,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: brand.rule,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subtext,
    textAlign: 'center',
  },

  /* Карточка дела */
  caseCard: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  caseCardSpecial: {
    borderColor: brand.gold,
    backgroundColor: '#FDF9F0',
  },
  caseBody: {
    flex: 1,
    gap: 6,
  },
  caseTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 19.5,
  },
  caseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  diffPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  diffPillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  codexMiniPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    backgroundColor: brand.infoSoft,
  },
  codexMiniText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: brand.infoInk,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: brand.paperSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowCircleSpecial: {
    backgroundColor: brand.redSoft,
  },
  arrowText: {
    fontSize: 15,
    fontWeight: '800',
    color: brand.subtext,
  },
  arrowTextSpecial: {
    color: brand.red,
  },
});
