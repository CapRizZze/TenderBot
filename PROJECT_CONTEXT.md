# AI Tender Bot: Полный контекст проекта

## Назначение проекта

`AI Tender Bot` — это приложение на `Next.js` для:

- получения тендеров из `Saby Trade`;
- локального кэширования тендеров в `PostgreSQL`;
- оценки релевантности тендеров под конкретный бизнес-профиль;
- анализа выбранного тендера и его документов через LLM-чат.

Основная бизнес-цель продукта:

- не читать вручную большой объём нерелевантных тендеров;
- быстро выделять подходящие и спорные тендеры;
- ускорять технический и управленческий анализ закупки;
- помогать принимать решение по участию в тендере.

Этот файл предназначен для передачи любой нейросети, LLM или агенту разработки как стартовый контекст проекта.

## Обязательное правило сопровождения

Этот файл нужно **обязательно обновлять**, если меняется:

- архитектура проекта;
- структура БД;
- логика интеграции с `Saby`;
- auth flow;
- логика `SearchProfile`;
- scoring;
- onboarding первого входа;
- API routes;
- ключевые UI-сценарии;
- способ работы приложения в целом.

Если файл устареет, любая следующая нейросеть начнёт делать неверные выводы о проекте.

## Краткое текущее состояние

На `2026-06-09` в проекте уже есть:

- авторизация через `NextAuth`;
- локальный кэш тендеров в `PostgreSQL`;
- пользовательская привязка тендеров через `requestName`;
- `SearchProfile`;
- DeepSeek-scoring карточек тендеров;
- ручной feedback по скорингу;
- таблица `SabySource`;
- ручное обновление тендеров из интерфейса;
- отображение статистики Saby по лимитам.

Важно:

- часть обсуждавшихся продуктовых идей **ещё не реализована**;
- в этом документе разделяются:
  - текущее рабочее состояние;
  - найденные runtime-факты;
  - будущие планы.

## Технологический стек

- `Next.js 14`
- `TypeScript`
- `React`
- `Tailwind CSS`
- `NextAuth`
- `PostgreSQL`
- `Prisma`
- `zod`
- `DeepSeek`
- `Nodemailer`

## Структура репозитория

Основные каталоги:

- `app/`
  - App Router страницы и API routes
- `components/`
  - UI shell, sidebar, chat, editors
- `lib/`
  - сервисы, репозитории, parser, env, Prisma client
- `prisma/`
  - схема и миграции
- `types/`
  - DTO и zod-схемы
- `tests/`
  - тесты parser, policy, DTO, presentation
- `scripts/`
  - утилиты и проверочные скрипты

Ключевые файлы:

- [auth.ts](G:\Myprojects\TenderBot\auth.ts)
- [app/page.tsx](G:\Myprojects\TenderBot\app\page.tsx)
- [prisma/schema.prisma](G:\Myprojects\TenderBot\prisma\schema.prisma)
- [lib/tender-parser/tenderParserService.ts](G:\Myprojects\TenderBot\lib\tender-parser\tenderParserService.ts)
- [lib/services/searchProfileService.ts](G:\Myprojects\TenderBot\lib\services\searchProfileService.ts)
- [lib/services/sabySourceService.ts](G:\Myprojects\TenderBot\lib\services\sabySourceService.ts)
- [app/api/tenders/route.ts](G:\Myprojects\TenderBot\app\api\tenders\route.ts)

## Авторизация

### Что реализовано сейчас

Авторизация описана в [auth.ts](G:\Myprojects\TenderBot\auth.ts).

Текущие способы входа:

- magic link по email через `Nodemailer`;
- dev fallback в локальной разработке:
  - сохранение magic link локально;
  - optional dev credentials login.

Текущее поведение:

- если пользователь не авторизован, [app/page.tsx](G:\Myprojects\TenderBot\app\page.tsx) делает redirect на `/sign-in`;
- сессия хранится как JWT;
- `session.user.id` пробрасывается в приложение.

### Желаемый продуктовый сценарий

Обсуждённая целевая логика:

