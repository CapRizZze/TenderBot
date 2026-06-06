# AI Tender Bot

MVP приложения для подбора и анализа тендеров.

## Стек

- Next.js 14 (App Router)
- TypeScript (strict)
- Prisma + PostgreSQL
- NextAuth v5 (email OTP)
- Vercel AI SDK + DeepSeek (OpenAI-compatible)
- Zod

## Локальный запуск

1. Установите зависимости:

```bash
npm install
```

2. Создайте `.env` на основе `.env.example`.
3. Поднимите PostgreSQL:

```bash
docker compose up -d
```

4. Примените миграции и сгенерируйте Prisma Client:

```bash
npm run prisma:migrate
npm run prisma:generate
```

5. Запустите приложение:

```bash
npm run dev
```

## Проверки

```bash
npm run typecheck
npm run lint
npm run prisma:validate
```

## Парсер тендеров

Поддерживаются режимы:

- `mock` — локальные тестовые данные;
- `rest` — внешний REST endpoint;
- `saby` — интеграция с Saby API (`auth/service` + `tender-api/service`).

Основные переменные для `saby`:

- `SABY_AUTH_URL`
- `SABY_TENDER_API_URL`
- `SABY_LOGIN`
- `SABY_PASSWORD`
- `SABY_TENDER_METHODS`
- `SABY_PAGE_SIZE`
