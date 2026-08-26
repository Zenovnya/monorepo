import apiClient from './client';

/**
 * Методы API для платежей и подписок (ЮKassa).
 */
export const paymentsApi = {
  // Статус премиум-доступа
  premiumStatus: () => apiClient.get('/payments/premium-status').then((r) => r.data),

  // Создать платёж в ЮKassa
  createPayment: (plan) =>
    apiClient.post('/payments/create-payment', { plan }).then((r) => r.data),

  // Список подписок
  subscriptions: () => apiClient.get('/payments/subscriptions').then((r) => r.data),
};