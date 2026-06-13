# AI Tender Bot: Актуальный контекст проекта

Дата актуализации: `2026-06-13`

## Назначение

`AI Tender Bot` — это приложение на `Next.js` для:

- получения тендеров из `Saby Trade`;
- локального кэша тендеров и вложений в `PostgreSQL`;
- отбора тендеров под бизнес-профиль пользователя;
- анализа выбранного тендера и его документов через чат.

Главная цель продукта:

- не просматривать вручную большой поток нерелевантных закупок;
- быстро выделять подходящие и спорные тендеры;
- сохранять историю анализа и обратной связи по тендерам.

## Обязательное правило сопровождения

Этот файл нужно обновлять после любых значимых изменений, если затронуты:

- структура БД;
- интеграция с `Saby`;
- refresh flow;
- `SearchProfile`;
- scoring;
- ключевые API routes;
- ключевые UI-сценарии.

Если код изменился, а этот файл нет, значит контекст устарел и ему нельзя доверять как источнику текущей правды.

## Текущее состояние на сегодня

Сейчас в проекте уже реализовано:

- авторизация через `NextAuth`;
- локальное хранение тендеров, вложений, чатов и оценок;
- поддержка двух режимов интеграции с `Saby`:
  - старый `legacy`;
  - новый `rpc`;
- синхронизация структуры `папка -> запрос` из `Saby`;
- привязка `SearchProfile` к `SabyQuery`;
- ручное обновление тендеров по выбранному запросу;
- кэширование полученных тендеров в БД;
- сохранение из Saby реального типа закупки (`Электронный аукцион`, `Запрос котировок` и т.д.);
- сохранение исходной площадки тендера (`ZakazRF`, `РТС-тендер` и т.д.) и её URL отдельно от ссылки на карточку Saby;
- scoring тендеров по профилю;
- ручной feedback по оценке тендера;
- чат по выбранному тендеру;
- автозагрузка документов тендера в карточке чата;
- логирование refresh-запросов и лимитов `Saby`.

## Что уже работает в Saby RPC

Подтверждён и используется рабочий путь через внутренний RPC `Saby`:

- `Query.query_list(parent = null)` — корень структуры;
- `Query.query_list(parent = folderId)` — содержимое папки;
- `Query.GetQuery(queryId)` — конфиг сохранённого запроса;
- `Tender.GetList(...)` — получение тендеров по query.

Что важно:

- дерево папок и запросов уже читается из `Saby`;
- для query в UI уже используется группировка по папкам;
- refresh в RPC-режиме уже умеет брать тендеры через `Tender.GetList`.
- из `Tender.GetList` подтверждённо читаются поля `proctype_name`, `proctype_brief`, `tpbrief`, `tradingplatformurl`, `tptypename`;
- карточка тендера в UI теперь должна показывать именно эти данные, а не внутреннюю классификацию `government/commercial`.

## Что всё ещё остаётся переходным

Проект уже ушёл далеко от полностью старой схемы, но переход ещё не закончен.

Пока ещё остаются переходные части:

- `SabySource` и связи через `requestName` не удалены;
- часть логики ещё поддерживает старый `legacy`-режим;
- документы тендера всё ещё завязаны на старые методы `SbisTenderAPI`, поэтому по части тендеров документы могут не находиться;
- onboarding первого пользователя под новый профильный сценарий ещё не доведён до финальной продуктовой версии.

## Главный пользовательский сценарий

Сейчас рабочий сценарий такой:

1. пользователь входит в систему;
2. открывается основная страница;
3. загружаются профили поиска;
4. загружается структура `Saby` и связанные запросы;
5. пользователь выбирает профиль и запрос;
6. вручную запускает обновление тендеров;
7. сервер получает тендеры из `Saby`;
8. сервер сохраняет их в БД;
9. сервер сразу считает `profileScore` для тендеров;
10. тендеры появляются в списке и раскладываются по вкладкам:
    - `Все`
    - `Подходят`
    - `Спорные`
    - `Не подходят`
