import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store';
import { syncPushToken } from '../utils/notifications';

/**
 * Хук входа в аккаунт.
 * После получения токенов сразу запрашивает реальные данные пользователя
 * через GET /auth/me и сохраняет их в сторе.
 */
export const useLogin = () => {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (payload) => authApi.login(payload),
    onSuccess: async (data) => {
      // Получаем реальные данные пользователя из БД по access-токену.
      const user = await authApi.me(data.access_token);

      setAuth({
        user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });

      // Синхронизируем push-токен устройства для рассылки уведомлений.
      syncPushToken();
    },
  });
};

/**
 * Хук регистрации аккаунта.
 * После получения токенов сразу запрашивает реальные данные пользователя
 * через GET /auth/me и сохраняет их в сторе.
 */
export const useRegister = () => {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (payload) => authApi.register(payload),
    onSuccess: async (data) => {
      const user = await authApi.me(data.access_token);

      setAuth({
        user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });

      // Синхронизируем push-токен устройства для рассылки уведомлений.
      syncPushToken();
    },
  });
};