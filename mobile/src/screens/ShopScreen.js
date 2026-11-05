import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store';
import { paymentsApi } from '../api/payments';
import { gamificationApi } from '../api/gamification';
import { analyticsApi } from '../api/analytics';
import { colors, radius, sizes, spacing, typography } from '../theme/tokens';

/**
 * Товары за гемы. `key` совпадает с каталогом на бэкенде
 * (`app/modules/gamification/service.py: SHOP_ITEMS`), `price` — цена в гемах.
 */
const items = [
  { key: 'life_refill', icon: '❤️', title: 'Пополнить жизни', price: 50 },
  { key: 'streak_freeze', icon: '🧊', title: 'Заморозка стрика', price: 200 },
  { key: 'outfit_top_hat', icon: '🎩', title: 'Костюм: цилиндр', price: 300 },
  { key: 'outfit_judge_robe', icon: '⚖️', title: 'Мантия судьи', price: 800 },
  { key: 'chest_xp', icon: '🎁', title: 'Сундук XP', price: 150 },
];

const bundles = [
  { plan: 'gems_500', icon: '💎', title: '500 гемов', price: '199 ₽' },
  { plan: 'gems_1200', icon: '💎', title: '1200 гемов', price: '449 ₽' },
  { plan: 'gems_3000', icon: '💎', title: '3000 гемов', price: '999 ₽' },
];

export default function ShopScreen({ navigation }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Реальный баланс: после покупки инвалидируем геймификацию, чтобы чип
  // с гемами обновился, а не показывал устаревшее значение из стора.
  const { data: gamification, isLoading: gemsLoading } = useQuery({
    queryKey: ['gamification-me'],
    queryFn: gamificationApi.me,
  });

  const buyItem = useMutation({
    mutationFn: (key) => gamificationApi.purchaseShopItem(key),
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      analyticsApi.track('shop_item_purchased', { item: data.item }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['gamification-me'] });
      Alert.alert('Готово', `Куплено. Остаток: ${data.gems} 💎`);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const detail = error?.response?.data?.detail;
      const message =
        error?.response?.status === 409
          ? 'Недостаточно гемов'
          : detail || 'Не удалось выполнить покупку';
      Alert.alert('Ошибка', message);
    },
  });

  // Покупка гемов через ЮKassa.
  const buyGems = useMutation({
    mutationFn: (plan) => paymentsApi.createPayment(plan),
    onSuccess: (data, plan) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      analyticsApi.track('gems_purchase_started', { plan }).catch(() => {});
      if (data.confirmation_url) {
        Linking.openURL(data.confirmation_url).catch(() => {});
      }
    },
    onError: () => {
      Alert.alert('Ошибка', 'Не удалось создать платёж');
    },
  });

  const gems = gamification?.gems ?? user?.gems ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          hitSlop={8}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Магазин</Text>
        <View style={styles.gemsChip}>
          {gemsLoading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.gemsText}>💎 {gems}</Text>
          )}
        </View>
      </View>

      <Text style={styles.sectionTitle}>За гемы</Text>
      <View style={styles.list}>
        {items.map((it) => {
          const pending = buyItem.isPending && buyItem.variables === it.key;
          const affordable = gems >= it.price;
          return (
            <View key={it.key} style={styles.card}>
              <View style={styles.itemIcon}>
                <Text style={styles.itemIconText}>{it.icon}</Text>
              </View>
              <Text style={styles.itemTitle}>{it.title}</Text>
              <Pressable
                style={[styles.buyBtn, !affordable && styles.buyBtnDisabled]}
                onPress={() => buyItem.mutate(it.key)}
                disabled={buyItem.isPending || !affordable}
                accessibilityRole="button"
                accessibilityLabel={`Купить ${it.title} за ${it.price} гемов`}
              >
                <Text style={styles.buyBtnText}>{pending ? '…' : `${it.price} 💎`}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Пополнить гемы · ЮKassa</Text>
      <View style={styles.list}>
        {bundles.map((b) => (
          <View key={b.plan} style={styles.card}>
            <View style={[styles.itemIcon, styles.itemIconGold]}>
              <Text style={styles.itemIconText}>{b.icon}</Text>
            </View>
            <Text style={styles.itemTitle}>{b.title}</Text>
            <Pressable
              style={[styles.buyBtn, styles.buyGold]}
              onPress={() => buyGems.mutate(b.plan)}
              disabled={buyGems.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Купить ${b.title} за ${b.price}`}
            >
              <Text style={[styles.buyBtnText, styles.buyBtnTextInverse]}>
                {buyGems.isPending ? '…' : b.price}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.base, paddingBottom: spacing.xxl },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: {
    width: sizes.minTouchTarget,
    height: sizes.minTouchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { ...typography.heading, color: colors.text },
  title: { ...typography.title, color: colors.text, flex: 1 },
  gemsChip: {
    minWidth: 64,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.skyTint,
    alignItems: 'center',
  },
  gemsText: { ...typography.caption, color: colors.text },

  sectionTitle: {
    ...typography.micro,
    color: colors.subtext,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  list: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconGold: { backgroundColor: colors.goldTint },
  itemIconText: { fontSize: 22 },
  itemTitle: { ...typography.bodyStrong, color: colors.text, flex: 1 },

  buyBtn: {
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: sizes.minTouchTarget,
    justifyContent: 'center',
  },
  buyBtnDisabled: { opacity: 0.45 },
  buyGold: { backgroundColor: colors.accent },
  buyBtnText: { ...typography.caption, color: colors.text },
  buyBtnTextInverse: { color: colors.card },
});

