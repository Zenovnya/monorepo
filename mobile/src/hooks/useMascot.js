import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mascotApi } from '../api/mascot';
import { analyticsApi } from '../api/analytics';

/**
 * MascotEngine — хук управления маскотом Lex.
 *
 * - Получает случайную фразу по триггеру (greeting, pet, case_correct, case_wrong).
 * - Обрабатывает поглаживание: увеличивает счётчик pet-count.
 * - Возвращает текущий счётчик поглаживаний (для достижения «Друг Lex»).
 */
export function useMascot() {
  const queryClient = useQueryClient();

  // Фраза по триггеру.
  const phraseQuery = useQuery({
    queryKey: ['mascot', 'phrase'],
    queryFn: () => mascotApi.phrase('greeting'),
    enabled: false,
    retry: false,
  });

  const getPhrase = (trigger) =>
    queryClient.fetchQuery({
      queryKey: ['mascot', 'phrase', trigger],
      queryFn: () => mascotApi.phrase(trigger),
      retry: false,
    });

  // Погладить маскота.
  const petMutation = useMutation({
    mutationFn: mascotApi.pet,
    onSuccess: (data) => {
      queryClient.setQueryData(['mascot', 'pet-count'], data);
      // Аналитика: событие поглаживания (fire-and-forget).
      analyticsApi.track('mascot_petted', { source: 'home_companion' }).catch(() => {});
      // Возвращаем фразу на триггер pet.
      return getPhrase('pet').catch(() => null);
    },
  });

  // Счётчик поглаживаний.
  const petCountQuery = useQuery({
    queryKey: ['mascot', 'pet-count'],
    queryFn: mascotApi.petCount,
    retry: false,
  });

  const petCount = petCountQuery.data?.pet_count ?? 0;

  const pet = async () => {
    const data = await petMutation.mutateAsync();
    let phrase = null;
    try {
      phrase = await getPhrase('pet');
    } catch {
      // фраза необязательна
    }
    return { count: data.pet_count, phrase };
  };

  return {
    pet,
    petCount,
    isLoadingPet: petMutation.isPending,
    getPhrase,
    phrase: phraseQuery.data,
  };
}