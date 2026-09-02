import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { userApi } from '../api/user';
import { useAuthStore } from '../store';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { colors } from '../theme/colors';

const goals = [
  { key: 'rights', label: 'Знать свои права', icon: '🛡️' },
  { key: 'exam', label: 'Учёба / экзамен', icon: '📚' },
  { key: 'pro', label: 'Практика юриста', icon: '⚖️' },
  { key: 'work', label: 'Для работы', icon: '💼' },
];
const minutes = [5, 10, 15];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('rights');
  const [mins, setMins] = useState(10);
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);

  const finish = async () => {
    setLoading(true);
    try {
      await userApi.onboard({ goal, minutes: mins });
      // Обновляем пользователя в сторе.
      setUser({ onboarded: true });
    } catch {
      // Игнорируем ошибку сети — онбординг считается пройденным локально.
      setUser({ onboarded: true });
    }
  };

  return (
    <View style={styles.container}>
      {/* Прогресс-точки */}
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { width: i === step ? 32 : 16, backgroundColor: i <= step ? colors.accent : colors.track },
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 0 && (
          <>
            <View style={styles.centerBlock}>
              {/* Приветственный махание лапой + говорящий рот. */}
              <AnimatedMascot size={180} wave talking />
              <View style={styles.bubble}>
                <Text style={styles.bubbleText}>
                  Привет! Я <Text style={{ fontWeight: '900' }}>LexBear</Text>. Научу тебя праву без скуки.
                </Text>
              </View>
              <Text style={styles.title}>Учи законы как в игре</Text>
              <Text style={styles.subtitle}>
                УК, КоАП, ГК, ТК — короткие уроки, живые кейсы и мишка-юрист.
              </Text>
            </View>
          </>
        )}


        {step === 1 && (
          <>
            <Text style={styles.title}>Зачем ты здесь?</Text>
            <View style={styles.grid}>
              {goals.map((g) => (
                <Pressable
                  key={g.key}
                  onPress={() => setGoal(g.key)}
                  style={[
                    styles.goalCard,
                    goal === g.key && styles.cardSelected,
                  ]}
                >
                  <Text style={styles.goalIcon}>{g.icon}</Text>
                  <Text style={styles.goalLabel}>{g.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>Сколько минут в день?</Text>
            <View style={styles.minRow}>
              {minutes.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMins(m)}
                  style={[styles.minCard, mins === m && styles.cardSelected]}
                >
                  <Text style={styles.minValue}>{m}</Text>
                  <Text style={styles.minLabel}>мин</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.subtitle}>Всегда можно поменять в настройках.</Text>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <Pressable
            style={[styles.btn, styles.btnWhite]}
            onPress={() => setStep((s) => s - 1)}
          >
            <Text style={styles.btnWhiteText}>Назад</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.btn, styles.btnGreen, { flex: 2 }]}
          onPress={step < 2 ? () => setStep((s) => s + 1) : finish}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {step < 2 ? (step === 0 ? 'Начать' : 'Дальше') : loading ? 'Готовим путь…' : 'Начать путь'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 24 },
  dot: { height: 8, borderRadius: 4 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  centerBlock: { alignItems: 'center', gap: 16 },
  bubble: {
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 14,
    maxWidth: 320,
  },
  bubbleText: { fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.subtext, textAlign: 'center', maxWidth: 300 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%', maxWidth: 360, justifyContent: 'center' },
  goalCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.track,
    borderRadius: 18,
    padding: 16,
  },
  cardSelected: { borderWidth: 3, borderColor: colors.accent, backgroundColor: '#FFF7DE' },
  goalIcon: { fontSize: 28 },
  goalLabel: { fontWeight: '700', color: colors.text, marginTop: 6 },
  minRow: { flexDirection: 'row', gap: 12, width: '100%', maxWidth: 360 },
  minCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.track,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
  },
  minValue: { fontSize: 32, fontWeight: '900', color: colors.text },
  minLabel: { fontSize: 14, color: colors.subtext },
  footer: { flexDirection: 'row', gap: 12, padding: 24, paddingBottom: 40 },
  btn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.border,
  },
  btnGreen: { backgroundColor: colors.success, shadowColor: colors.successDark, shadowOpacity: 1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 0 },
  btnWhite: { backgroundColor: colors.card },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  btnWhiteText: { color: colors.text, fontWeight: '800', fontSize: 17 },
});