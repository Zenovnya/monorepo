import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { contentApi } from '../api/content';
import { useAuthStore } from '../store';
import { useMascot } from '../hooks/useMascot';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { SpeechBubble } from '../components/SpeechBubble';
import { colors } from '../theme/colors';

// Палитра LexBear для веток
const branchColors = ['#43A35D', '#C9A227', '#3a9dc9', '#e6784c', '#8a5cf6'];

export default function HomeScreen({ navigation }) {
  const user = useAuthStore((state) => state.user);
  const mascot = useMascot();
  const [bubbleText, setBubbleText] = useState('Привет! Выбери ветку и начнём учиться!');

  const { data: branches, isLoading, error } = useQuery({
    queryKey: ['branches'],
    queryFn: contentApi.listBranches,
  });

  const handlePet = async () => {
    try {
      const { phrase } = await mascot.pet();
      if (phrase) setBubbleText(phrase.phrase || 'Хихи, щекотно!');
    } catch {
      setBubbleText('Хихи, щекотно!');
    }
  };

  const renderBranch = ({ item, index }) => {
    const color = branchColors[index % branchColors.length];
    return (
      <Pressable
        onPress={() => navigation.navigate('Branch', { branch: item })}
        style={({ pressed }) => [
          styles.branchCard,
          { borderColor: colors.border, backgroundColor: color },
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.branchBody}>
          <Text style={styles.branchIcon}>{item.icon || '📖'}</Text>
          <Text style={styles.branchTitle}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.branchDesc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
        <Text style={styles.branchArrow}>→</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.hello}>Привет, {user?.username || 'юрист'}!</Text>
          <Text style={styles.subtitle}>Выбери ветку, чтобы учиться</Text>
        </View>
      </View>

      {/* Lex-компаньон */}
      <Pressable onPress={handlePet} style={styles.companion}>
        <AnimatedMascot />
        <SpeechBubble text={bubbleText} />
      </Pressable>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Не удалось загрузить ветки</Text>
          <Text style={styles.errorHint}>{String(error?.message || error)}</Text>
        </View>
      ) : (
        <FlatList
          data={branches}
          keyExtractor={(b) => String(b.id)}
          renderItem={renderBranch}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.errorText}>Пока нет доступных веток</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: { flex: 1 },
  hello: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.subtext, marginTop: 4 },
  companion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    gap: 12,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  branchCard: {
    borderRadius: 22,
    borderWidth: 3,
    padding: 18,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  pressed: { opacity: 0.85, transform: [{ translateY: 2 }] },
  branchBody: { flex: 1 },
  branchIcon: { fontSize: 28, marginBottom: 6 },
  branchTitle: { fontSize: 19, fontWeight: '800', color: '#fff' },
  branchDesc: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  branchArrow: { fontSize: 24, color: '#fff', marginLeft: 8 },
  errorText: { fontSize: 16, fontWeight: '700', color: colors.error, textAlign: 'center' },
  errorHint: { fontSize: 13, color: colors.subtext, textAlign: 'center', marginTop: 8 },
});