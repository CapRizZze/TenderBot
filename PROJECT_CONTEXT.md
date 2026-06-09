# AI Tender Bot: Full Project Context

## Purpose

`AI Tender Bot` is a Next.js application for collecting tenders from Saby Trade, caching them locally, scoring their relevance for a specific business profile, and then letting the user analyze a chosen tender through LLM-assisted chat.

The product goal is:

- reduce time spent reading irrelevant tenders;
- surface only relevant or potentially relevant tenders;
- analyze tender content and attached documents faster;
- support quick decision-making for managers and technical specialists.

This file is intended to be fed into any LLM or coding agent as project context.

## Mandatory Maintenance Rule

This file must be updated whenever any of the following changes:

- project architecture;
- data model;
- Saby integration flow;
- auth flow;
- scoring logic;
- first-login/onboarding logic;
- API routes;
- database schema;
- important UI flows.

If this file becomes stale, any LLM working from it may make incorrect assumptions and damage development velocity.

## Current State Summary

As of `2026-06-09`, the project already contains:

- authentication via NextAuth;
- tender caching in PostgreSQL;
- per-user tender visibility scoping;
- `SearchProfile` support;
- DeepSeek-based tender card scoring;
- manual score feedback (`relevant / maybe / irrelevant`);
- `SabySource` records in the database;
- manual refresh from Saby via the app;
- Saby statistics display in the UI.

Important: some planned product ideas discussed in chat are **not implemented yet**. This document distinguishes current implementation from future direction.

## Tech Stack

- Framework: `Next.js 14`
- Language: `TypeScript`
- UI: `React`, `Tailwind CSS`
- Auth: `NextAuth`
- Database: `PostgreSQL`
- ORM: `Prisma`
- Validation: `zod`
- LLM scoring / analysis: `DeepSeek`
- Email login: `Nodemailer` provider through NextAuth

## Repository Layout

Key directories and files:

- `app/`
  - App Router pages and API routes
- `components/`
  - UI shell, sidebar, chat panel, editors
- `lib/`
  - services, repositories, parser, env, Prisma client
- `prisma/`
  - schema and migrations
- `types/`
  - DTOs and zod-backed schemas
- `tests/`
  - parser, DTO, policy, presentation tests
- `scripts/`
  - utility and validation scripts

Important root files:

- [auth.ts](G:\Myprojects\TenderBot\auth.ts)
- [app/page.tsx](G:\Myprojects\TenderBot\app\page.tsx)
- [prisma/schema.prisma](G:\Myprojects\TenderBot\prisma\schema.prisma)
- [lib/tender-parser/tenderParserService.ts](G:\Myprojects\TenderBot\lib\tender-parser\tenderParserService.ts)
- [lib/services/searchProfileService.ts](G:\Myprojects\TenderBot\lib\services\searchProfileService.ts)
- [lib/services/sabySourceService.ts](G:\Myprojects\TenderBot\lib\services\sabySourceService.ts)
- [app/api/tenders/route.ts](G:\Myprojects\TenderBot\app\api\tenders\route.ts)

## Auth Flow

### Current Implementation

Auth is implemented in [auth.ts](G:\Myprojects\TenderBot\auth.ts).

Current modes:

- email magic link through `Nodemailer`;
- local dev fallback:
  - saved magic link in dev;
  - optional dev credentials login in development.

Important current behavior:

- if user is not authenticated, [app/page.tsx](G:\Myprojects\TenderBot\app\page.tsx) redirects to `/sign-in`;
- session strategy is JWT;
- authenticated session stores `session.user.id`.

### Product Requirement Discussed

The desired business flow is:

1. user registers;
2. user receives link by email;
3. user verifies and signs in;
4. only after auth can user access the main application.

Current implementation already supports magic-link sign-in, but first-login onboarding for search profile generation is **not yet implemented**.

## Main User Flow

### Current Flow

1. user signs in;
2. main page loads;
3. current request source list is loaded;
4. search profiles are loaded or auto-created;
5. cached tenders are shown for the active request name;
6. manual refresh can fetch fresh tenders from Saby;
7. fetched tenders are stored in DB;
8. DeepSeek scores tender cards in the background;
9. user opens a tender;
10. user chats with LLM and can analyze documents.

### Planned But Not Yet Implemented

At first login:

