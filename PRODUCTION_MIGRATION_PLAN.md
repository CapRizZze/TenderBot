# План миграции TenderBot к продакшен-архитектуре

Этот файл описывает согласованный технический план перехода от текущей модели `RequestName + .env + SbisTenderAPI.GetTenderList` к рабочей модели `folderId/queryId + внутренний Saby RPC + onboarding-first SearchProfile`.

Файл нужно поддерживать в актуальном состоянии. Если меняется структура БД, архитектура интеграции, onboarding, refresh flow, scheduler или модель источников Saby, этот документ нужно обновлять сразу, а не постфактум.

## 1. Что уже подтверждено

- Корень дерева Saby читается через `Query.query_list(parent = null)`.
- Содержимое папки читается через `Query.query_list(parent = folderId)`.
- Конфиг запроса читается через `Query.GetQuery(queryId)`.
- Тендеры по запросу читаются через `Tender.GetList(...)`.
- Внутренний RPC Saby в наших тестах не уменьшал документированный суточный лимит `SbisTenderAPI.GetStatistics`.

## 2. Текущее состояние приложения

- Источники Saby пока синхронизируются из `.env`.
- `SearchProfile` всё ещё автосоздаётся для нового пользователя.
- Refresh всё ещё ходит через старый `SbisTenderAPI.GetTenderList`.
- В БД уже есть переходная сущность `SabySource`, но она плоская и не отражает структуру `папка -> запрос`.

## 3. Целевая модель данных

### 3.1. Новые Prisma-модели, которые нужно добавить

#### `SabyFolder`

Широкая отрасль или папка из Saby.

Поля:

- `id: String @id @default(cuid())`
- `sabyFolderId: Int @unique`
- `name: String`
- `description: String @default("")`
- `isActive: Boolean @default(true)`
- `sortOrder: Int @default(0)`
- `createdAt: DateTime @default(now())`
- `updatedAt: DateTime @updatedAt`

Связи:

- `queries: SabyQuery[]`

#### `SabyQuery`

Конкретный сохранённый запрос внутри папки Saby.

Поля:

- `id: String @id @default(cuid())`
- `sabyQueryId: Int @unique`
- `folderId: String?`
- `name: String`
- `parentFolderName: String?`
- `ftsString: String @default("")`
- `ftsStringExclude: String @default("")`
- `rawConfigJson: Json?`
- `isActive: Boolean @default(true)`
- `lastSyncedAt: DateTime?`
- `createdAt: DateTime @default(now())`
- `updatedAt: DateTime @updatedAt`

Связи:

- `folder: SabyFolder?`
- `profiles: SearchProfileSabyQuery[]`

#### `SearchProfileSabyQuery`

Связь профиля пользователя с конкретными query-источниками.

Поля:

- `id: String @id @default(cuid())`
- `searchProfileId: String`
- `sabyQueryId: String`
- `createdAt: DateTime @default(now())`
- `updatedAt: DateTime @updatedAt`

Связи:

- `searchProfile: SearchProfile`
- `sabyQuery: SabyQuery`

Уникальность:

- `@@unique([searchProfileId, sabyQueryId])`

#### `SabyStructureSyncRun`

Журнал синка дерева Saby. Нужен для диагностики и scheduler.

Поля:

- `id: String @id @default(cuid())`
- `status: String`
- `startedAt: DateTime`
- `finishedAt: DateTime?`
- `foldersCount: Int @default(0)`
- `queriesCount: Int @default(0)`
- `error: String?`
- `metaJson: Json?`

#### `SabyQueryRefreshRun`

Журнал refresh по query. Нужен для продакшен scheduler и аналитики качества источников.

Поля:

- `id: String @id @default(cuid())`
- `sabyQueryId: String`
- `status: String`
- `startedAt: DateTime`
- `finishedAt: DateTime?`
- `tendersCount: Int @default(0)`
- `error: String?`
- `metaJson: Json?`

Связи:

- `query: SabyQuery`

### 3.2. Что не удалять сразу

На первом этапе не удаляем:

- `SabySource`
- `SearchProfileSabySource`
- `SearchProfileRequestName`

Причина:

- они нужны для dual mode миграции;
- их удаление раньше времени сломает текущий refresh и UI;
- удаление делаем только после полного cutover на `SabyFolder/SabyQuery`.

## 4. Какие сервисы нужно создать

### `lib/services/sabyRpcClient.ts`

Низкоуровневый клиент внутреннего RPC Saby.

Ответственность:

- аутентификация;
- удержание `sid`;
- вызов `https://trade.saby.ru/tender/service/?x_version=...`;
- вызов `https://trade.saby.ru/service/?x_version=...`;
- унификация `jsonrpc/protocol/id`.

Методы:

- `authenticate()`
- `callTenderService(method, params)`
- `callService(method, params)`

### `lib/services/sabyTreeService.ts`

Работа со структурой `папка -> запрос`.

Методы:

- `getRootItems()`
- `getFolderItems(folderId: number)`
- `getQueryConfig(queryId: number)`
- `getQueryCounters(queryId: number)`

### `lib/services/sabyStructureSyncService.ts`

Полный импорт структуры Saby в нашу БД.

Методы:

- `syncRootFoldersAndQueries()`
- `syncFolder(folderId: number)`
- `syncQuery(queryId: number)`

### `lib/services/sabyQueryTenderService.ts`

Получение списка тендеров по query.

Методы:

- `getTendersForQuery(queryId: number)`
- `buildTenderGetListPayload(queryConfig)`
- `normalizeRpcTenderList(result)`

### `lib/services/searchProfileOnboardingService.ts`

Генерация первого профиля пользователя через DeepSeek на основе 6 вопросов.

