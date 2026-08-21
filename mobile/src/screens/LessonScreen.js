import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { contentApi } from '../api/content';
import { AnimatedMascot } from '../components/AnimatedMascot';
import { AnimatedButton } from '../components/AnimatedButton';
import { SpeechBubble } from '../components/SpeechBubble';
import { colors } from '../theme/colors';

export default function LessonScreen({ route, navigation }) {
  const { lesson, branch } = route.params;

  const { data: lessonDetail, isLoading, error } = useQuery({
    queryKey: ['lesson', lesson.id],
    queryFn: () => contentApi.getLesson(lesson.id),
  });

  const { data: cases } = useQuery({
    queryKey: ['lesson-cases', lesson.id],
    queryFn: () => contentApi.listCases(lesson.id),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Не удалось загрузить урок</Text>
      </View>
    );
  }

  const content = lessonDetail?.content || lesson.content || '';
  const hasCases = !!cases && cases.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.branchTitle}>{branch?.title}</Text>
      </View>

      <View style={styles.mascotRow}>
        <AnimatedMascot />
        <SpeechBubble text="Изучи теорию, а потом проверим на практике!" />
      </View>

      <Text style={styles.lessonTitle}>{lessonDetail?.title || lesson.title}</Text>

      {content ? (
        <View style={styles.card}>
          <Text style={styles.contentText}>{content}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>
          В этом уроке пока нет теоретического материала.
        </Text>
      )}

      <View style={styles.footer}>
        <AnimatedButton
          title={hasCases ? 'К практике' : 'Завершить'}
          onPress={() => {
            if (hasCases) {
              navigation.navigate('Case', { lesson, cases, index: 0 });
            } else {
              navigation.goBack();
            }
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backText: { fontSize: 18, fontWeight: '800', color: colors.text },
  branchTitle: { fontSize: 16, color: colors.subtext, fontWeight: '600' },
  mascotRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 20, gap: 12 },
  lessonTitle: { fontSize: 26, fontWeight: '800', color: colors.text, paddingHorizontal: 20, marginTop: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 18,
    marginHorizontal: 20,
    marginTop: 16,
  },
  contentText: { fontSize: 16, lineHeight: 24, color: colors.text },
  hint: { paddingHorizontal: 20, marginTop: 16, color: colors.subtext },
  footer: { paddingHorizontal: 20, marginTop: 24 },
  errorText: { fontSize: 15, fontWeight: '700', color: colors.error },
});