11. пользователь открывает тендер;
12. система подгружает документы тендера;
13. пользователь работает с чатом и анализом.

## Важное недавнее изменение

Раньше проблема была в том, что тендеры появлялись только во вкладке `Все`, а вкладки по релевантности были пустыми.

Причина:

- вкладки фильтруются не по факту наличия тендера, а по `profileScore`;
- `profileScore` не создавался, если внешний `DeepSeek` не отрабатывал.

Что изменено:

- в `tenderScoringService` добавлен локальный фолбэк-скоринг по правилам профиля;
- ручной refresh теперь ждёт завершения scoring, а не отправляет его только в фон;
- уже сохранённые тендеры были пересчитаны локально.

Это значит:

- даже без рабочего `DeepSeek`-ключа вкладки релевантности теперь должны заполняться;
- `DeepSeek` остаётся основным режимом, но не является единственной точкой отказа.

## Технологический стек

- `Next.js 14`
- `TypeScript`
- `React`
- `Tailwind CSS`
- `NextAuth`
- `Prisma`
- `PostgreSQL`
- `zod`
- `ai SDK`
- `DeepSeek`
- `Nodemailer`

## Ключевые каталоги

- `app/`
  - страницы и API routes
- `components/`
  - UI, sidebar, chat, редакторы
- `lib/`
  - сервисы, parser, репозитории, env, prisma
- `prisma/`
  - схема и миграции
- `types/`
  - DTO и схемы валидации
- `tests/`
  - тесты
- `scripts/`
  - утилиты и служебные скрипты

## Ключевые модели БД

Актуальная схема описана в [prisma/schema.prisma](D:/Myprojects/TenderBot/prisma/schema.prisma).

### Уже используемые основные модели

- `User`
- `Tender`
- `TenderAttachment`
- `TenderRequestName`
- `Conversation`
- `Message`
- `SearchProfile`
- `SearchProfileRule`
- `TenderProfileScore`
- `SabySource`
- `SearchProfileSabySource`

### Уже добавленные модели новой RPC-схемы

- `SabyFolder`
- `SabyQuery`
- `SearchProfileSabyQuery`
- `SabyStructureSyncRun`
- `SabyQueryRefreshRun`

Это уже не план, а реальная часть текущей схемы.

## SearchProfile и scoring

`SearchProfile` описывает, какие тендеры считать релевантными для конкретного пользователя.

Типы правил:

- `positive`
- `negative`
- `hard_exclude`
- `instruction`

Scoring сейчас работает так:

- если `DeepSeek` доступен и ключ нормальный, используется внешний LLM-scoring;
- если ключ тестовый, заглушка или вызов падает, используется локальный scoring по правилам профиля;
- результат сохраняется в `TenderProfileScore`;
- UI-фильтры используют `verdict` или `userVerdict`.

Пороговая логика verdict:

- `80-100` -> `relevant`
- `40-79` -> `maybe`
- `0-39` -> `irrelevant`

## Текущая логика refresh тендеров

Маршрут: [app/api/tenders/route.ts](D:/Myprojects/TenderBot/app/api/tenders/route.ts)

Что он делает:

- валидирует входные параметры;
- определяет, работаем ли мы в `rpc`-режиме;
- находит соответствующий `SabyQuery`, если refresh идёт по query;
- проверяет защиту от частых повторных refresh;
- читает статистику суточного лимита `Saby`;
- получает тендеры:
  - через `Tender.GetList`, если активен `rpc`;
  - через старый parser, если активен `legacy`;
- сохраняет тендеры в БД;
- сразу запускает scoring для сохранённых тендеров;
- возвращает данные для интерфейса и статистику по лимитам.

Важно:

