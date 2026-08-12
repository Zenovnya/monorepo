import axios from 'axios';

import { authApi } from './auth';
import { useAuthStore } from '../store';

/**
 * Настроенный axios-клиент для обращения к backend API.
 * Базовый URL можно переопределить через переменную окружения
 * EXPO_PUBLIC_API_URL или константу ниже.
 */
const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Флаг, предотвращающий одновременный запуск нескольких refresh-запросов.
 * Если несколько запросов получают 401 параллельно, все они будут ждать
 * завершения одного общего обновления токенов.
 */
let isRefreshing = false;
let pendingQueue = [];

/**
 * Разрешает (resolve/reject) все запросы, ожидавшие обновления токена.
 */
const flushQueue = (error) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  pendingQueue = [];
};

/**
 * Request-интерцептор: автоматически добавляет заголовок Authorization,
 * если access-токен есть и заголовок ещё не был задан вручную.
 */
apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/**
 * Response-интерцептор: при ответе 401 пытается обновить токены через
 * refresh-токен, а затем повторяет исходный запрос.
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Если это не 401 или запрос уже был повторён после refresh — не обрабатываем.
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url === '/auth/refresh'
    ) {
      return Promise.reject(error);
    }

    const { refreshToken, logout } = useAuthStore.getState();

    // Нет refresh-токена — сессия невосстановима, выходим.
    if (!refreshToken) {
      await logout();
      return Promise.reject(error);
    }

    // Если refresh уже выполняется — просто ждём его завершения и повторяем запрос.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then(() => apiClient(originalRequest));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const data = await authApi.refresh(refreshToken);
      await useAuthStore.getState().setAuth({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });

      flushQueue();
      return apiClient(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError);
      await logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;