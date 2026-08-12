import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../store';

export default function SettingsScreen() {
  const { isAuthenticated, logout } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Настройки</Text>
      <Text style={styles.status}>
        Статус: {isAuthenticated ? 'авторизован' : 'гость'}
      </Text>
      {isAuthenticated ? (
        <Button title="Выйти" onPress={logout} />
      ) : (
        <Button
          title="Войти (демо)"
          onPress={() => console.warn('Демо-вход убран: используйте экран авторизации')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  status: {
    marginVertical: 12,
    fontSize: 16,
    color: '#555',
  },
});