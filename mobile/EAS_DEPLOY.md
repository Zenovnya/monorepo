# Деплой мобильного приложения LexBear (Expo EAS Build)

Мобильное приложение LexBear собрано на React Native + Expo. Для сборки и распространения используется **Expo Application Services (EAS Build)**.

## Файлы конфигурации

- `mobile/eas.json` — конфигурация профилей сборки
- `mobile/app.json` — конфигурация Expo-проекта
- `.github/workflows/eas-build.yml` — CI-сборка через GitHub Actions

## Профили сборки (eas.json)

| Профиль | Назначение |
|---|---|
| `development` | Development client для локальной разработки |
| `preview` | Тестовая сборка (internal distribution) |
| `production` | Прод-сборка для публикации в магазины (`autoIncrement` версии) |

## Локальная сборка

### 1. Установка EAS CLI

```bash
cd mobile
npm install -g eas-cli
eas login
```

### 2. Preview-сборка (внутреннее тестирование)

```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

### 3. Production-сборка

```bash
eas build --profile production --platform all
```

## CI/CD через GitHub Actions

Workflow `.github/workflows/eas-build.yml` запускает сборку автоматически:

- **Вручную** через `workflow_dispatch` (параметр `profile`)
- **Автоматически** при push в `main` с изменениями в `mobile/`

Требуемый секрет в GitHub:

| Секрет | Описание |
|---|---|
| `EXPO_TOKEN` | Токен Expo (создаётся в `expo.dev → Account → Access Tokens`) |

## Публикация в магазины

После успешной production-сборки:

```bash
eas submit --platform all --profile production
```

Потребуется настроить учётные данные:
- **Android:** service account JSON (Google Play Console)
- **iOS:** App Store Connect API key

## Переменные окружения для мобильного приложения

Базовый URL API задаётся в конфигурации Expo-проекта (см. `app.json` / `src/api/client.js`). При сборке через EAS переменные окружения можно передавать через `--env` или файл `.env`.

> **Важно:** не храните секреты (JWT, ключи оплаты) в мобильном клиенте — они живут только на бэкенде.