import React, { useState } from 'react';
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
import { AnimatedMascot } from '../components/AnimatedMascot';
import { paymentsApi } from '../api/payments';
import { analyticsApi } from '../api/analytics';
import { AnimatedButton } from '../components/AnimatedButton';
import { colors } from '../theme/colors';

const PLANS = [
  { key: 'monthly', title: '1 месяц', price: '399 ₽/мес', note: 'Экономия 0%' },
  { key: 'yearly', title: '1 год', price: '2 990 ₽/год', note: 'Экономия 38%', popular: true },
];

const perks = [
  { i: '❤️', t: 'Без лимита жизней' },
  { i: '📶', t: 'Офлайн-кейсы' },
  { i: '⚖️', t: 'Мантия мишки эксклюзив' },
  { i: '🎯', t: 'Разбор сложных составов' },
  { i: '🚫', t: 'Без рекламы' },
];

export default function PremiumScreen({ navigation }) {
  const [plan, setPlan] = useState('yearly');
  const [paymentUrl, setPaymentUrl] = useState(null);

  const createPayment = useMutation({
    mutationFn: (p) => paymentsApi.createPayment(p),
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Аналитика: событие покупки подписки (fire-and-forget).
      analyticsApi.track('subscription_purchased', { plan }).catch(() => {});
      if (data.confirmation_url) {
        // Для MVP открываем confirmation_url во внешнем браузере.
        // Встроенный WebView можно включить после установки react-native-webview.
        Linking.openURL(data.confirmation_url).catch(() => {});
      }
      setPaymentUrl(data.confirmation_url);
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>LexBear Plus</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Премиум</Text>
        <Text style={styles.heroTitle}>Учись без ограничений</Text>
        <AnimatedMascot size={140} emotion="cheer" />
        <Text style={styles.price}>{plan === 'yearly' ? '2 990 ₽' : '399 ₽'} / {plan === 'yearly' ? 'год' : 'мес'}</Text>
        <Text style={styles.priceNote}>или {plan === 'yearly' ? '399 ₽ / мес' : '2 990 ₽ / год · экономия 38%'}</Text>
      </View>

      {/* Выбор тарифа */}
      <View style={styles.plans}>
        {PLANS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPlan(p.key)}
            style={[styles.plan, plan === p.key && styles.planSelected]}
          >
            {p.popular && <Text style={styles.popularBadge}>🔥 Популярный</Text>}
            <Text style={styles.planTitle}>{p.title}</Text>
            <Text style={styles.planPrice}>{p.price}</Text>
            <Text style={styles.planNote}>{p.note}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.perkList}>
        {perks.map((p) => (
          <View key={p.t} style={styles.perk}>
            <Text style={styles.perkIcon}>{p.i}</Text>
            <Text style={styles.perkText}>{p.t}</Text>
            <Text style={styles.perkCheck}>✓</Text>
          </View>
        ))}
      </View>

      {paymentUrl ? (
        <Text style={styles.paymentHint}>
          Оплата открыта в браузере. После оплаты вернитесь в приложение.
        </Text>
      ) : null}

      <AnimatedButton
        title="Оформить подписку"
        onPress={() => createPayment.mutate(plan)}
        loading={createPayment.isPending}
      />
      <Text style={styles.terms}>Первые 7 дней бесплатно. Отмена в любой момент.</Text>
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
  title: { fontSize: 26, fontWeight: '900', color: colors.text },
  hero: {
    marginTop: 16,
    backgroundColor: '#FFF7DE',
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  heroLabel: { fontSize: 12, fontWeight: '900', color: colors.accent, textTransform: 'uppercase' },
  heroTitle: { fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 4 },
  price: { fontSize: 30, fontWeight: '900', color: colors.text, marginTop: 8 },
  priceNote: { fontSize: 14, color: colors.subtext, marginTop: 2 },
  plans: { flexDirection: 'row', gap: 12, marginTop: 16 },
  plan: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
  },
  planSelected: { borderColor: colors.accent, backgroundColor: '#FFF7DE' },
  popularBadge: { fontSize: 11, fontWeight: '800', color: colors.accent, marginBottom: 6 },
  planTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  planPrice: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 8 },
  planNote: { fontSize: 12, color: colors.subtext, marginTop: 4 },
  perkList: { marginTop: 16, gap: 10 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 3, borderColor: colors.border, borderRadius: 16, padding: 14 },
  perkIcon: { fontSize: 24 },
  perkText: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  perkCheck: { fontSize: 16, color: colors.success, fontWeight: '900' },
  paymentHint: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
    color: colors.subtext,
  },
  terms: { textAlign: 'center', fontSize: 12, color: colors.subtext, marginTop: 12 },
});