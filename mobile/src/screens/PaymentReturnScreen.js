import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { AnimatedButton } from '../components/AnimatedButton';
import {
  brand,
  KhokhlomaMedallion,
  PaperGrain,
} from '../components/KhokhlomaOrnament';
import { colors } from '../theme/colors';
import { paymentsApi } from '../api/payments';

/**
 * Экран возврата из платёжного шлюза.
 *
 * Пользователь платит в браузере и возвращается по deep link
 * (`lapazakona://payment-return`). Раньше возврат не был настроен вообще:
 * ссылка `PAYMENTS_RETURN_URL` была пустой, и после оплаты человек оставался
 * на странице шлюза без пути назад в приложение.
 *
 * Зачисление делает webhook провайдера, поэтому здесь мы опрашиваем статус
 * несколько секунд: обычно он уже пришёл, но при задержке шлюза показываем
 * «обрабатываем» с возможностью проверить ещё раз.
 */
export default function PaymentReturnScreen({ navigation }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('checking'); // checking | pending | active | error
  const attemptsRef = useRef(0);

  const check = async () => {
    setStatus('checking');
    try {
      const data = await paymentsApi.premiumStatus();
      if (data?.is_premium) {
        setStatus('active');
        queryClient.invalidateQueries({ queryKey: ['premium-status'] });
        queryClient.invalidateQueries({ queryKey: ['gamification-me'] });
        return;
      }
      attemptsRef.current += 1;
      // Webhook может идти пару секунд — пробуем 5 раз с интервалом.
      if (attemptsRef.current < 5) {
        setTimeout(check, 2000);
        setStatus('pending');
      } else {
        setStatus('pending');
      }
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = {
    checking: {
      title: 'Проверяем оплату',
      text: 'Уточняем статус у платёжного сервиса. Это займёт пару секунд.',
      emotion: 'thinking',
    },
    pending: {
      title: 'Оплата обрабатывается',
      text: 'Платёж принят, но подтверждение ещё не пришло. Премиум включится автоматически, как только шлюз пришлёт уведомление — обычно это занимает до минуты.',
      emotion: 'neutral',
    },
    active: {
      title: 'Подписка активна',
      text: 'Оплата прошла, LexBear Plus подключён. Приятной учёбы!',
      emotion: 'happy',
    },
    error: {
      title: 'Не удалось проверить',
      text: 'Проверьте соединение и попробуйте ещё раз. Если оплата прошла, подписка включится автоматически.',
      emotion: 'sad',
    },
  }[status];

  return (
    <View style={styles.container}>
      <PaperGrain />
      <View style={styles.body}>
        <KhokhlomaMedallion size={168} style={styles.medallion}>
          <AnimatedMascot
            size={142}
            emotion={content.emotion}
            celebrate={status === 'active'}
          />
        </KhokhlomaMedallion>

        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.text}>{content.text}</Text>

        {status === 'checking' ? (
          <ActivityIndicator
            size="small"
            color={brand.red}
            style={styles.spinner}
          />
        ) : null}

        {status !== 'checking' ? (
          <View style={styles.actions}>
            {status !== 'active' ? (
              <AnimatedButton
                title="Проверить ещё раз"
                onPress={() => {
                  attemptsRef.current = 0;
                  check();
                }}
              />
            ) : null}
            <AnimatedButton
              title="В приложение"
              variant={status === 'active' ? 'primary' : 'outline'}
              onPress={() => navigation.navigate('MainTabs')}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  medallion: {
    marginBottom: 18,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
    textAlign: 'center',
  },
  spinner: { marginTop: 18 },
  actions: {
    marginTop: 26,
    alignSelf: 'stretch',
    gap: 12,
  },
});
