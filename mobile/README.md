# SourceCraft Mobile

Мобильное приложение на **React Native + Expo**.

## Запуск

```bash
cd mobile
npm install
npm start
```

- `npm run android` — запуск на Android
- `npm run ios` — запуск на iOS
- `npm run web` — запуск в браузере

## Структура

```
src/
├── api/          # настройка axios-клиента
├── components/   # переиспользуемые UI-компоненты
├── navigation/   # React Navigation (stack + tabs)
├── screens/      # экраны приложения
├── store/        # Zustand-хранилище
└── utils/        # вспомогательные утилиты
```