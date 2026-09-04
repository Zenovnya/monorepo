import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedMascot } from './AnimatedMascot';
import { colors } from '../theme/colors';

/**
 * Тост-оверлей с реакцией маскота.
 *
 * Ловит события «повысил уровень», «продлил streak», «получил ачивку»
 * и показывает поверх любого экрана карточку с медведем в соответствующей
 * мимике + короткий текст. Автоматически исчезает через 3 секунды либо
 * по тапу. Несколько событий подряд встают в очередь и проигрываются
 * друг за другом.
 *
 * Использование в приложении:
 *   <MascotToastProvider>{app}</MascotToastProvider>
 *   const toast = useMascotToast();
 *   toast.show({ kind: 'level_up', title: 'Уровень 5', text: 'Ты растёшь!' });
 */

const MascotToastContext = createContext(null);

const KIND_TO_MASCOT_PROPS = {
  level_up:            { levelUp: true },
  achievement:         { achievement: true },
  streak_celebrate:    { streak: 'celebrate' },
  streak_broken:       { streak: 'broken' },
  perfect_lesson:      { perfect: true },
};

const KIND_DEFAULT_TITLE = {
  level_up:            'Уровень +1',
  achievement:         'Достижение получено',
  streak_celebrate:    'Стрик продлён',
  streak_broken:       'Стрик сорван',
  perfect_lesson:      'Идеально',
};

const SHOW_DURATION_MS = 3000;

export function MascotToastProvider({ children }) {
  const [queue, setQueue] = useState([]); // [{id, kind, title, text}]
  const [current, setCurrent] = useState(null);

  const show = useCallback((toast) => {
    const t = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: toast.kind || 'achievement',
      title: toast.title || KIND_DEFAULT_TITLE[toast.kind] || 'Успех',
      text: toast.text || '',
    };
    setQueue((q) => [...q, t]);
  }, []);

  const hideCurrent = useCallback(() => setCurrent(null), []);

  // Из очереди достаём следующий тост, когда предыдущий закрылся.
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
  }, [current, queue]);

  const ctx = useMemo(() => ({ show }), [show]);

  return (
    <MascotToastContext.Provider value={ctx}>
      {children}
      {current ? (
        <MascotToastCard
          key={current.id}
          toast={current}
          onDismiss={hideCurrent}
        />
      ) : null}
    </MascotToastContext.Provider>
  );
}

export function useMascotToast() {
  const ctx = useContext(MascotToastContext);
  if (!ctx) {
    // Fallback-заглушка, чтобы вызов не падал в тестовом окружении/сториз.
    return { show: () => {} };
  }
  return ctx;
}

function MascotToastCard({ toast, onDismiss }) {
  const opacity = useSharedValue(0);
  const translate = useSharedValue(-20);
  const timerRef = useRef(null);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 220 });
    translate.value = withTiming(0, { duration: 220 });
    timerRef.current = setTimeout(dismiss, SHOW_DURATION_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    opacity.value = withTiming(0, { duration: 200 });
    translate.value = withTiming(-20, { duration: 200 });
    // Ждём анимацию, потом убираем из провайдера.
    setTimeout(onDismiss, 220);
  }, [onDismiss, opacity, translate]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translate.value }],
  }));

  const mascotProps = KIND_TO_MASCOT_PROPS[toast.kind] || { mood: 'happy' };

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, style]}>
      <Pressable style={styles.card} onPress={dismiss}>
        <AnimatedMascot size={70} {...mascotProps} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{toast.title}</Text>
          {toast.text ? <Text style={styles.text}>{toast.text}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 40,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  title: { fontSize: 15, fontWeight: '900', color: colors.text },
  text: { fontSize: 13, color: colors.subtext, marginTop: 2, lineHeight: 18 },
});
