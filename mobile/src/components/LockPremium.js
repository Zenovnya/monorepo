import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '../api/payments';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { AnimatedButton } from '../components/AnimatedButton';
import { colors } from '../theme/colors';

/**
 * LockPremium — обёртка для премиум-контента.
 * Если у пользователя нет активной подписки — показывает Paywall.
 * Иначе рендерит children.
 */
export function LockPremium({ navigation, children }) {
  const { data, isLoading } = useQuery({
    queryKey: ['premium-status'],
    queryFn: paymentsApi.premiumStatus,
    retry: false,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Проверяем доступ…</Text>
      </View>
    );
  }

  if (data?.is_premium) {
    return children;
  }

  return (
    <View style={styles.locked}>
      <AnimatedMascot />
      <Text style={styles.title}>Премиум-контент</Text>
      <Text style={styles.subtitle}>
        Этот раздел доступен только с подпиской LexBear Plus
      </Text>
      <View style={styles.footer}>
        <AnimatedButton
          title="Открыть премиум"
          onPress={() => navigation.navigate('Paywall')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loading: { fontSize: 15, color: colors.subtext },
  locked: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 16 },
  subtitle: {
    fontSize: 15,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  footer: { alignSelf: 'stretch', marginTop: 32 },
});