Методы:

- `buildDraftProfileFromAnswers()`
- `selectMatchingQueries()`
- `buildScoringPrompt()`

### `lib/services/searchProfileMigrationService.ts`

Временный сервис переноса связей со старых источников на новые query.

Методы:

- `mapLegacySourceToQuery()`
- `backfillProfileQueryLinks()`

### `lib/services/queryRefreshSchedulerService.ts`

Фоновое обновление query-источников.

Методы:

- `pickQueriesForRefresh()`
- `runScheduledRefresh()`
- `recordRefreshRun()`

## 5. В каком порядке менять код без поломки приложения

### Этап A. Завершить фиксы качества кода

Что делаем:

- исправляем битую кириллицу в UI и backend строках;
- не трогаем поведение refresh и первый вход;
- прогоняем `typecheck` и `lint`.

Статус:

- начато и частично выполнено.

### Этап B. Ввести dual mode интеграции

Что делаем:

- добавляем env-переключатель, например `SABY_INTEGRATION_MODE=legacy|rpc`;
- текущую интеграцию не удаляем;
- новый RPC-код добавляем параллельно.

Что это даёт:

- можно внедрять новую Saby RPC-модель без остановки работы текущего приложения.

### Этап C. Добавить новые Prisma-модели

Что делаем:

- добавляем `SabyFolder`;
- добавляем `SabyQuery`;
- добавляем `SearchProfileSabyQuery`;
- добавляем `SabyStructureSyncRun`;
- добавляем `SabyQueryRefreshRun`.

Что не делаем:

- не удаляем сразу старые модели `SabySource` и `SearchProfileSabySource`.

### Этап D. Реализовать read-only sync структуры Saby

Что делаем:

- реализуем `Query.query_list(parent = null)`;
- реализуем `Query.query_list(parent = folderId)`;
- реализуем `Query.GetQuery(queryId)`;
- складываем дерево в новые таблицы.

Режим:

- только чтение;
- без переключения refresh route.

### Этап E. Добавить admin route для ручного запуска синка

Что делаем:

- `POST /api/admin/saby/sync-structure`;
- логи в `SabyStructureSyncRun`.

Что это даёт:

- можно повторяемо синхронизировать структуру без изменений пользовательского потока.

### Этап F. Научить `SearchProfile` работать с query-источниками

Что делаем:

- добавляем новую DTO-модель для query;
- готовим UI, который умеет читать и показывать query вместо строковых request name;
- пока можно держать совместимость через адаптер.

Важно:

- старые связи профиля пока не удаляем;
- новый UI должен уметь жить рядом с текущим.

### Этап G. Реализовать onboarding-first flow

Что делаем:

- убираем автосоздание дефолтных профилей;
- при первом входе, если профилей нет, показываем onboarding;
- пользователь отвечает на 6 вопросов;
- DeepSeek генерирует draft `SearchProfile`;
- пользователь подтверждает или редактирует;
- после подтверждения создаём один профиль;
- затем пользователь может редактировать его через шестерёнку.

Критично:

- этот этап идёт только после появления query-источников;
- иначе DeepSeek не из чего будет выбирать.

### Этап H. Переключить refresh на `SabyQuery`

Что делаем:

- refresh route получает не `requestName`, а `queryId`;
- route читает `SabyQuery.rawConfigJson`;
- route вызывает `Tender.GetList`;
- route сохраняет тендеры и связи query -> tender -> user;
- scoring остаётся поверх этого потока.

Режим:

- только после того, как read-only sync и query DTO уже проверены.

### Этап I. Добавить scheduler

Что делаем:

- выделяем high/medium/low приоритеты query;
- фоново обновляем query по расписанию;
- пишем логи в `SabyQueryRefreshRun`.

### Этап J. Перевести UI с `RequestName` на `Folder / Query`

Что делаем:

- слева дерево:
  - папка
  - запросы внутри
- для пользователя можно показывать только выбор профиля и релевантных тендеров;
- admin-mode должен видеть структуру Saby полностью.

### Этап K. Снять legacy слой

Что делаем:

- убираем синхронизацию источников из `.env`;
- выводим из кода `SbisTenderAPI.GetTenderList` как основной путь;
- удаляем старые модели:
  - `SabySource`
  - `SearchProfileSabySource`
  - `SearchProfileRequestName`

Условие:

- только после полного cutover.

## 6. Что именно делать следующим коммитом

Следующий прикладной коммит должен сделать только это:

1. добавить Prisma-модели:
   - `SabyFolder`
   - `SabyQuery`
   - `SearchProfileSabyQuery`
   - `SabyStructureSyncRun`
   - `SabyQueryRefreshRun`
2. создать пустые сервисы:
   - `sabyRpcClient.ts`
   - `sabyTreeService.ts`
   - `sabyStructureSyncService.ts`
3. не менять пока refresh route;
4. не отключать пока автосоздание профилей;
5. не трогать пока основной UI.

Это правильный следующий безопасный шаг.

## 7. Что нельзя делать раньше времени

Нельзя:

- сразу выкидывать `.env` реестр;
- сразу удалять `SabySource`;
- сразу переводить все routes на RPC;
- сначала отключать автосоздание профилей, а потом думать про onboarding;
- делать big-bang миграцию модели данных.

Это приведёт к поломке первого входа, refresh flow и текущего UI.

## 8. Критерии готовности к продакшен cutover

- структура Saby синхронизируется автоматически;
- query-конфиг сохраняется в БД;
- refresh по query работает стабильно;
- SearchProfile выбирает query, а не строки;
- onboarding первого входа работает;
- scheduler обновляет источники без ручного refresh;
- legacy `.env/requestName` путь больше не нужен.
