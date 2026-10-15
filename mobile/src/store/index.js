import { create } from 'zustand';
import { authApi } from '../api/auth';
import { syncPushToken } from '../utils/notifications';
import tokenStorage from '../utils/tokenStorage';

/**
 * Глобальное хранилище UI-состояния приложения (Zustand).
 * Не содержит данных авторизации — они живут в useAuthStore.
 */
const useAppStore = create(() => ({}));

/**
 * Хранилище состояния аутентификации (Zustand) — единственный источник
 * правды о пользователе и состоянии авторизации.
 * Токены хранятся в platform-specific storage, сессия восстанавливается при старте приложения.
 */
export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  isHydrated: false,

  // Сохраняет токены в platform-specific storage + юзера в память
  setAuth: async ({ user, accessToken, refreshToken }) => {
    if (accessToken) await tokenStorage.setItemAsync('accessToken', accessToken);
    if (refreshToken) await tokenStorage.setItemAsync('refreshToken', refreshToken);

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
    await tokenStorage.deleteItemAsync('accessToken');
    await tokenStorage.deleteItemAsync('refreshToken');
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  // Восстановление сессии при старте приложения
  hydrate: async () => {
    let accessToken;
    let refreshToken;

    try {
      [accessToken, refreshToken] = await Promise.all([
        tokenStorage.getItemAsync('accessToken'),
        tokenStorage.getItemAsync('refreshToken'),
      ]);
    } catch {
      // Storage may be unavailable (for example, localStorage can be blocked
      // by browser privacy settings). Never leave the app on the loader.
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isHydrated: true,
      });
      return;
    }

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
        await tokenStorage.setItemAsync('accessToken', refreshed.access_token);
        await tokenStorage.setItemAsync('refreshToken', refreshed.refresh_token);
      } catch {
        // Сессия невосстановима — выходим.
        await tokenStorage.deleteItemAsync('accessToken');
        await tokenStorage.deleteItemAsync('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      }
    }

    // Если сессия есть — синхронизируем push-токен устройства.
    syncPushToken();
  },
}));

export default useAppStore;