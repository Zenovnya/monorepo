import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { colors } from '../theme/colors';

const perks = [
  { i: '❤️', t: 'Без лимита жизней' },
  { i: '📶', t: 'Офлайн-кейсы' },
  { i: '⚖️', t: 'Мантия мишки эксклюзив' },
  { i: '🎯', t: 'Разбор сложных составов' },
  { i: '🚫', t: 'Без рекламы' },
];

export default function PremiumScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>LexBear Plus</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Премиум</Text>
        <Text style={styles.heroTitle}>Учись без ограничений</Text>
        <AnimatedMascot size={140} emotion="cheer" />
        <Text style={styles.price}>399 ₽ / мес</Text>
        <Text style={styles.priceNote}>или 2 990 ₽ / год · экономия 38%</Text>
      </View>

      <View style={styles.perkList}>
        {perks.map((p) => (
          <View key={p.t} style={styles.perk}>
            <Text style={styles.perkIcon}>{p.i}</Text>
            <Text style={styles.perkText}>{p.t}</Text>
            <Text style={styles.perkCheck}>✓</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.btn} onPress={() => {}}>
        <Text style={styles.btnText}>Оформить · ЮKassa</Text>
      </Pressable>
      <Text style={styles.terms}>Первые 7 дней бесплатно. Отмена в любой момент.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 18, fontWeight: '900', color: colors.text },
  title: { fontSize: 26, fontWeight: '900', color: colors.text },
  hero: {
    marginTop: 16,
    backgroundColor: '#FFF7DE',
    borderWidth: 3,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  heroLabel: { fontSize: 12, fontWeight: '900', color: colors.accent, textTransform: 'uppercase' },
  heroTitle: { fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 4 },
  price: { fontSize: 30, fontWeight: '900', color: colors.text, marginTop: 8 },
  priceNote: { fontSize: 14, color: colors.subtext, marginTop: 2 },
  perkList: { marginTop: 16, gap: 10 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 3, borderColor: colors.border, borderRadius: 16, padding: 14 },
  perkIcon: { fontSize: 24 },
  perkText: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  perkCheck: { fontSize: 16, color: colors.success, fontWeight: '900' },
  btn: {
    marginTop: 20,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 17 },
  terms: { textAlign: 'center', fontSize: 12, color: colors.subtext, marginTop: 12 },
});