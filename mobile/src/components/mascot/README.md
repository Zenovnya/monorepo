# Маскот-медведь «Мишка-Юрист» (векторный риг)

Скелетная 2D-модель медведя на `react-native-svg` + `react-native-reanimated`.
Один самодостаточный компонент без внешних ассетов — все части (голова, уши,
глаза со зрачками и веками, брови, мордочка, рот, румянец, слеза, две лапы)
двигаются независимо через shared values.

Растровая заглушка `bear.png` в медальоне удалена: `AnimatedMascot` и
`MascotSprite` теперь просто адаптеры над этим ригом.

## Использование

```jsx
import { BearLawyerMascot } from '@/components';

<BearLawyerMascot
  emotion="joyful"          // neutral | joyful | thoughtful | sad | strict
  size={220}                // ширина в px; высота = size * 1.13 (канвас 600×680)
  isTalking={false}         // циклическая артикуляция рта поверх эмоции
  onPressMascot={() => {}}  // тап по мишке (для «погладить»)
/>
```

Семантический адаптер для экранов (обратно совместимый API):

```jsx
import { AnimatedMascot } from '@/components';

<AnimatedMascot size={180} wave talking />
<AnimatedMascot celebrate={isRight} error={isWrong} />
<AnimatedMascot size={96} levelUp={levelUpPulse} />
```

## Эмоции (`emotion`)

| Эмоция       | Что делает | Где уместна |
|--------------|-----------|-------------|
| `neutral`    | Дыхание, наклон головы, приветственный взмах лапой | Главный экран, старт урока |
| `joyful`     | Подпрыгивание, обе лапы машут, сильный прищур и румянец | Верный ответ, успешный кейс |
| `thoughtful` | Лапа у подбородка, глаза сканируют строки кодекса | Разбор ситуации, загрузка |
| `sad`        | Вздох, брови «домиком», опущенные ушки, слеза | Ошибка в кейсе, сопереживание |
| `strict`     | Ровная стойка, адвокатский жест, сведённые брови | Цитирование кодексов, предупреждения |

## Маппинг семантических пропсов `AnimatedMascot`

| Пропс | Эмоция рига |
|-------|-------------|
| `perfect` / `levelUp` / `achievement` / `celebrate` / `wave` | `joyful` |
| `streak="celebrate"` | `joyful` |
| `streak="broken"` / `error` / `emotion="sad"` | `sad` |
| `networkError` | `strict` |
| `emotion="cheer" / "happy"` | `joyful` |
| `emotion="think"` | `thoughtful` |
| `mood="concerned"` | `thoughtful` |
| по умолчанию | `neutral` |

## Как редактировать

Всё в одном файле `BearLawyerMascot.js`:

1. **Новая эмоция** — добавить `case 'my_emotion':` в `switch (emotion)` внутри
   `useEffect` и выставить значения shared values (позы лап, брови, глаза,
   румянец, слеза).
2. **Новая часть тела** — дорисовать `<Path>` в нужный z-слой SVG (лапы →
   торс → голова) и, если часть должна двигаться, обернуть в свой
   `<AnimatedG animatedProps={...}>`.
3. **Новый анимационный проп** — добавить `useSharedValue` в блок 1 и
   `useAnimatedProps` в блок 4, привязать к соответствующему `<AnimatedG>`.

## Ограничения

- Только жёсткие трансформы (rotate/translate/scale/opacity) — без mesh-деформаций.
- Точный lip-sync не поддерживается: `isTalking` циклически меняет рот, не
  синхронизируясь с речью.
- Вращение вокруг pivot реализовано паттерном `translate → rotate → translate back`.

## Историческая справка

Старая реализация `BearRig.js` + `parts.js` (сборка из ~20 независимых SVG-слоёв)
оставлена в репозитории как справка, но экранами больше не используется.
