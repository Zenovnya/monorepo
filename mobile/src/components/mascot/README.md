# Маскот-медведь (векторный риг)

Слоёная 2D-модель медведя на `react-native-svg` + `react-native-reanimated`.
Заменяет одиночную PNG-картинку — теперь части (голова, уши, глаза, брови, рот,
руки, оверлеи) двигаются независимо через shared values.

## Использование

```jsx
import { BearRig } from '@/components';

<BearRig
  size={220}                  // ширина в px; высота считается по пропорции 400×520
  state="correct_small"       // текущее состояние (см. STATES ниже)
  mood="happy"                // модификатор поверх idle (happy | neutral | concerned | excited | sleepy)
  isTalking={false}           // если true — рот циклически сменяется (talk_loop)
  onAnimationEnd={() => {}}   // колбек по завершении one-shot анимации
/>
```

Старый `<AnimatedMascot celebrate={} error={} emotion={} />` продолжает работать —
он теперь тонкий compat-адаптер над `BearRig`.

## Список состояний (`state`)

| Категория | Состояние | Что делает |
|-----------|-----------|-----------|
| Idle | `idle` | Дефолт: моргает, дышит, изредка смотрит по сторонам |
|      | `idle_bored` | Если пользователь долго бездействует |
|      | `idle_look_around` | Принудительный look-around |
| Ответы | `correct_small` | Улыбка + короткий кивок |
|         | `correct_big` | Прыжок + широкая улыбка + звёздочки-партиклы |
|         | `wrong_soft` | Наклон головы влево + грустная брежь |
|         | `wrong_sad` | Опускание + слеза |
|         | `perfect_lesson` | Звёзды в глазах + celebration + румянец |
| Речь | `talking` | Мимика при рассказе (совмещать с `isTalking`) |
| Системные | `onboarding_wave` | Приветственный wave рукой |
|            | `streak_celebrate` | Прыжок + сердечки |
|            | `streak_broken` | Грусть + слеза |
|            | `achievement_unlock` | Кивок + звёздочки |
|            | `level_up` | Celebration + звёздочки |
|            | `loading` | Ждёт с «o»-ртом |
|            | `error_network` | Знак «?» над головой + нахмуренные брови |
|            | `notification_reminder` | Улыбка (для «не забудь позаниматься») |
|            | `goodbye` | Прощальный wave |

## Как редактировать/добавлять состояния

Всё в одном файле `BearRig.js`:

1. **Добавить новое состояние.** В константу `STATES` дописать запись:
   ```js
   my_state: { mouth: 'smile_big', brow: 'up', blush: 1, sparkles: true, oneShot: 'jump' }
   ```
   Ключи: `mouth` (см. `MOUTHS`), `brow` (`neutral`|`up`|`down`), `blush` (0..1),
   `tear`, `sparkles`, `starEyes`, `questionMark`, `zzz`, `hearts` — булевы,
   `oneShot` — имя анимации головы/тела (`nod`|`jump`|`head_tilt_left`|`slump`|
   `celebrate`|`wave`).

2. **Добавить новую one-shot анимацию.** В `useEffect ... [state]` в `switch` добавить
   `case 'my_animation':` со своими `withSequence` на `headRotation` / `bodyTranslateY` /
   `armLRotation` / `armRRotation`.

3. **Добавить новую часть медведя.** В `parts.js` добавить компонент, экспортировать
   его — и вставить `<Layer>` в нужное место z-order'а в `BearRig.js`.

## SVG-источники

Каждая часть также лежит как сырой `.svg` в `mobile/assets/mascot/`. Их можно
открыть в Illustrator/Inkscape, отредактировать и вручную синхронизировать с JSX
в `parts.js`. Плагин `react-native-svg-transformer` не подключён — сделано
намеренно, чтобы не трогать конфигурацию Metro; при желании подключить, можно
импортировать `.svg` напрямую как компоненты и упростить `parts.js`.

## Ограничения (vs Rive)

- Только жёсткие трансформы (rotate/translate/scale/opacity) — без mesh-деформаций.
- Точный lip-sync не поддерживается: `isTalking` циклически меняет рот, не
  синхронизируясь с речью (как в Duolingo).
- Редактирование анимаций — через код (без визуального timeline).
