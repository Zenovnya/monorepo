import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { gamificationApi } from '../api/gamification';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { AnimatedButton } from '../components/AnimatedButton';
import { PressableScale } from '../components/PressableScale';
import { FadeInView } from '../components/motion/FadeInView';
import { brand, PaperGrain } from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';

/**
 * Экран «жизни закончились».
 *
 * Сервер отдаёт 409 с состоянием жизней, когда запас пуст. До этой правки
 * жизни вообще не проверялись, поэтому блокировки не существовало: счётчик
 * уменьшался, но урок открывался с любым значением. Теперь это настоящая
 * пауза — и её надо объяснить, а не просто «показать крестик»: иначе выглядит
 * как поломка приложения.
 *
 * Что важно для экрана:
 * - таймер живой (тикает раз в секунду), а по истечении сам доначисляет
 *   жизнь через `POST /gamification/lives/regenerate`;
 * - таймер считается по серверному `next_life_in_seconds`, а не по локальным
 *   часам: иначе перевод времени на телефоне дал бы жизни бесплатно;
 * - покупка пополнения выводится сразу — это второй, честный путь.
 */

/** «12:05» — короткий формат:mm:ss, без внешних библиотек. */
function formatCountdown(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function NoLivesScreen({ navigation, route }) {
  const queryClient = useQueryClient();
  const lease = route?.params?.lives ?? {};

  const [lives, setLives] = useState(lease.lives ?? 0);
  const [remaining, setRemaining] = useState(lease.next_life_in_seconds ?? 0);
  const regenRequested = useRef(false);

  const regenerate = useMutation({
    mutationFn: () => gamificationApi.regenerateLives(),
    onSuccess: (state) => {
      setLives(state.lives);
      setRemaining(state.next_life_in_seconds);
      queryClient.invalidateQueries({ queryKey: ['gamification-me'] });
    },
    onError: () => {
      // Сеть недоступна — просто пробуем ещё через минуту.
      regenRequested.current = false;
      setRemaining(60);
    },
  });

  // Тикаем локально между запросами: дёргать сервер каждую секунду незачем.
  useEffect(() => {
    if (lives > 0 || remaining <= 0) return undefined;
    const timer = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lives, remaining]);

  // Таймер дошёл до нуля — просим сервер доначислить.
  useEffect(() => {
    if (lives > 0 || remaining > 0 || regenRequested.current) return;
    regenRequested.current = true;
    regenerate.mutate();
  }, [lives, regenerate, remaining]);

  // Вернулись в приложение — сразу проверяем, не восстановилась ли жизнь.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && lives <= 0) {
        regenRequested.current = false;
        regenerate.mutate();
      }
    });
    return () => sub.remove();
  }, [lives, regenerate]);

  const ready = lives > 0;

  return (
    <View style={styles.container}>
      <PaperGrain />
      <View style={styles.header}>
        <PressableScale
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          style={styles.closeBtn}
          scale={0.94}
        >
          <Text style={styles.closeText}>✕</Text>
        </PressableScale>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.body}>
        <FadeInView index={0}>
          <AnimatedMascot
            size={140}
            emotion={ready ? 'happy' : 'empathy'}
            talking={ready}
          />
        </FadeInView>

        <FadeInView index={1}>
          <Text style={styles.title}>
            {ready ? 'Жизни восстановились' : 'Жизни закончились'}
          </Text>
          <Text style={styles.subtitle}>
            {ready
              ? 'Можно продолжать — серия ошибок больше не блокирует уроки.'
              : 'Жизни тратятся на ошибки в уроках. Одна жизнь восстанавливается каждые 20 минут — просто подождите или пополните запас в магазине.'}
          </Text>
        </FadeInView>

        {!ready ? (
          <FadeInView index={2} style={styles.card}>
            <View style={styles.timerRow}>
              <Text style={styles.timerLabel}>Следующая жизнь через</Text>
              <Text style={styles.timerValue} accessibilityLiveRegion="polite">
                {formatCountdown(remaining)}
              </Text>
            </View>
            <View style={styles.heartsRow}>
              {Array.from({ length: lease.max_lives ?? 5 }).map((_, idx) => (
                <Text
                  key={idx}
                  style={[styles.heart, idx >= lives && styles.heartEmpty]}
                >
                  {idx < lives ? '❤️' : '🤍'}
                </Text>
              ))}
            </View>
            {regenerate.isPending ? (
              <Text style={styles.hint}>Проверяем жизни…</Text>
            ) : null}
          </FadeInView>
        ) : null}

        <View style={styles.actions}>
          <AnimatedButton
            title={ready ? 'Вернуться к учёбе' : 'Пополнить в магазине'}
            onPress={() =>
              ready
                ? navigation.goBack()
                : navigation.replace('Shop', { highlight: 'life_refill' })
            }
          />
          {!ready ? (
            <PressableScale
              onPress={() => navigation.goBack()}
              style={styles.ghostBtn}
              scale={0.96}
            >
              <Text style={styles.ghostText}>Назад к программе</Text>
            </PressableScale>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: brand.rule,
  },
  closeText: { fontSize: 16, fontWeight: '900', color: colors.text },
  headerSpacer: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 18,
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.subtext,
    textAlign: 'center',
  },
  card: {
    marginTop: 22,
    alignSelf: 'stretch',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: brand.rule,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  timerRow: { alignItems: 'center', gap: 4 },
  timerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.subtext,
    textTransform: 'uppercase',
  },
  timerValue: {
    fontSize: 32,
    fontWeight: '900',
    color: brand.red,
    fontVariant: ['tabular-nums'],
  },
  heartsRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  heart: { fontSize: 20 },
  heartEmpty: { opacity: 0.45 },
  hint: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    color: colors.subtext,
  },
  actions: { marginTop: 26, alignSelf: 'stretch', gap: 10 },
  ghostBtn: { alignItems: 'center', paddingVertical: 10 },
  ghostText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.subtext,
  },
});