- сообщение в route про фоновый `DeepSeek` сейчас уже устарело по смыслу и при следующей правке должно быть вычищено;
- фактически scoring на ручном refresh теперь ожидается сразу.

## Основные API routes

- [app/api/tenders/route.ts](D:/Myprojects/TenderBot/app/api/tenders/route.ts)
  - ручной refresh тендеров
- [app/api/chat/route.ts](D:/Myprojects/TenderBot/app/api/chat/route.ts)
  - чат по выбранному тендеру
- [app/api/conversations/route.ts](D:/Myprojects/TenderBot/app/api/conversations/route.ts)
  - список диалогов
- [app/api/conversations/[tenderExternalId]/route.ts](D:/Myprojects/TenderBot/app/api/conversations/[tenderExternalId]/route.ts)
  - работа с конкретным диалогом
- [app/api/tenders/[tenderExternalId]/documents/route.ts](D:/Myprojects/TenderBot/app/api/tenders/[tenderExternalId]/documents/route.ts)
  - документы тендера
- [app/api/tenders/[tenderExternalId]/score-feedback/route.ts](D:/Myprojects/TenderBot/app/api/tenders/[tenderExternalId]/score-feedback/route.ts)
  - feedback по оценке

## Основные UI-компоненты

- [components/layout/app-shell.tsx](D:/Myprojects/TenderBot/components/layout/app-shell.tsx)
- [components/layout/sidebar.tsx](D:/Myprojects/TenderBot/components/layout/sidebar.tsx)
- [components/layout/search-profile-editor.tsx](D:/Myprojects/TenderBot/components/layout/search-profile-editor.tsx)
- [components/layout/refresh-tenders-button.tsx](D:/Myprojects/TenderBot/components/layout/refresh-tenders-button.tsx)
- [components/chat/chat-panel.tsx](D:/Myprojects/TenderBot/components/chat/chat-panel.tsx)

## Известные текущие ограничения

- документы тендера находятся не для всех карточек, потому что документный API `Saby` ещё не переведён на новый надёжный RPC-путь;
- в кодовой базе ещё есть переходный слой между `legacy` и `rpc`;
- `SabySource` пока не удалён, потому что миграция на чистую query-модель ещё не завершена;
- onboarding и scheduler есть в кодовой базе частично, но продуктово ещё не считаются завершёнными.

## Что является правдой, а что планом

Уже правда:

- `SabyFolder/SabyQuery` есть в Prisma;
- структура `Saby` реально синхронизируется;
- refresh в `rpc` реально получает тендеры через `Tender.GetList`;
- scoring имеет локальный фолбэк;
- вкладки релевантности зависят от `TenderProfileScore`.

Ещё план или незавершённый переход:

- полный отказ от старого `legacy`-пути;
- перенос document-fetch на новый устойчивый механизм;
- финальная чистка старых сущностей `SabySource` / `requestName`;
- полноценный production-onboarding профиля;
- полнофункциональный scheduler как основной режим обновления.

## Временные исследовательские файлы

Это не продуктовая логика, а артефакты исследования интеграции:

- `trade.saby.ru.har`
- `saby-tree-load.har`
- `saby-folder-expand.har`
- `tmp-check-saby-limit.js`
- `tmp-extract-payload.js`
- `tmp-probe-query-list.js`
- `tmp-query-list.json`
- `tmp-tender-getlist-live.json`

Следующая модель или разработчик должны воспринимать их как исследовательские материалы, а не как основной код.

## Команды

Запуск:

```powershell
npm install
npm run dev
```

Проверка типов:

```powershell
npm run typecheck
```

Линт:

```powershell
npm run lint
```

Сборка:

```powershell
npm run build
```

Prisma:

```powershell
npx prisma generate
npx prisma migrate deploy
```

## Правило на будущее

После любых значимых изменений в архитектуре, Saby-интеграции, scoring, refresh flow или схеме БД этот файл должен обновляться в том же рабочем цикле, а не “потом”.
