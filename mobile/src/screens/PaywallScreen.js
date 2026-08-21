import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { paymentsApi } from '../api/payments';
import { analyticsApi } from '../api/analytics';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { AnimatedButton } from '../components/AnimatedButton';
import { colors } from '../theme/colors';

const PLANS = [
  { key: 'monthly', title: '1 месяц', price: '399 ₽/мес', note: 'Экономия 0%' },
  { key: 'yearly', title: '1 год', price: '2 990 ₽/год', note: 'Экономия 38%', popular: true },
];

const PERKS = [
  { icon: '❤️', text: 'Без лимита жизней' },
  { icon: '📶', text: 'Офлайн-кейсы' },
  { icon: '⚖️', text: 'Мантия мишки эксклюзив' },
  { icon: '🎯', text: 'Разбор сложных составов' },
  { icon: '🚫', text: 'Без рекламы' },
];

export default function PaywallScreen({ navigation }) {
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
        <AnimatedMascot />
        <Text style={styles.heroTitle}>Учись без ограничений</Text>
        <Text style={styles.heroSubtitle}>Премиум для настоящих юристов</Text>
      </View>

      {/* Тарифы */}
      <View style={styles.plans}>
        {PLANS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPlan(p.key)}
            style={[
              styles.plan,
              plan === p.key && styles.planSelected,
            ]}
          >
            {p.popular && <Text style={styles.popularBadge}>🔥 Популярный</Text>}
            <Text style={styles.planTitle}>{p.title}</Text>
            <Text style={styles.planPrice}>{p.price}</Text>
            <Text style={styles.planNote}>{p.note}</Text>
          </Pressable>
        ))}
      </View>

      {/* Преимущества */}
      <View style={styles.perks}>
        {PERKS.map((perk) => (
          <View key={perk.text} style={styles.perk}>
            <Text style={styles.perkIcon}>{perk.icon}</Text>
            <Text style={styles.perkText}>{perk.text}</Text>
            <Text style={styles.perkCheck}>✓</Text>
          </View>
        ))}
      </View>

      {paymentUrl ? (
        <Text style={styles.paymentHint}>
          Оплата открыта в браузере. После оплаты вернитесь в приложение.
        </Text>
      ) : null}

      <View style={styles.footer}>
        <AnimatedButton
          title="Оформить подписку"
          onPress={() => createPayment.mutate(plan)}
          loading={createPayment.isPending}
        />
        <Text style={styles.terms}>
          Первые 7 дней бесплатно. Отмена в любой момент.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backText: { fontSize: 18, fontWeight: '800', color: colors.text },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  hero: { alignItems: 'center', paddingHorizontal: 20, marginTop: 20 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#B8860B', marginTop: 12 },
  heroSubtitle: { fontSize: 14, color: colors.subtext, marginTop: 4 },
  plans: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 24 },
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
  popularBadge: { fontSize: 11, fontWeight: '800', color: '#B8860B', marginBottom: 6 },
  planTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  planPrice: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 8 },
  planNote: { fontSize: 12, color: colors.subtext, marginTop: 4 },
  perks: { paddingHorizontal: 20, marginTop: 24 },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  perkIcon: { fontSize: 20, marginRight: 12 },
  perkText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  perkCheck: { fontSize: 16, color: '#43A35D', fontWeight: '800' },
  paymentHint: {
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 16,
    fontSize: 13,
    color: colors.subtext,
  },
  footer: { paddingHorizontal: 20, marginTop: 24 },
  terms: { textAlign: 'center', fontSize: 12, color: colors.subtext, marginTop: 12 },
});