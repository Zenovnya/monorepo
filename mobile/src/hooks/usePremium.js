import { useCallback, useEffect } from 'react';
import { AppState, Linking } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { paymentsApi } from '../api/payments';
import { analyticsApi } from '../api/analytics';

/**
 * usePremium — единый хук управления премиум-доступом.
 *
 * - Держит актуальный статус премиума (`isPremium`, `subscription`).
 * - `startCheckout(plan)` создаёт оплату у активного платёжного провайдера
 *   и открывает страницу оплаты во внешнем браузере (Linking — без нативных
 *   зависимостей; при желании позже заменяется на react-native-webview).
 * - Оплата в браузере проходит вне приложения, поэтому при возврате на
 *   передний план статус премиума автоматически перезапрашивается — как
 *   только сервер получит webhook провайдера, `isPremium` станет true.
 *
 * Провайдер платежей задаётся на бэкенде (PAYMENT_PROVIDER). Пока он не
 * настроен, `confirmation_url` — заглушка, и реального списания не будет.
 */
export function usePremium() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['premium-status'],
    queryFn: paymentsApi.premiumStatus,
    retry: false,
  });

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['premium-status'] }),
    [queryClient],
  );

  // Возврат приложения на передний план → обновляем статус (после оплаты).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const checkout = useMutation({
    mutationFn: (plan) => paymentsApi.createPayment(plan),
    onSuccess: (data, plan) => {
      analyticsApi
        .track('subscription_checkout_started', { plan })
        .catch(() => {});
      if (data?.confirmation_url) {
        Linking.openURL(data.confirmation_url).catch(() => {});
      }
    },
  });

  const startCheckout = useCallback((plan) => checkout.mutate(plan), [checkout]);

  return {
    isPremium: !!statusQuery.data?.is_premium,
    subscription: statusQuery.data?.subscription ?? null,
    isLoading: statusQuery.isLoading,
    startCheckout,
    isCheckingOut: checkout.isPending,
    checkoutError: checkout.error,
    refresh,
  };
}
