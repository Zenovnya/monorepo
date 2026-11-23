/**
 * useTabBarHeight — высота нижнего панели навигации включительно с
 * safe-area снизу.
 *
 * Таб-бар в RootNavigator задан высотой `68 + insets.bottom`. Экраны,
 * лежащие в Tab.Navigator, должны отводить под панель столько же
 * места (с запасом), иначе нижний контент (кнопка ответа, подписи)
 * прячется под панель навигации — особенно заметно на iPhone с
 * Home Indicator.
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Базовая высота панели вне safe-area (кнопки + подписи вкладок). */
export const TAB_BAR_BASE_HEIGHT = 68;

/**
 * Возвращает полную высоту нижнего панели навигации:
 * базовая высота + нижний safe-area (Home Indicator).
 */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_BASE_HEIGHT + insets.bottom;
}

/** Нижний отступ для контента экранов в таб-навигаторе (с запасом). */
export function useTabBarContentBottom() {
  const tabBarHeight = useTabBarHeight();
  return tabBarHeight + 20;
}