1. пользователь регистрируется;
2. получает ссылку на почту;
3. подтверждает вход;
4. только после этого попадает в основное меню.

Magic-link логика уже есть, но onboarding первого входа для создания профиля пока **не реализован**.

## Основной пользовательский сценарий

### Как работает сейчас

1. пользователь входит в систему;
2. загружается главная страница;
3. подгружается список источников;
4. подгружаются или автосоздаются `SearchProfile`;
5. показываются закэшированные тендеры по активному `requestName`;
6. ручной refresh может получить свежие тендеры из Saby;
7. тендеры сохраняются в БД;
8. DeepSeek считает scoring карточек в фоне;
9. пользователь открывает тендер;
10. работает с чатом и анализом документов.

### Что запланировано, но ещё не сделано

При первом входе:

1. если у пользователя нет `SearchProfile`, показывается onboarding;
2. пользователь отвечает на фиксированные бизнес-вопросы;
3. ответы отправляются в DeepSeek;
4. создаётся draft-профиль;
5. пользователь подтверждает или редактирует его;
6. только после этого попадает в основной интерфейс.

Этого сценария в коде ещё нет.

## Текущая модель данных

Схема описана в [prisma/schema.prisma](G:\Myprojects\TenderBot\prisma\schema.prisma).

## Основные модели

### `User`

Пользователь NextAuth.

Связанные сущности:

- conversations
- keywords
- sabyRequests
- sabyApiCalls
- searchProfiles
- tenderRequestNames

### `Tender`

Закэшированная карточка тендера.

Ключевые поля:

- `externalId`
- `number`
- `title`
- `description`
- `customer`
- `placedAt`
- `deadline`
- `budget`
- `url`
- `sourceUrl`
- `sabyUrl`

### `TenderAttachment`

Файлы тендера и кэш извлечённого текста.

Ключевые поля:

- `name`
- `url`
- `mimeType`
- `size`
- `extractedText`
- `extractedTextAt`
- `extractedTextError`

### `TenderRequestName`

Пользовательская видимость тендера через `requestName`.

Важно:

- сам `Tender` хранится как общая сущность;
- доступность конкретного тендера в списке пользователя определяется через `userId + requestName`.

### `Conversation`

Один диалог на связку:

- `user + tender`

### `Message`

Сообщение внутри разговора.

## Модели релевантности и скоринга

### `SearchProfile`

Описывает бизнес-логику релевантности пользователя.

Ключевые поля:

- `name`
- `description`
- `scoringPrompt`
- `isDefault`

Связи:

- `sources`
- `rules`
- `scores`

### `SearchProfileRule`

Типы правил:

- `positive`
- `negative`
- `hard_exclude`
- `instruction`

### `TenderProfileScore`

Хранит score для одной пары:

- `tender + searchProfile`

Ключевые поля:

- `score`
- `verdict`
- `userVerdict`
- `userComment`
- `reasons`
- `positiveSignals`
- `negativeSignals`
- `suggestedRules`
- `model`

Типы verdict:

- `relevant`
- `maybe`
- `irrelevant`

## Модель источников Saby

### `SabySource`

Текущая таблица источников.

Поля:

- `name`
- `requestName`
- `description`
- `includeKeywordsText`
- `excludeKeywordsText`
- `refreshPriority`
- `refreshIntervalMin`
- `isActive`

Важно:

- сейчас это переходная модель;
- фактически источники всё ещё частично поднимаются из `.env`, а не полностью управляются через UI.

### `SearchProfileSabySource`

Связь между профилем и источником Saby.

## Текущее поведение SearchProfile

Реализовано в [lib/services/searchProfileService.ts](G:\Myprojects\TenderBot\lib\services\searchProfileService.ts).

### Что происходит сейчас

Если профилей нет, они **автосоздаются**.

Создаются 2 профиля:

- основной профиль;
- тестовый профиль.

Это текущее состояние кода, хотя продуктово обсуждался другой вариант: создавать профиль через onboarding.

### Редактирование профиля

