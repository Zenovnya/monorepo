import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store';
import { paymentsApi } from '../api/payments';
import { analyticsApi } from '../api/analytics';
import {
  brand,
  KhokhlomaCorners,
  DocumentSectionHeader,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

const items = [
  { icon: '❤️', title: 'Пополнить жизни', price: '50 ✦', tint: brand.redSoft, border: brand.redBorder },
  { icon: '🧣', title: 'Заморозка стрика', price: '200 ✦', tint: brand.infoSoft, border: brand.infoBorder },
  { icon: '🎩', title: 'Костюм: цилиндр', price: '300 ✦', tint: brand.paperSoft, border: brand.rule },
  { icon: '⚖️', title: 'Мантия судьи', price: '800 ✦', tint: brand.goldSoft, border: brand.goldBorder },
  { icon: '🎁', title: 'Сундук XP', price: '150 ✦', tint: brand.goldSoft, border: brand.goldBorder },
];

const bundles = [
  { plan: 'gems_500', title: '500 гемов', price: '199 ₽' },
  { plan: 'gems_1200', title: '1200 гемов', price: '449 ₽' },
  { plan: 'gems_3000', title: '3000 гемов', price: '999 ₽' },
];

/**
 * Экран «Магазин» (ShopScreen):
 * чистые округлые карточки наград на сливочной бумаге (#F7EFDF),
 * золотые акценты наград (#D9A849), лаково-красные кнопки покупки (#C9362B)
 * и точечная рамка хохломы на главном сундуке наград.
 */
export default function ShopScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);

  const buyGems = useMutation({
    mutationFn: (plan) => paymentsApi.createPayment(plan),
    onSuccess: (data, plan) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      analyticsApi.track('gems_purchased', { plan }).catch(() => {});
      if (data.confirmation_url) {
        Linking.openURL(data.confirmation_url).catch(() => {});
      }
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PaperGrain />

      {/* Шапка лавки с золотым балансом */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && styles.smallPressed,
          ]}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Магазин</Text>
        <View style={styles.gemsChip}>
          <Text style={styles.gemsIcon}>✦</Text>
          <Text style={styles.gemsText}>{user?.gems ?? 0}</Text>
        </View>
      </View>

      {/* Награды и усиления */}
      <DocumentSectionHeader
        title="Награды и предметы"
        style={styles.sectionHeader}
      />
      <View style={styles.groupCard}>
        {items.map((it, idx) => (
          <View
            key={it.title}
            style={[
              styles.itemRow,
              idx < items.length - 1 && styles.rowDivider,
            ]}
          >
            <View
              style={[
                styles.itemIcon,
                { backgroundColor: it.tint, borderColor: it.border },
              ]}
            >
              <Text style={styles.itemIconText}>{it.icon}</Text>
            </View>
            <Text style={styles.itemTitle}>{it.title}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.buyBtn,
                pressed && styles.smallPressed,
              ]}
              onPress={() => {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning
                );
                analyticsApi
                  .track('shop_item_tapped', { item: it.title })
                  .catch(() => {});
              }}
            >
              <Text style={styles.buyBtnText}>{it.price}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {/* Пополнение · ЮKassa */}
      <DocumentSectionHeader
        title="Пополнить гемы"
        meta="ЮKassa"
        style={styles.sectionHeader}
      />
      <View style={styles.bundleList}>
        {bundles.map((b, idx) => {
          const isBest = idx === bundles.length - 1;
          return (
            <View
              key={b.plan}
              style={[styles.bundleCard, isBest && styles.bundleBest]}
            >
              {isBest ? (
                <KhokhlomaCorners variant="light" size="sm" inset={6} />
              ) : null}
              <View style={styles.bundleIcon}>
                <Text style={styles.bundleGem}>✦</Text>
              </View>
              <View style={styles.bundleBody}>
                {isBest ? (
                  <View style={styles.bestBadge}>
                    <Text style={styles.bestBadgeText}>ОСОБАЯ НАГРАДА</Text>
                  </View>
                ) : null}
                <Text style={styles.itemTitle}>{b.title}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.buyRed,
                  buyGems.isPending && styles.btnDisabled,
                  pressed && !buyGems.isPending && styles.smallPressed,
                ]}
                onPress={() => buyGems.mutate(b.plan)}
                disabled={buyGems.isPending}
              >
                <Text style={styles.buyRedText}>
                  {buyGems.isPending ? '…' : b.price}
                </Text>
              </Pressable>
            </View>
          );
        })}
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
    paddingBottom: 48,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1.5,
    borderBottomColor: brand.rule,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: brand.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallPressed: {
    transform: [{ translateY: 1.5 }],
  },
  backText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  gemsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: brand.goldSoft,
    borderWidth: 1.2,
    borderColor: brand.gold,
  },
  gemsIcon: {
    fontSize: 14,
    color: brand.gold,
  },
  gemsText: {
    fontSize: 14,
    fontWeight: '800',
    color: brand.goldInk,
  },

  sectionHeader: {
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 10,
  },

  groupCard: {
    marginHorizontal: 18,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: brand.rule,
  },
  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconText: {
    fontSize: 20,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.text,
  },
  buyBtn: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: brand.goldSoft,
    borderWidth: 1.5,
    borderBottomWidth: 3,
    borderColor: brand.gold,
  },
  buyBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: brand.goldInk,
  },

  bundleList: {
    marginHorizontal: 18,
    gap: 10,
  },
  bundleCard: {
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
    paddingHorizontal: 15,
  },
  bundleBest: {
    borderColor: brand.gold,
    backgroundColor: '#FDF9EE',
  },
  bundleIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: brand.goldSoft,
    borderWidth: 1.2,
    borderColor: brand.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleGem: {
    fontSize: 20,
    color: brand.gold,
  },
  bundleBody: {
    flex: 1,
    gap: 3,
  },
  bestBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: brand.goldSoft,
    borderWidth: 1,
    borderColor: brand.goldBorder,
  },
  bestBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: brand.goldInk,
  },
  buyRed: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: brand.red,
    borderBottomWidth: 3,
    borderBottomColor: brand.redDark,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  buyRedText: {
    color: brand.creamText,
    fontSize: 13,
    fontWeight: '800',
  },
});
