# AI Tender Bot

MVP приложения для подбора и анализа государственных и коммерческих тендеров.

## Стек

- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS и shadcn/ui-подход к компонентам
- Prisma и PostgreSQL
- NextAuth v5 с Email OTP
- Vercel AI SDK и Qwen API
- Zod для DTO и входной валидации

## Локальный запуск

1. Установите зависимости:

```bash
npm install
```

2. Создайте `.env` на основе `.env.example` и заполните SMTP/Qwen-переменные. Prisma CLI также читает `DATABASE_URL` из этого файла.

3. Запустите PostgreSQL:

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

Если dev-сервер пишет `missing required error components, refreshing...`,
остановите старый процесс и запустите приложение с очисткой Next cache:

```bash
npm run dev:clean
```

## Проверки

```bash
npm run typecheck
npm run lint
npm run prisma:validate
```

## Текущий MVP

- Авторизация по email через NextAuth v5 и Prisma Adapter.
- Пользовательские ключевые слова сохраняются в PostgreSQL.
- Левая панель показывает тендеры, отфильтрованные через типизированный parser service.
- Центральная панель отправляет контекст тендера в Qwen API и получает потоковый ответ.
- Тендеры, разговоры и сообщения сохраняются в PostgreSQL.