1. if user has no profile, show SearchProfile onboarding wizard;
2. ask fixed business questions;
3. send answers to DeepSeek;
4. generate draft `SearchProfile`;
5. let user approve or edit;
6. then enter main UI.

This onboarding flow is still a plan, not current code.

## Current Data Model

Defined in [prisma/schema.prisma](G:\Myprojects\TenderBot\prisma\schema.prisma).

### Core Models

#### `User`

- standard NextAuth user
- owns:
  - conversations
  - keywords
  - Saby logs
  - search profiles
  - scoped tender links

#### `Tender`

Cached tender card.

Key fields:

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

#### `TenderAttachment`

Tender file metadata and extracted text cache.

Key fields:

- `name`
- `url`
- `mimeType`
- `size`
- `extractedText`
- `extractedTextAt`
- `extractedTextError`

#### `TenderRequestName`

Per-user visibility binding between tender and request name.

Important:

- a tender itself is shared as a cached entity;
- visibility by request name is user-scoped through `userId`.

#### `Conversation`

One conversation per `user + tender`.

#### `Message`

Chat messages inside one conversation.

### Relevance / Scoring Models

#### `SearchProfile`

Represents user/business filtering logic.

Current fields:

- `name`
- `description`
- `scoringPrompt`
- `isDefault`

Relations:

- `sources`
- `rules`
- `scores`

#### `SearchProfileRule`

Rule types:

- `positive`
- `negative`
- `hard_exclude`
- `instruction`

#### `TenderProfileScore`

Stores score for one `tender + searchProfile`.

Key fields:

- `score`
- `verdict`
- `userVerdict`
- `userComment`
- `reasons`
- `positiveSignals`
- `negativeSignals`
- `suggestedRules`
- `model`

Verdicts:

- `relevant`
- `maybe`
- `irrelevant`

### Saby Source Model

#### `SabySource`

Current DB model for source definitions.

Fields:

- `name`
- `requestName`
- `description`
- `includeKeywordsText`
- `excludeKeywordsText`
- `refreshPriority`
- `refreshIntervalMin`
- `isActive`

Important: current implementation still treats source definitions as synced from `.env`, not yet as fully admin-managed records.

#### `SearchProfileSabySource`

Join table between profile and source.

## Current SearchProfile Behavior

Implemented in [lib/services/searchProfileService.ts](G:\Myprojects\TenderBot\lib\services\searchProfileService.ts).

### Current Reality

Profiles are auto-created if absent.

Two default profiles are created:

- main admin profile;
- test profile.

This is current code behavior, even though the intended product direction is to replace this with onboarding-based profile creation.

### Current Profile Editing

Profile editing is exposed in the gear popup via:

- [components/layout/search-profile-editor.tsx](G:\Myprojects\TenderBot\components\layout\search-profile-editor.tsx)

User can edit:

- profile name;
- profile description;
- scoring prompt;
- linked sources;
- rule lists.

## Current Tender List / Scoring Behavior

### Tender Loading

Current main page logic:

- page loads cached tenders via repository;
- active request name comes from:
  - active search profile request names;
  - or user keywords;
  - or env-configured request names.

### Manual Refresh

Handled by:

- [app/api/tenders/route.ts](G:\Myprojects\TenderBot\app\api\tenders\route.ts)

Flow:

1. authenticate current user;
2. enforce refresh cooldown;
3. optionally check daily Saby limit;
4. fetch tenders via parser service;
5. sync tenders to DB;
6. scope them to current user + request name;
7. trigger DeepSeek scoring in background;
8. return response to UI.

Scoring is intentionally backgrounded so refresh response is not blocked by DeepSeek.

### Scoring

Implemented in:

- [lib/services/tenderScoringService.ts](G:\Myprojects\TenderBot\lib\services\tenderScoringService.ts)

Current scoring uses:

- tender card only;
- not full attachments at shortlist stage.

DeepSeek gets:

- profile description;
- scoring prompt;
- rules;
- source context;
- tender card fields.

### UI Verdicts

Current sidebar supports:

- `Подходят`
- `Спорные`
- `Не подходят`
- `Все`

Default filter currently shows only relevant tenders.

### Manual Feedback

User can override verdict:

- relevant
- maybe
- irrelevant

Feedback can also be applied back into the profile as rule generation logic.

