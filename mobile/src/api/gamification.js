import apiClient from './client';

/**
 * Методы API для геймификации (уровни, стрики, достижения).
 */
export const gamificationApi = {
  // Текущее состояние геймификации пользователя
  me: () => apiClient.get('/gamification/me').then((r) => r.data),

  // Начисление XP
  addXp: (amount) =>
    apiClient.post('/gamification/add-xp', { amount }).then((r) => r.data),

  // Список достижений
  achievements: () => apiClient.get('/gamification/achievements').then((r) => r.data),

  // Таблица лидеров лиги текущего пользователя
  leaderboard: (limit = 30) =>
    apiClient.get('/gamification/leaderboard', { params: { limit } }).then((r) => r.data),

  // Покупка товара за гемы
  purchaseShopItem: (item) =>
    apiClient.post('/gamification/shop/purchase', { item }).then((r) => r.data),
};