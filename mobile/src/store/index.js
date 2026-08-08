import { create } from 'zustand';

/**
 * Глобальное хранилище состояния приложения (Zustand).
 */
const useAppStore = create((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: Boolean(user) }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));

export default useAppStore;