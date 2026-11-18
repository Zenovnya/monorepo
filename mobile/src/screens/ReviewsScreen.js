import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { progressApi } from '../api/progress';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { PressableScale } from '../components/PressableScale';
import {
  brand,
  KhokhlomaCorners,
  DocumentSectionHeader,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Экран повторения (ReviewsScreen):
 * кейсы, срок повторения которых наступил по алгоритму SM-2.
 *
 * Бэкенд считал расписание повторений с самого начала (`GET /srs/reviews`
 * поверх SM-2 в `/progress/answer`), но в приложении экрана не было —
 * просроченные повторения копились и ни на что не влияли.
 */
export default function ReviewsScreen({ navigation }) {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['srs-reviews'],
    queryFn: progressApi.reviews,
  });

  const reviews = Array.isArray(data?.reviews) ? data.reviews : [];

  const formatDue = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (days <= 0) return 'сегодня';
    if (days === 1) return 'просрочено на 1 день';
    if (days < 5) return `просрочено на ${days} дня`;
    return `просрочено на ${days} дней`;
  };

  const renderItem = ({ item }) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Открыть кейс для повторения"
      onPress={() => navigation.navigate('CaseDetail', { caseId: item.case_id })}
      style={[styles.row]}
    >
      <KhokhlomaCorners variant="light" size="sm" inset={6} />

      <View style={styles.rowHead}>
        <Text style={styles.rowKicker}>{formatDue(item.due_at)}</Text>
        <View style={styles.intervalPill}>
          <Text style={styles.intervalPillText}>
            шаг {item.interval_days} дн.
          </Text>
        </View>
      </View>

      <Text style={styles.rowText} numberOfLines={4}>
        {item.situation || 'Кейс для повторения'}
      </Text>

      <Text style={styles.rowAction}>Повторить →</Text>
    </PressableScale>
  );

  return (
    <View style={styles.container}>
      <PaperGrain />

      <FlatList
        data={reviews}
        keyExtractor={(item) => String(item.case_id)}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={brand.red}
            colors={[brand.red]}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <PressableScale
                onPress={() => navigation.goBack()}
                hitSlop={8}
                style={[
                  styles.backBtn,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Назад"
              >
                <Text style={styles.backText}>←</Text>
              </PressableScale>
              <View style={styles.headerCenter}>
                <Text style={styles.headerKicker}>§ ПОВТОРЕНИЕ НОРМ</Text>
                <Text style={styles.title}>Повторить</Text>
              </View>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.intro}>
              <AnimatedMascot size={78} emotion="neutral" wave />
              <Text style={styles.introText}>
                Здесь кейсы, которые пора освежить: срок повторения наступил по
                расписанию SM-2. Повторяйте их — и норма останется в памяти.
              </Text>
            </View>

            <DocumentSectionHeader
              title={
                reviews.length > 0
                  ? `К повторению: ${reviews.length}`
                  : 'К повторению'
              }
              style={styles.sectionHeader}
            />
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={brand.red} />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>
                {isError ? 'Не удалось загрузить повторения' : 'Всё повторено'}
              </Text>
              <Text style={styles.emptyText}>
                {isError
                  ? 'Проверьте соединение и потяните список вниз, чтобы обновить.'
                  : 'На сегодня просроченных кейсов нет. Разбирайте новые кейсы — они появятся здесь по расписанию.'}
              </Text>
            </View>
          )
        }
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
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: brand.rule,
    backgroundColor: colors.card,
  },
  backText: {
    fontSize: 20,
    color: colors.text,
    fontWeight: '700',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerKicker: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '800',
    color: colors.subtext,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  headerSpacer: { width: 40 },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: brand.rule,
    backgroundColor: colors.card,
    marginTop: 6,
  },
  introText: {
    flex: 1,
    color: colors.subtext,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 10,
  },
  row: {
    padding: 14,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: brand.rule,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rowKicker: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: brand.red,
    textTransform: 'uppercase',
  },
  intervalPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: brand.pineSoft,
    borderWidth: 1,
    borderColor: brand.pineBorder,
  },
  intervalPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: brand.pineDark,
  },
  rowText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  rowAction: {
    marginTop: 10,
    fontSize: 12.5,
    fontWeight: '800',
    color: brand.pine,
  },
  center: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyWrap: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.subtext,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