Сейчас редактирование доступно через popup по шестерёнке:

- [components/layout/search-profile-editor.tsx](G:\Myprojects\TenderBot\components\layout\search-profile-editor.tsx)

Пользователь может менять:

- название;
- описание;
- scoring prompt;
- привязанные источники;
- правила профиля.

## Текущая логика списка тендеров и scoring

### Загрузка тендеров

На главной странице:

- берутся cached tenders из репозитория;
- активный `requestName` определяется через:
  - активный `SearchProfile`,
  - либо user keywords,
  - либо env request names.

### Ручной refresh

Обрабатывается в:

- [app/api/tenders/route.ts](G:\Myprojects\TenderBot\app\api\tenders\route.ts)

Последовательность:

1. проверка пользователя;
2. проверка cooldown;
3. проверка лимита Saby;
4. вызов parser service;
5. sync в БД;
6. привязка тендеров к текущему пользователю и `requestName`;
7. запуск scoring в фоне;
8. ответ в UI.

Scoring вынесен в background, чтобы refresh не зависал из-за DeepSeek.

### Scoring

Реализован в:

- [lib/services/tenderScoringService.ts](G:\Myprojects\TenderBot\lib\services\tenderScoringService.ts)

На текущем этапе scoring идёт:

- только по карточке тендера;
- не по полным документам на стадии shortlist.

DeepSeek получает:

- описание профиля;
- scoring prompt;
- правила;
- контекст источников;
- поля карточки тендера.

### Фильтрация verdict в UI

Сейчас в sidebar есть:

- `Подходят`
- `Спорные`
- `Не подходят`
- `Все`

По умолчанию показываются релевантные тендеры.

### Ручной feedback

Пользователь может вручную проставить:

- `relevant`
- `maybe`
- `irrelevant`

И затем использовать feedback для уточнения профиля.

## Текущая интеграция с Saby в коде приложения

### Рабочий путь в приложении сейчас

Текущее приложение пока опирается на старый parser path:

- [lib/tender-parser/tenderParserService.ts](G:\Myprojects\TenderBot\lib\tender-parser\tenderParserService.ts)

Этот путь использует:

- auth через `online.saby.ru/auth/service/`
- tender API через `online.saby.ru/tender-api/service/`
- методы вроде:
  - `SbisTenderAPI.GetTenderList`
  - `SbisTenderAPI.GetStatistics`

### Важное найденное отличие

Отдельное исследование через HAR и живые вызовы показало, что веб-клиент Saby работает по другой внутренней RPC-схеме на `trade.saby.ru`.

Эта схема может стать более правильным источником данных для будущей интеграции.

## Найденная внутренняя RPC-схема Saby

Подтверждено на `2026-06-09` по HAR и live replay.

### Endpoint'ы

1. операции по папкам и query:
- `https://trade.saby.ru/tender/service/?x_version=26.3202-36.4`

2. получение тендеров:
- `https://trade.saby.ru/service/?x_version=26.3202-36.4`

## Подтверждённые методы

### `Query.query_list`

Назначение:

- вернуть корневое дерево папок и запросов;
- вернуть содержимое конкретной папки.

Подтверждённое поведение:

- `parent = null` или `0` -> корневые папки и query;
- `parent = 854874` -> содержимое папки `IT`.

Что пришло в корне живым вызовом:

- папка `IT`, id `854874`, `kind = "folder"`
- запрос `VR`, id `-1307094`, `kind = "query"`
- запрос `Доступная среда`, id `-1391658`, `kind = "query"`
- запрос `разработка`, id `-1305708`, `kind = "query"`

Что пришло по папке `IT`:

- `Web разработка`, id `-1398341`, `kind = "query"`

Полезные поля ответа:

- `id`
- `name`
- `parent`
- `userid`
- `unread_new_count`
- `total_app_receiving_count`
- `active`
- `kind`
- `username`

### `Query.activate_registry_item`

Назначение:

- активировать выбранный запрос или папку в UI.

Пример:

- `query_id = -1398341`

Сам по себе список тендеров не возвращает.

