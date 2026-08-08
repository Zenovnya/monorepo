import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import useAppStore from '../store';

export default function HomeScreen() {
  const user = useAppStore((state) => state.user);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SourceCraft</Text>
      <Text style={styles.subtitle}>
        {user ? `Привет, ${user.name ?? user.email ?? 'пользователь'}!` : 'Добро пожаловать!'}
      </Text>
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
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#555',
  },
});