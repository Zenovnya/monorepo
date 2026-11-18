import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from './KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Плашка «нет подключения».
 *
 * Раньше при обрыве сети экраны просто показывали ошибку загрузки без
 * объяснения причины. Плашка висит внизу и исчезает, как только связь
 * возвращается (react-query сам перезапрашивает данные — см. onlineManager
 * в App.js).
 */
export function OfflineBanner() {
  const [offline, setOffline] = React.useState(false);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(
        state.isConnected === false || state.isInternetReachable === false
      );
    });
    return unsubscribe;
  }, []);

  if (!offline) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { paddingBottom: 10 + (insets.bottom || 0) }]}
    >
      <View style={styles.banner}>
        <Text style={styles.icon}>⚡</Text>
        <Text style={styles.text}>
          Нет подключения. Данные обновятся, когда сеть вернётся.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    ...Platform.select({ web: { pointerEvents: 'none' } }),
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: brand.ruleStrong,
    backgroundColor: colors.paper,
  },
  icon: {
    fontSize: 14,
  },
  text: {
    flex: 1,
    color: colors.text,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
});