### `Query.GetQuery`

Назначение:

- вернуть полную конфигурацию сохранённого запроса.

Подтверждённо полезные поля:

- `id`
- `queryName`
- `parent_id`
- `parent_name`
- `fts_string`
- `fts_string_exclude`
- `stateId`
- `strict_search`
- `okpd2_id_arr`
- `category_ids`
- `tradingPlatformIdArray`
- региональные и иные фильтры

Для `Web разработка`:

- `queryName = "Web разработка"`
- `parent_id = 854874`
- `parent_name = "IT"`
- `fts_string = "React, 1С-Bitrix, битрикс, лендинг"`
- `fts_string_exclude = ""`

### `Query.get_counters_by_id`

Назначение:

- вернуть счётчики по папке или query.

Подтверждённые примеры:

- папка `IT` имела счётчик порядка `274`
- `Web разработка` имела счётчик `43-46`

### `Tender.GetList`

Назначение:

- вернуть список тендеров по query.

Подтверждённые важные поля запроса:

- `fts_string`
- `fts_string_exclude`
- `queryName`
- `query_parent_id`
- `query_parent_name`
- `parent_id`
- `parent_name`
- `stateid_arr`
- `tenderType`
- `radioSearchType`
- `radioSearchTypeExclude`
- `with_folders`

Полезные поля ответа:

- `id`
- `tendernumber`
- `amount`
- `lotname`
- `tendername`
- `endofferdate`
- `regionbrief`
- `organizername`
- `organizerfullname`
- `currencybrief`
- `proctype`
- `proctype_name`
- `tpbrief`
- `tradingplatformurl`
- `industry`
- `url`
- `till_string`
- `query_names`
- `query_ids`
- `highlight`

Live replay вернул:

- реальный `recordset` тендеров;
- count около `44-46` для `Web разработка`.

## Проверка суточного лимита

Проверка сделана на `2026-06-09` через:

- `SbisTenderAPI.GetStatistics` до и после внутренних RPC-вызовов.

До вызовов:

- `DayCounter = 0`
- `DayLimit = 200`
- `DayRemaining = 200`

После вызовов:

- `Query.query_list`
- `Query.GetQuery`
- `Tender.GetList`

Результат:

- `DayCounter = 0`
- `DayLimit = 200`
- `DayRemaining = 200`

Текущий вывод:

- эти внутренние `trade.saby.ru` RPC-вызовы **не уменьшили** документированный суточный лимит в этом тесте.

Важно:

- это runtime-факт на дату проверки;
- это не официальная гарантия Saby;
- поведение может измениться.

## Текущие риски

### 1. Проблемы с кодировкой

В части файлов есть mojibake / битая кириллица после старых правок и перекодировок.

Примеры:

- [prisma/schema.prisma](G:\Myprojects\TenderBot\prisma\schema.prisma)
- [app/page.tsx](G:\Myprojects\TenderBot\app\page.tsx)
- [lib/services/searchProfileService.ts](G:\Myprojects\TenderBot\lib\services\searchProfileService.ts)

Это не обязательно ломает runtime, но создаёт техдолг и шум.

### 2. Приложение всё ещё использует старый parser path

Текущий refresh в коде пока идёт через старый `SbisTenderAPI.GetTenderList`, а не через найденную внутреннюю RPC-схему.

### 3. Автосоздание профилей

Сейчас код создаёт 2 дефолтных профиля автоматически.

Целевой onboarding при первом входе пока не реализован.

### 4. Источники Saby всё ещё частично управляются через `.env`

Несмотря на наличие `SabySource` в БД, сейчас список источников стартово синхронизируется из:

- `.env`
- `SABY_TENDER_REQUEST_NAMES`

Это переходный этап архитектуры.

## Важные API routes

- [app/api/tenders/route.ts](G:\Myprojects\TenderBot\app\api\tenders\route.ts)
  - ручной refresh тендеров
- [app/api/chat/route.ts](G:\Myprojects\TenderBot\app\api\chat\route.ts)
  - чат по выбранному тендеру
