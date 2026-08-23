import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../api/auth';
import { syncPushToken } from '../utils/notifications';

/**
 * Глобальное хранилище UI-состояния приложения (Zustand).
 * Не содержит данных авторизации — они живут в useAuthStore.
 */
const useAppStore = create(() => ({}));

/**
 * Хранилище состояния аутентификации (Zustand) — единственный источник
 * правды о пользователе и состоянии авторизации.
 * Токены хранятся в SecureStore, сессия восстанавливается при старте приложения.
 */
export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  isHydrated: false,

  // Сохраняет токены в SecureStore + юзера в память
  setAuth: async ({ user, accessToken, refreshToken }) => {
    if (accessToken) await SecureStore.setItemAsync('accessToken', accessToken);
    if (refreshToken) await SecureStore.setItemAsync('refreshToken', refreshToken);

    set({
      user: user ?? get().user,
      accessToken: accessToken ?? get().accessToken,
      refreshToken: refreshToken ?? get().refreshToken,
      isAuthenticated: true,
    });
  },

  // Обновление данных юзера отдельно (частичное обновление полей)
  setUser: (patch) => set((state) => ({ user: { ...(state.user || {}), ...patch } })),

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  // Восстановление сессии при старте приложения
  hydrate: async () => {
    const accessToken = await SecureStore.getItemAsync('accessToken');
    const refreshToken = await SecureStore.getItemAsync('refreshToken');

    set({
      accessToken,
      refreshToken,
      isAuthenticated: !!accessToken,
      isHydrated: true,
    });

    // Если сессии нет — выходим.
    if (!accessToken) return;

    // Подгружаем актуальные данные пользователя по access-токену.
    try {
      const user = await authApi.me(accessToken);
      set({ user });
    } catch {
      // Не удалось получить пользователя — токен мог истечь. Пробуем refresh.
      try {
        const refreshed = await authApi.refresh(refreshToken);
        const user = await authApi.me(refreshed.access_token);

        set({
          user,
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token,
          isAuthenticated: true,
        });
        await SecureStore.setItemAsync('accessToken', refreshed.access_token);
        await SecureStore.setItemAsync('refreshToken', refreshed.refresh_token);
      } catch {
        // Сессия невосстановима — выходим.
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      }
    }

    // Если сессия есть — синхронизируем push-токен устройства.
    syncPushToken();
  },
}));

export default useAppStore;