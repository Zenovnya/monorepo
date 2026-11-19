import axios from 'axios';
import { NativeModules, Platform } from 'react-native';

import { useAuthStore } from '../store';

/** Порт, на котором локально слушает FastAPI (uvicorn --port 8000). */
const API_PORT = 8000;

/**
 * Возвращает хост dev-машины по данным Expo Go / Metro.
 *
 * В Expo Go для физического устройства `scriptURL` — это адрес Metro
 * (`http://192.168.1.10:8081/node_modules/...`). Берём его хост, чтобы запросы
 * уходили на компьютер, а не на сам телефон (localhost).
 */
export function getDevHost() {
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
      if (match) return match[1];
    }
  } catch {
    // SourceCode может отсутствовать (веб/нестандартный runtime).
  }
  return null;
}

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
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  // Веб: используем тот же origin (проксирование настроено на сервере).
  if (Platform.OS === 'web') {
    return '';
  }

  const host = getDevHost();
  if (host) {
    return `http://${host}:${API_PORT}`;
  }

  return `http://localhost:${API_PORT}`;
}

/**
 * Человекочитаемое описание сетевой ошибки (для форм логина/регистрации).
 *
 * Возвращает `null`, если ответ сервера был: такие ошибки (неверный пароль,
 * просроченный токен) экраны показывают из `detail` сами, своим тоном.
 *
 * Раньше строка содержала `apiClient.defaults.baseURL` и совет «backend
 * слушает 0.0.0.0:8000» — это сообщение для разработчика, а не для человека
 * с телефоном.
 */
export function describeNetworkError(error) {
  if (error?.response) return null;
  if (error?.code === 'ECONNABORTED') {
    return 'Сервер не ответил вовремя. Проверьте связь и попробуйте ещё раз.';
  }
  return 'Нет подключения. Проверьте интернет и повторите.';
}

/**
 * Человеческое объяснение ошибки запроса для экранов.
 *
 * Экраны раньше печатали `error.message` напрямую — пользователь видел
 * «Network Error» и «timeout of 10000ms exceeded». Это внутренние строки axios,
 * по которым нельзя ничего сделать. Функция сводит причины к четырём случаям,
 * в которых есть понятное действие.
 *
 * @param {unknown} error
 * @param {string} [what] Что именно грузилось: «кейсы», «уроки».
 */
export function describeLoadError(error, what = 'данные') {
  if (!error) return null;

  // Нет ответа: либо офлайн, либо backend недоступен, либо таймаут.
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return 'Сервер не ответил вовремя. Проверьте связь и повторите.';
    }
    return 'Нет подключения к серверу. Проверьте интернет — данные подгрузятся сами.';
  }

  const status = error.response.status;
  if (status === 401 || status === 403) {
    return 'Сессия истекла. Войдите снова.';
  }
  if (status === 429) {
    return 'Слишком много запросов подряд. Подождите минуту.';
  }
  if (status >= 500) {
    return `Сервер не смог отдать ${what}. Мы уже разбираемся — попробуйте позже.`;
  }
  // 4xx с понятным сообщением бэкенда показываем как есть: оно на русском и
  // адресовано пользователю (например «Кейс не найден»).
  const detail = error.response.data?.detail;
  if (typeof detail === 'string' && detail.length < 160) {
    return detail;
  }
  return `Не удалось получить ${what}. Попробуйте ещё раз.`;
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
 * Обновляет пару токенов по refresh-токену.
 *
 * Живёт здесь, а не в `api/auth.js`, чтобы не создавать цикл модулей
 * `client -> auth -> client`: при инициализации `authApi` был ещё `undefined`,
 * и первый же 401 ронял интерцептор.
 */
function refreshTokens(refreshToken) {
  return apiClient
    .post('/auth/refresh', { refresh_token: refreshToken })
    .then((r) => r.data);
}

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
      const data = await refreshTokens(refreshToken);
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