- [app/api/conversations/route.ts](G:\Myprojects\TenderBot\app\api\conversations\route.ts)
  - список разговоров
- [app/api/conversations/[tenderExternalId]/route.ts](G:\Myprojects\TenderBot\app\api\conversations\[tenderExternalId]\route.ts)
  - удаление разговора
- [app/api/tenders/[tenderExternalId]/documents/route.ts](G:\Myprojects\TenderBot\app\api\tenders\[tenderExternalId]\documents\route.ts)
  - документы тендера
- [app/api/tenders/[tenderExternalId]/score-feedback/route.ts](G:\Myprojects\TenderBot\app\api\tenders\[tenderExternalId]\score-feedback\route.ts)
  - feedback по scoring
- [app/api/search-profiles/[profileId]/route.ts](G:\Myprojects\TenderBot\app\api\search-profiles\[profileId]\route.ts)
  - обновление профиля
- [app/api/saby/statistics/route.ts](G:\Myprojects\TenderBot\app\api\saby\statistics\route.ts)
  - текущая статистика Saby

## Важные UI-компоненты

- [components/layout/app-shell.tsx](G:\Myprojects\TenderBot\components\layout\app-shell.tsx)
- [components/layout/sidebar.tsx](G:\Myprojects\TenderBot\components\layout\sidebar.tsx)
- [components/layout/search-profile-editor.tsx](G:\Myprojects\TenderBot\components\layout\search-profile-editor.tsx)
- [components/layout/refresh-tenders-button.tsx](G:\Myprojects\TenderBot\components\layout\refresh-tenders-button.tsx)
- [components/chat/chat-panel.tsx](G:\Myprojects\TenderBot\components\chat\chat-panel.tsx)

## Временные исследовательские файлы

Эти файлы относятся к исследованию интеграции и не являются бизнес-логикой приложения:

- `trade.saby.ru.har`
- `saby-tree-load.har`
- `saby-folder-expand.har`
- `tmp-check-saby-limit.js`
- `tmp-extract-payload.js`
- `tmp-probe-query-list.js`
- `tmp-query-list.json`
- `tmp-tender-getlist-live.json`

Любая следующая модель должна воспринимать их как артефакты исследования, а не как продовый код.

## Ближайшее архитектурное направление

На основании найденного сейчас логично двигаться так:

1. использовать внутреннюю RPC-схему Saby:
   - `Query.query_list`
   - `Query.GetQuery`
   - `Tender.GetList`

2. моделировать источники как:
   - папка = широкая отрасль;
   - query = более узкий сохранённый запрос;

3. строить `SearchProfile` поверх этих query-источников;

4. оставлять scoring и feedback как слой персонализации поверх широкого потока Saby.

Это направление уже технически подтверждено, но код приложения пока не мигрирован на него полностью.

## Часто используемые команды

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

Prisma generate:
```powershell
npx prisma generate
```

Prisma migrate:
```powershell
npx prisma migrate deploy
```

## Правила для любой следующей нейросети

1. Сначала прочитать этот файл.
2. Проверить, соответствует ли код текущему описанию.
3. Если структура изменилась, обновить этот файл.
4. Не путать:
   - то, что уже реализовано;
   - то, что найдено в runtime;
   - то, что только запланировано.
5. Осторожно работать с файлами, где есть кириллица и следы старых проблем кодировки.

## Короткое резюме в одном абзаце

`AI Tender Bot` — это приложение на `Next.js + Prisma + PostgreSQL` для получения и кэширования тендеров из Saby, оценки их релевантности через `SearchProfile` и `DeepSeek`, ручного feedback по скорингу и LLM-анализа тендера и документов; при этом текущая кодовая база всё ещё использует старый путь `SbisTenderAPI.GetTenderList`, но уже подтверждена рабочая внутренняя RPC-схема `trade.saby.ru` через `Query.query_list`, `Query.GetQuery` и `Tender.GetList`, включая дерево папок/запросов и отсутствие зафиксированного расхода документированного суточного лимита в тестах от `2026-06-09`.
