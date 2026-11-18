import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,

} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { PressableScale } from '../components/PressableScale';
import { AnimatedButton } from '../components/AnimatedButton';
import { usePremium } from '../hooks/usePremium';
import {
  brand,
  KhokhlomaGarland,
  KhokhlomaMedallion,
  KhokhlomaCorners,
  RibbonBookmark,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

const PLANS = [
  { key: 'monthly', title: '1 месяц', price: '399 ₽/мес', note: 'Базовый тариф' },
  {
    key: 'yearly',
    title: '1 год',
    price: '2 990 ₽/год',
    note: 'Экономия 38%',
    popular: true,
  },
];

const perks = [
  { i: '❤️', t: 'Без лимита жизней', bg: brand.redSoft },
  { i: '📜', t: 'Офлайн-архив кейсов', bg: brand.infoSoft },
  { i: '⚖️', t: 'Эксклюзивная мантия мишки', bg: brand.goldSoft },
  { i: '§', t: 'Разбор сложных составов', bg: brand.goldSoft },
  { i: '✓', t: 'Без рекламы', bg: brand.pineSoft },
];

/**
 * Экран подписки LexBear Plus (PremiumScreen):
 * парадная чёрно-золотая хохломская шапка (#302820 + #D9A849 + #C9362B),
 * чистые карточки тарифов на сливочной бумаге (#F7EFDF),
 * хвойные галочки преимуществ (#315B46) и лаково-красная главная кнопка (#C9362B).
 */
export default function PremiumScreen({ navigation }) {
  const [plan, setPlan] = useState('yearly');
  const {
    isPremium,
    startCheckout,
    isCheckingOut,
    checkoutConfigured,
    checkoutError,
  } = usePremium();

  const onSubscribe = () => {
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    ).catch(() => {});
    startCheckout(plan);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PaperGrain />

      {/* Парадная лаковая шапка в эстетике хохломы */}
      <View style={styles.superHero}>
        <KhokhlomaCorners variant="onDark" size="md" inset={10} />

        <View style={styles.header}>
          <PressableScale
            onPress={() => navigation.goBack()}
            hitSlop={8}
            style={styles.closeBtn}
          >
            <Text style={styles.closeText}>✕</Text>
          </PressableScale>
          <View style={styles.superPill}>
            <Text style={styles.superPillText}>LEXBEAR PLUS</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <KhokhlomaMedallion
          size={152}
          variant="onDark"
          style={styles.heroMedallion}
        >
          <AnimatedMascot size={130} emotion="cheer" celebrate />
        </KhokhlomaMedallion>

        <Text style={styles.heroTitle}>Учитесь без ограничений</Text>
        <Text style={styles.price}>
          {plan === 'yearly' ? '2 990 ₽' : '399 ₽'} /{' '}
          {plan === 'yearly' ? 'год' : 'мес'}
        </Text>
        <Text style={styles.priceNote}>
          или{' '}
          {plan === 'yearly'
            ? '399 ₽ / мес'
            : '2 990 ₽ / год · экономия 38%'}
        </Text>

        <KhokhlomaGarland
          variant="onDark"
          count={6}
          style={styles.heroGarland}
        />
      </View>

      <View style={styles.body}>
        {isPremium ? (
          <View style={styles.activeBanner}>
            <Text style={styles.activeText}>✓ Подписка активна — спасибо!</Text>
          </View>
        ) : null}

        {/* Карточки тарифов */}
        <View style={styles.plans}>
          {PLANS.map((p) => {
            const isSelected = plan === p.key;
            return (
              <PressableScale
                key={p.key}
                onPress={() => setPlan(p.key)}
                style={[
                  styles.plan,
                  isSelected && styles.planSelected,
                ]}
              >
                {p.popular ? (
                  <RibbonBookmark
                    color={brand.red}
                    symbol="★"
                    right={12}
                    height={26}
                    width={19}
                    cutoutColor={isSelected ? brand.goldSoft : colors.card}
                  />
                ) : null}

                <View style={styles.planTopRow}>
                  {p.popular ? (
                    <View style={styles.popularChip}>
                      <Text style={styles.popularBadge}>Выбор</Text>
                    </View>
                  ) : (
                    <View />
                  )}
                  <View
                    style={[
                      styles.radio,
                      isSelected && styles.radioSelected,
                      p.popular && { marginRight: 22 },
                    ]}
                  >
                    {isSelected ? (
                      <Text style={styles.radioMark}>✓</Text>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.planTitle}>{p.title}</Text>
                <Text
                  style={[
                    styles.planPrice,
                    isSelected && styles.planPriceSelected,
                  ]}
                >
                  {p.price}
                </Text>
                <Text
                  style={[
                    styles.planNote,
                    p.popular && styles.planNotePine,
                  ]}
                >
                  {p.note}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {/* Чистый список преимуществ с хвойными галочками */}
        <View style={styles.perkCard}>
          {perks.map((p, idx) => (
            <View
              key={p.t}
              style={[
                styles.perk,
                idx < perks.length - 1 && styles.perkDivider,
              ]}
            >
              <View style={[styles.perkIconBox, { backgroundColor: p.bg }]}>
                <Text style={styles.perkIcon}>{p.i}</Text>
              </View>
              <Text style={styles.perkText}>{p.t}</Text>
              <View style={styles.perkCheckCircle}>
                <Text style={styles.perkCheck}>✓</Text>
              </View>
            </View>
          ))}
        </View>

        {checkoutConfigured === false ? (
          <View style={[styles.paymentHintBox, styles.paymentWarnBox]}>
            <Text style={styles.paymentWarn}>
              Оплата пока недоступна: платёжный шлюз не подключён. Мы сообщим,
              когда подписку можно будет оформить.
            </Text>
          </View>
        ) : checkoutError ? (
          <View style={[styles.paymentHintBox, styles.paymentWarnBox]}>
            <Text style={styles.paymentWarn}>
              Не удалось создать платёж. Проверьте соединение и попробуйте ещё
              раз.
            </Text>
          </View>
        ) : isCheckingOut ? (
          <View style={styles.paymentHintBox}>
            <Text style={styles.paymentHint}>
              Оплата открыта в браузере. После оплаты вернитесь в приложение —
              статус обновится автоматически.
            </Text>
          </View>
        ) : null}

        <View style={styles.ctaBlock}>
          <AnimatedButton
            title={isPremium ? 'Подписка активна' : 'Оформить подписку'}
            onPress={onSubscribe}
            loading={isCheckingOut}
            disabled={isPremium}
          />
          <Text style={styles.terms}>
            Первые 7 дней бесплатно. Отмена в любой момент.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  paymentWarnBox: {
    borderColor: brand.red,
    backgroundColor: brand.redSoft,
  },
  paymentWarn: {
    color: brand.red,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 44,
  },

  /* Парадная шапка — чернильный лак (#302820), лаковый красный (#C9362B) и золото (#D9A849) */
  superHero: {
    position: 'relative',
    backgroundColor: brand.ink,
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomWidth: 4,
    borderBottomColor: brand.gold,
    alignItems: 'center',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 14,
    paddingTop: 6,
    marginBottom: 12,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(252, 248, 240, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: brand.creamText,
    fontSize: 15,
    fontWeight: '700',
  },
  superPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: brand.red,
    borderWidth: 1.2,
    borderColor: brand.gold,
  },
  superPillText: {
    color: brand.creamText,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerSpacer: {
    width: 34,
  },
  heroMedallion: {
    marginVertical: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: brand.creamText,
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: -0.2,
  },
  price: {
    fontSize: 24,
    fontWeight: '800',
    color: brand.gold,
    marginTop: 4,
  },
  priceNote: {
    fontSize: 12.5,
    fontWeight: '500',
    color: 'rgba(252, 248, 240, 0.72)',
    marginTop: 2,
  },
  heroGarland: {
    marginTop: 14,
  },

  body: {
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 14,
  },
  activeBanner: {
    backgroundColor: brand.pineSoft,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: brand.pine,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  activeText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: brand.pine,
  },

  plans: {
    flexDirection: 'row',
    gap: 10,
  },
  plan: {
    position: 'relative',
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    padding: 14,
    gap: 4,
  },
  planSelected: {
    backgroundColor: brand.goldSoft,
    borderColor: brand.gold,
  },
  planPressed: {
    transform: [{ translateY: 2 }],
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
    marginBottom: 4,
  },
  popularChip: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: brand.red,
  },
  popularBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: brand.creamText,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: brand.ruleStrong,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: brand.gold,
    borderColor: brand.goldDark,
  },
  radioMark: {
    fontSize: 12,
    fontWeight: '900',
    color: brand.ink,
  },
  planTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.subtext,
  },
  planPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  planPriceSelected: {
    color: brand.ink,
  },
  planNote: {
    fontSize: 11.5,
    fontWeight: '600',
    color: brand.muted,
  },
  planNotePine: {
    color: brand.pine,
    fontWeight: '800',
  },

  perkCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderBottomWidth: 3.5,
    borderColor: brand.rule,
    overflow: 'hidden',
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  perkDivider: {
    borderBottomWidth: 1,
    borderBottomColor: brand.rule,
  },
  perkIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: brand.ink,
  },
  perkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  perkCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: brand.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkCheck: {
    fontSize: 12,
    fontWeight: '900',
    color: brand.creamText,
  },

  paymentHintBox: {
    backgroundColor: brand.infoSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brand.infoBorder,
    padding: 12,
  },
  paymentHint: {
    fontSize: 12.5,
    fontWeight: '600',
    color: brand.infoInk,
    lineHeight: 18,
  },

  ctaBlock: {
    gap: 8,
    marginTop: 2,
  },
  terms: {
    fontSize: 11.5,
    fontWeight: '500',
    color: brand.muted,
    textAlign: 'center',
  },
});
