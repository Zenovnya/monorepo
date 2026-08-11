import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

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

  // Обновление данных юзера отдельно
  setUser: (user) => set({ user }),

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
  },
}));

export default useAppStore;