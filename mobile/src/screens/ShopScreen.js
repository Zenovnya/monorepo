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
import { colors } from '../theme/colors';

const items = [
  { icon: '❤️', title: 'Пополнить жизни', price: '50 💎' },
  { icon: '🧊', title: 'Заморозка стрика', price: '200 💎' },
  { icon: '🎩', title: 'Костюм: цилиндр', price: '300 💎' },
  { icon: '⚖️', title: 'Мантия судьи', price: '800 💎' },
  { icon: '🎁', title: 'Сундук XP', price: '150 💎' },
];

const bundles = [
  { plan: 'gems_500', icon: '💎', title: '500 гемов', price: '199 ₽' },
  { plan: 'gems_1200', icon: '💎', title: '1200 гемов', price: '449 ₽' },
  { plan: 'gems_3000', icon: '💎', title: '3000 гемов', price: '999 ₽' },
];

export default function ShopScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);

  // Покупка гемов через ЮKassa.
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Магазин</Text>
        <View style={styles.gemsChip}>
          <Text style={styles.gemsText}>💎 {user?.gems ?? 0}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>За гемы</Text>
      <View style={styles.list}>
        {items.map((it) => (
          <View key={it.title} style={styles.card}>
            <View style={styles.itemIcon}>
              <Text style={styles.itemIconText}>{it.icon}</Text>
            </View>
            <Text style={styles.itemTitle}>{it.title}</Text>
            <Pressable
              style={styles.buyBtn}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                analyticsApi.track('shop_item_tapped', { item: it.title }).catch(() => {});
              }}
            >
              <Text style={styles.buyBtnText}>{it.price}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Пополнить гемы · ЮKassa</Text>
      <View style={styles.list}>
        {bundles.map((b) => (
          <View key={b.plan} style={styles.card}>
            <View style={[styles.itemIcon, { backgroundColor: '#FFF7DE' }]}>
              <Text style={styles.itemIconText}>{b.icon}</Text>
            </View>
            <Text style={styles.itemTitle}>{b.title}</Text>
            <Pressable
              style={[styles.buyBtn, styles.buyGold]}
              onPress={() => buyGems.mutate(b.plan)}
              disabled={buyGems.isPending}
            >
              <Text style={[styles.buyBtnText, { color: '#fff' }]}>
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
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 18, fontWeight: '900', color: colors.text },
  title: { fontSize: 26, fontWeight: '900', color: colors.text, flex: 1 },
  gemsChip: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: '#DFF1FB' },
  gemsText: { fontSize: 14, fontWeight: '800', color: colors.text },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: colors.subtext, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  list: { gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 3, borderColor: colors.border, borderRadius: 16, padding: 12 },
  itemIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  itemIconText: { fontSize: 22 },
  itemTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  buyBtn: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buyGold: { backgroundColor: colors.accent, borderColor: colors.border },
  buyBtnText: { fontSize: 13, fontWeight: '800', color: colors.text },
});