## Current Saby Integration in App Code

### Current Production App Path

The application code currently still uses the old documented Saby parser path in:

- [lib/tender-parser/tenderParserService.ts](G:\Myprojects\TenderBot\lib\tender-parser\tenderParserService.ts)

This path is based on:

- auth via `online.saby.ru/auth/service/`
- tender list via `online.saby.ru/tender-api/service/`
- methods such as:
  - `SbisTenderAPI.GetTenderList`
  - `SbisTenderAPI.GetStatistics`

### Important Discovery

Separate runtime investigation proved that Saby web UI itself uses a different internal RPC flow on `trade.saby.ru`, described below.

This internal RPC path is working and may become the future integration path.

## Investigated Internal Saby RPC Flow

The following was confirmed by HAR analysis and live replay on `2026-06-09`.

### RPC Endpoints

1. query operations:
- `https://trade.saby.ru/tender/service/?x_version=26.3202-36.4`

2. tender list operation:
- `https://trade.saby.ru/service/?x_version=26.3202-36.4`

### Confirmed Methods

#### `Query.query_list`

Purpose:

- list root folders and root queries;
- list queries inside a folder.

Behavior confirmed:

- `parent = null` or `0` returns root entries;
- `parent = 854874` returns entries inside folder `IT`.

Observed live root result:

- folder `IT`, id `854874`, kind `folder`
- query `VR`, id `-1307094`, kind `query`
- query `Доступная среда`, id `-1391658`, kind `query`
- query `разработка`, id `-1305708`, kind `query`

Observed child result for folder `IT`:

- query `Web разработка`, id `-1398341`, kind `query`

Minimal meaning of response columns:

- `id`
- `name`
- `parent`
- `userid`
- `unread_new_count`
- `total_app_receiving_count`
- `active`
- `kind`
- `username`

#### `Query.activate_registry_item`

Purpose:

- activate chosen query/folder in UI state.

Example:

- `query_id = -1398341`

It does not return tender list directly.

#### `Query.GetQuery`

Purpose:

- return full configuration of one saved Saby query.

Confirmed useful output:

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
- region and other filters

Confirmed example:

- `queryName = "Web разработка"`
- `parent_id = 854874`
- `parent_name = "IT"`
- `fts_string = "React, 1С-Bitrix, битрикс, лендинг"`
- `fts_string_exclude = ""`

#### `Query.get_counters_by_id`

Purpose:

- return counters for folder/query.

Observed examples:

- folder `IT` had total count around `274`
- `Web разработка` had count `43-46` during tests

#### `Tender.GetList`

Purpose:

- return tender cards for a query.

Key confirmed request fields:

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

Useful response fields:

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

Confirmed live replay returned:

- real tender `recordset`
- count around `44-46` for `Web разработка`

## Daily Limit Findings

Measured on `2026-06-09` using:

- `SbisTenderAPI.GetStatistics` before and after internal RPC calls.

Measured before:

- `DayCounter = 0`
- `DayLimit = 200`
- `DayRemaining = 200`

Measured after:

- `Query.query_list`
- `Query.GetQuery`
- `Tender.GetList`

Result:

- `DayCounter = 0`
- `DayLimit = 200`
- `DayRemaining = 200`

Current conclusion:

- these internal `trade.saby.ru` RPC calls **did not decrement** the documented Saby daily request quota during this test.

This is extremely important, but it is still an observed runtime property, not a guaranteed contract.

## Current Operational Risks

### 1. Encoding Damage in Some Files

Some files contain mojibake / broken Cyrillic because of prior encoding issues.

Visible examples exist in:

- [prisma/schema.prisma](G:\Myprojects\TenderBot\prisma\schema.prisma)
- [app/page.tsx](G:\Myprojects\TenderBot\app\page.tsx)
- [lib/services/searchProfileService.ts](G:\Myprojects\TenderBot\lib\services\searchProfileService.ts)

This does not automatically mean runtime breakage, but it is technical debt and documentation noise.

### 2. Current App Still Uses Old Saby Parser Path

The app code currently refreshes tenders through the older parser path, not yet through the newly discovered internal RPC flow.

### 3. SearchProfile Auto-Creation

Current code auto-creates two default profiles.

Planned future onboarding flow is not yet implemented.

### 4. Source Definitions Are Still Partially Env-Driven

