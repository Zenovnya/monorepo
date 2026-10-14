import axios from 'axios';
import { NativeModules, Platform } from 'react-native';

import { authApi } from './auth';
import { useAuthStore } from '../store';

/**
 * Определяет базовый URL API.
 *
 * Приоритет:
 * 1. Переменная окружения EXPO_PUBLIC_API_URL — явная настройка (релиз/прод).
 * 2. На вебе — относительный путь (тот же origin).
 * 3. В Expo dev — хост Metro-сервера, чтобы на физическом устройстве
 *    запросы шли на dev-машину, а не на само устройство (localhost).
 */
function resolveBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Веб: используем тот же origin (проксирование настроено на сервере).
  if (Platform.OS === 'web') {
    return '';
  }

  // Нативный клиент: извлекаем хост из scriptURL Metro/dev-сервера.
  // Пример: "http://192.168.1.10:8081/index.bundle" → host "192.168.1.10".
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match) {
        return `http://${match[1]}:8000`;
      }
    }
  } catch {
    // Игнорируем — fallback на localhost.
  }

  return 'http://localhost:8000';
}

/**
 * Настроенный axios-клиент для обращения к backend API.
 */
const apiClient = axios.create({
  baseURL: resolveBaseUrl(),
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