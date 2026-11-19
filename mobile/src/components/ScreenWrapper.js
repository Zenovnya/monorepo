/**
 * ScreenWrapper — общая обертка экрана с учетом SafeArea.
 *
 * Зачем (редизайн по техзаданию UI/UX, §0.1):
 * - Верхний контент не должен уезжать под статус-бар iOS.
 * - Нижний индикатор Home Indicator не должен перекрывать подписи вкладок.
 *
 * `paddingTop` строго `insets.top + 8`; `paddingBottom` — минимальный отступ
 * от Home Indicator. Фон наследуется от родителя.
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * @param {React.ReactNode} children
 * @param {boolean} scroll     Использовать ScrollView вместо View.
 * @param {object} contentStyle Дополнительные стили для content-container.
 * @param {object} style       Стили для контейнера (фон, и т.д.).
 */
export function ScreenWrapper({ children, scroll = false, contentStyle, style }) {
  const insets = useSafeAreaInsets();

  const contentContainerStyle = [
    styles.content,
    { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 10) + 16 },
    contentStyle,
  ];

  if (scroll) {
    return (
      <ScrollView
        style={[styles.fill, style]}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.fill, style]}>
      <View style={contentContainerStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1 },
});

export default ScreenWrapper;