`SabySource` is already in DB, but current population still starts from:

- `.env`
- `SABY_TENDER_REQUEST_NAMES`

This is transitional architecture.

## Important API Routes

- [app/api/tenders/route.ts](G:\Myprojects\TenderBot\app\api\tenders\route.ts)
  - manual tender refresh
- [app/api/chat/route.ts](G:\Myprojects\TenderBot\app\api\chat\route.ts)
  - chat with selected tender
- [app/api/conversations/route.ts](G:\Myprojects\TenderBot\app\api\conversations\route.ts)
  - list conversations
- [app/api/conversations/[tenderExternalId]/route.ts](G:\Myprojects\TenderBot\app\api\conversations\[tenderExternalId]\route.ts)
  - delete conversation
- [app/api/tenders/[tenderExternalId]/documents/route.ts](G:\Myprojects\TenderBot\app\api\tenders\[tenderExternalId]\documents\route.ts)
  - load / process tender documents
- [app/api/tenders/[tenderExternalId]/score-feedback/route.ts](G:\Myprojects\TenderBot\app\api\tenders\[tenderExternalId]\score-feedback\route.ts)
  - save scoring feedback
- [app/api/search-profiles/[profileId]/route.ts](G:\Myprojects\TenderBot\app\api\search-profiles\[profileId]\route.ts)
  - update profile
- [app/api/saby/statistics/route.ts](G:\Myprojects\TenderBot\app\api\saby\statistics\route.ts)
  - current statistics endpoint

## Current UI Components Worth Knowing

- [components/layout/app-shell.tsx](G:\Myprojects\TenderBot\components\layout\app-shell.tsx)
- [components/layout/sidebar.tsx](G:\Myprojects\TenderBot\components\layout\sidebar.tsx)
- [components/layout/search-profile-editor.tsx](G:\Myprojects\TenderBot\components\layout\search-profile-editor.tsx)
- [components/layout/refresh-tenders-button.tsx](G:\Myprojects\TenderBot\components\layout\refresh-tenders-button.tsx)
- [components/chat/chat-panel.tsx](G:\Myprojects\TenderBot\components\chat\chat-panel.tsx)

## Known Temporary Investigation Files

These files exist for investigation and are not product runtime files:

- `trade.saby.ru.har`
- `saby-tree-load.har`
- `saby-folder-expand.har`
- `tmp-check-saby-limit.js`
- `tmp-extract-payload.js`
- `tmp-probe-query-list.js`
- `tmp-query-list.json`
- `tmp-tender-getlist-live.json`

Any future agent should treat these as investigation artifacts, not business code.

## Immediate Architectural Direction

Based on current discoveries, the likely better long-term Saby integration is:

1. use internal Saby RPC tree:
   - `Query.query_list`
   - `Query.GetQuery`
   - `Tender.GetList`

2. model source hierarchy as:
   - folder = broad industry
   - query = narrower saved search

3. let `SearchProfile` choose and score across those query sources.

This is not fully migrated in app code yet.

## Commands Commonly Used During Development

- install / run:
```powershell
npm install
npm run dev
```

- typecheck:
```powershell
npm run typecheck
```

- lint:
```powershell
npm run lint
```

- build:
```powershell
npm run build
```

- prisma generate:
```powershell
npx prisma generate
```

- prisma migrate:
```powershell
npx prisma migrate deploy
```

## Rules for Any Future LLM Working on This Repo

1. Read this file first.
2. Verify whether current code still matches this file.
3. If architecture changed, update this file before or alongside code changes.
4. Do not assume planned features are implemented.
5. Distinguish:
   - current implementation,
   - experimental runtime findings,
   - planned architecture.
6. Be careful with encoding in files containing Cyrillic.

## Short One-Paragraph Summary

This project is a Next.js + Prisma + PostgreSQL tender analysis application that authenticates users via NextAuth, fetches and caches tenders from Saby, scores tender cards with DeepSeek through `SearchProfile` rules, supports manual feedback, and is currently in transition from an older documented Saby API path toward a more capable internal `trade.saby.ru` RPC integration based on `Query.query_list`, `Query.GetQuery`, and `Tender.GetList`, with confirmed folder/query hierarchy and no observed daily limit decrement for those internal RPC calls during tests on `2026-06-09`.
