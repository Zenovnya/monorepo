/**
 * Моковые данные дорожной карты для LearningPath.
 *
 * Два раздела по шесть шагов: Трудовой кодекс и Права потребителя.
 * Ключевые слова в `description` используются для липкого заголовка
 * раздела — он показывает тему шага, а не только его номер.
 *
 * В приложении дорожная карта собирается из реальных данных
 * `adaptive-overview` (темы и уроки), а этот файл — структурный
 * референс и демо-набор для компонентов.
 */

export type StepState = 'completed' | 'active' | 'locked';

export interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  state: StepState;
  reward: string;
}

export interface RoadmapSection {
  id: string;
  title: string;
  subtitle: string;
  steps: RoadmapStep[];
}

export const MOCK_ROADMAP: RoadmapSection[] = [
  {
    id: 'labor',
    title: 'Трудовой кодекс',
    subtitle: 'Базовые права и обязанности на работе',
    steps: [
      {
        id: 'labor-1',
        title: 'Трудовой договор',
        description: 'Договор · оформление · права',
        state: 'completed',
        reward: '+10 XP',
      },
      {
        id: 'labor-2',
        title: 'Испытательный срок',
        description: 'Сроки · условия · продление',
        state: 'completed',
        reward: '+10 XP',
      },
      {
        id: 'labor-3',
        title: 'Рабочее время и отпуск',
        description: 'Норма дня · план отпуска',
        state: 'active',
        reward: '+10 XP',
      },
      {
        id: 'labor-4',
        title: 'Больничный и отпуск по уходу',
        description: 'Оформление · выплаты · уход',
        state: 'locked',
        reward: '+10 XP',
      },
      {
        id: 'labor-5',
        title: 'Дисциплина труда',
        description: 'Взыскания · статьи · порядок',
        state: 'locked',
        reward: '+10 XP',
      },
      {
        id: 'labor-6',
        title: 'Увольнение',
        description: 'Порядок · выходное · пособие',
        state: 'locked',
        reward: '+10 XP',
      },
    ],
  },
  {
    id: 'consumer',
    title: 'Права потребителя',
    subtitle: 'Как защищать свои права при покупке',
    steps: [
      {
        id: 'consumer-1',
        title: 'Чеки и доказательства',
        description: 'Сохраняйте чек · документы',
        state: 'completed',
        reward: '+10 XP',
      },
      {
        id: 'consumer-2',
        title: 'Возврат товара',
        description: 'Сроки · условия · порядок',
        state: 'completed',
        reward: '+10 XP',
      },
      {
        id: 'consumer-3',
        title: 'Реклама и недостатки',
        description: 'Спор с рекламой · брак',
        state: 'active',
        reward: '+10 XP',
      },
      {
        id: 'consumer-4',
        title: 'Гарантийный срок',
        description: 'Сроки гарантии · ремонт',
        state: 'locked',
        reward: '+10 XP',
      },
      {
        id: 'consumer-5',
        title: 'Онлайн-покупки',
        description: 'Дистанционный договор · доставка',
        state: 'locked',
        reward: '+10 XP',
      },
      {
        id: 'consumer-6',
        title: 'Спор с продавцом',
        description: 'Жалоба · защита прав · суд',
        state: 'locked',
        reward: '+10 XP',
      },
    ],
  },
];
