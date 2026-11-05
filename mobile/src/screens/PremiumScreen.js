import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { AnimatedButton } from '../components/AnimatedButton';
import { usePremium } from '../hooks/usePremium';
import { colors, radius, sizes, spacing, typography } from '../theme/tokens';

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
  const { isPremium, startCheckout, isCheckingOut } = usePremium();

  const onSubscribe = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    startCheckout(plan);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>LexBear Plus</Text>
      </View>

      {isPremium ? (
        <View style={styles.activeBanner}>
          <Text style={styles.activeText}>✓ Премиум активен — спасибо!</Text>
        </View>
      ) : null}

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

      {isCheckingOut ? (
        <Text style={styles.paymentHint}>
          Оплата открыта в браузере. После оплаты вернитесь в приложение —
          статус обновится автоматически.
        </Text>
      ) : null}

      <AnimatedButton
        title={isPremium ? 'Подписка активна' : 'Оформить подписку'}
        onPress={onSubscribe}
        loading={isCheckingOut}
        disabled={isPremium}
      />
      <Text style={styles.terms}>Первые 7 дней бесплатно. Отмена в любой момент.</Text>
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
  title: { ...typography.title, color: colors.text },

  hero: {
    marginTop: spacing.base,
    backgroundColor: colors.goldTint,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  heroLabel: { ...typography.micro, color: colors.accent, textTransform: 'uppercase' },
  heroTitle: { ...typography.title, color: colors.text, marginTop: spacing.xs },
  price: { ...typography.display, color: colors.text, marginTop: spacing.sm },
  priceNote: { ...typography.caption, color: colors.subtext, marginTop: 2 },

  plans: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.base },
  plan: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.base,
    alignItems: 'center',
  },
  planSelected: { borderColor: colors.accent, backgroundColor: colors.goldTint },
  popularBadge: { ...typography.micro, color: colors.accent, marginBottom: spacing.xs + 2 },
  planTitle: { ...typography.body, color: colors.text },
  planPrice: { ...typography.heading, color: colors.text, marginTop: spacing.sm },
  planNote: { ...typography.micro, color: colors.subtext, marginTop: spacing.xs },

  perkList: { marginTop: spacing.base, gap: spacing.sm + 2 },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  perkIcon: { fontSize: 24 },
  perkText: { ...typography.bodyStrong, color: colors.text, flex: 1 },
  perkCheck: { ...typography.bodyStrong, color: colors.success },

  activeBanner: {
    marginTop: spacing.base,
    backgroundColor: colors.successTint,
    borderWidth: 2,
    borderColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
  },
  activeText: { ...typography.bodyStrong, color: colors.text },
  paymentHint: { ...typography.caption, color: colors.subtext, textAlign: 'center', marginTop: spacing.base },
  terms: { ...typography.micro, color: colors.subtext, textAlign: 'center', marginTop: spacing.md },
});

