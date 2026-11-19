import React from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { brand } from './KhokhlomaOrnament';
import { colors } from '../theme/colors';
import { duration as durations } from '../theme/motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * Плашка «нет подключения».
 *
 * Раньше при обрыве сети экраны просто показывали ошибку загрузки без
 * объяснения причины. Плашка висит внизу и исчезает, как только связь
 * возвращается (react-query сам перезапрашивает данные — см. onlineManager
 * в App.js).
 *
 * Появление плавное: раньше она вставлялась и выдёргивалась из дерева, то есть
 * возникала одним кадром — при частых переключениях сети это выглядело как
 * мигание. Теперь она выезжает снизу и растворяется, а монтирование всё равно
 * условное: когда сети нет — плашки нет в дереве.
 */
export function OfflineBanner() {
  const [offline, setOffline] = React.useState(false);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const shown = useSharedValue(0);

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(
        state.isConnected === false || state.isInternetReachable === false
      );
    });
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (reduced) {
      shown.value = offline ? 1 : 0;
      return;
    }
    // Плашка не размонтируется: она невидима и не перехватывает касания
    // (pointerEvents="none"), зато анимация скрытия никогда не обрывается
    // на середине — раньше элемент пропадал одним кадром.
    shown.value = withTiming(offline ? 1 : 0, {
      duration: offline ? durations.enter : durations.pressOut,
      easing: offline ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [offline, reduced, shown]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 16 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { paddingBottom: 10 + (insets.bottom || 0) },
        animatedStyle,
      ]}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={styles.banner}>
        <Text style={styles.icon}>⚡</Text>
        <Text style={styles.text}>
          Нет подключения. Данные обновятся, когда сеть вернётся.
        </Text>
      </Animated.View>
    </Animated.View>
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
