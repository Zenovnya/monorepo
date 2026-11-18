import React, { useState } from 'react';
import { PressableScale } from '../components/PressableScale';
import { FadeInView } from '../components/motion/FadeInView';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store';
import { paymentsApi } from '../api/payments';
import { gamificationApi } from '../api/gamification';
import { analyticsApi } from '../api/analytics';
import {
  brand,
  KhokhlomaCorners,
  DocumentSectionHeader,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Каталог наград. Ключ `item` совпадает с `SHOP_ITEMS` на бэкенде
 * (app/modules/gamification/service.py) — по нему списываются гемы и выдаётся
 * эффект. Цены здесь только для показа; списание считает сервер, поэтому
 * расхождение в цене не даст купить дешевле.
 */
const items = [
  { item: 'life_refill', icon: '❤️', title: 'Пополнить жизни', price: 50, tint: brand.redSoft, border: brand.redBorder },
  { item: 'streak_freeze', icon: '🧣', title: 'Заморозка стрика', price: 200, tint: brand.infoSoft, border: brand.infoBorder },
  { item: 'outfit_top_hat', icon: '🎩', title: 'Костюм: цилиндр', price: 300, tint: brand.paperSoft, border: brand.rule },
  { item: 'outfit_judge_robe', icon: '⚖️', title: 'Мантия судьи', price: 800, tint: brand.goldSoft, border: brand.goldBorder },
  { item: 'chest_xp', icon: '🎁', title: 'Сундук XP', price: 150, tint: brand.goldSoft, border: brand.goldBorder },
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
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState(null);

  // Купленная косметика: сервер отклонит повторную покупку (409), поэтому
  // кнопку показываем сразу неактивной. Ключи — те же, что в SHOP_ITEMS.
  const outfit = user?.bear_outfit || {};
  const ownedOutfits = [
    outfit.top_hat ? 'outfit_top_hat' : null,
    outfit.judge_robe ? 'outfit_judge_robe' : null,
  ].filter(Boolean);

  /**
   * Покупка награды за гемы. Раньше кнопка только вибрировала и отправляла
   * аналитику — запрос к API не делался никогда, хотя эндпоинт и клиентский
   * метод существовали. Пользователь платил гемы «в пустоту».
   */
  const buyItem = useMutation({
    mutationFn: (it) => gamificationApi.purchaseShopItem(it.item),
    onSuccess: (data, it) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      analyticsApi.track('shop_item_purchased', { item: it.item }).catch(() => {});
      // Жизни тоже пишем в стор: до этого «Пополнить жизни» восстанавливало
      // серверный счётчик, но чип «❤️» в шапке оставался прежним до
      // перезапуска приложения.
      setUser({
        gems: data.gems,
        ...(typeof data.effect?.lives === 'number'
          ? { lives: data.effect.lives }
          : {}),
      });
      const effect = data.effect || {};
      const messages = {
        lives: `Жизни восстановлены: ${effect.lives ?? ''}`.trim(),
        xp: `Сундук открыт: +${effect.gained ?? 0} XP`,
        outfit: effect.already_owned
          ? 'Этот предмет уже был в гардеробе — гемы списаны'
          : 'Предмет добавлен в гардероб',
        streak_freeze: `Заморозок стрика: ${effect.count ?? 1}`,
      };
      setNotice(messages[effect.kind] || 'Покупка совершена');
      // Обновляем состояние геймификации и профиль, чтобы чипы сверху и
      // экран профиля показали новые XP/гемы, а не данные из кэша.
      queryClient.invalidateQueries({ queryKey: ['gamification-me'] });
      queryClient.invalidateQueries({ queryKey: ['premium-status'] });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const detail = error?.response?.data?.detail;
      setNotice(detail || 'Не удалось купить — проверьте соединение');
    },
  });

  const buyGems = useMutation({
    mutationFn: (plan) => paymentsApi.createPayment(plan),
    onSuccess: (data, plan) => {
      analyticsApi.track('gems_purchased', { plan }).catch(() => {});

      // Платёжный шлюз не настроен: ссылка ведёт на несуществующий
      // checkout.invalid. Раньше клиент молча открывал мёртвый адрес и
      // пользователь не понимал, почему гемы не пришли.
      if (data.checkout_configured === false) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setNotice(
          'Оплата пока недоступна: платёжный шлюз не подключён. Гемы можно заработать за уроки.'
        );
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (data.confirmation_url) {
        Linking.openURL(data.confirmation_url).catch(() => {
          setNotice('Не удалось открыть страницу оплаты');
        });
      }
    },
    onError: (error) => {
      const detail = error?.response?.data?.detail;
      setNotice(detail || 'Не удалось создать платёж');
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
        <PressableScale
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={[
            styles.backBtn,
          ]}
        >
          <Text style={styles.backText}>←</Text>
        </PressableScale>
        <Text style={styles.title}>Магазин</Text>
        <View style={styles.gemsChip}>
          <Text style={styles.gemsIcon}>✦</Text>
          <Text style={styles.gemsText}>{user?.gems ?? 0}</Text>
        </View>
      </View>

      {/* Награды и усиления */}
      {notice ? (
        <PressableScale
          onPress={() => setNotice(null)}
          style={[styles.notice]}
        >
          <Text style={styles.noticeText}>{notice}</Text>
        </PressableScale>
      ) : null}

      <DocumentSectionHeader
        title="Награды и предметы"
        style={styles.sectionHeader}
      />
      <View style={styles.groupCard}>
        {items.map((it, idx) => (
          // Каскад: строки входят друг за другом, а не появляются все разом.
          // Задержка ограничена в enterDelay, поэтому длинный список не «едет»
          // секундами.
          <FadeInView
            key={it.title}
            index={idx}
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
            <PressableScale
              style={[
                styles.buyBtn,
              ]}
              disabled={
                buyItem.isPending ||
                (user?.gems ?? 0) < it.price ||
                ownedOutfits.includes(it.item)
              }
              onPress={() => buyItem.mutate(it)}
            >
              <Text style={styles.buyBtnText}>
                {buyItem.isPending && buyItem.variables?.item === it.item
                  ? '…'
                  : ownedOutfits.includes(it.item)
                  ? 'В гардеробе'
                  : `${it.price} ✦`}
              </Text>
            </PressableScale>
          </FadeInView>
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
            <FadeInView
              key={b.plan}
              index={idx + 3}
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
              <PressableScale
                style={[
                  styles.buyRed,
                  buyGems.isPending && styles.btnDisabled,
                ]}
                onPress={() => buyGems.mutate(b.plan)}
                disabled={buyGems.isPending}
              >
                <Text style={styles.buyRedText}>
                  {buyGems.isPending ? '…' : b.price}
                </Text>
              </PressableScale>
            </FadeInView>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: brand.pineSoft,
    borderWidth: 1,
    borderColor: brand.pineBorder,
  },
  noticeText: {
    color: brand.pineDark,
    fontWeight: '700',
    fontSize: 13.5,
  },
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
