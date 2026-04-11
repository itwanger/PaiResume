# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PaiResume is a Chinese-language online resume editor with a decoupled frontend (React 18 + Vite) and backend (Spring Boot 3.3 + MySQL + Redis). It supports modular resume editing with live preview, Markdown/TXT import, AI module optimization and whole-resume analysis, and PDF export.

## Common commands

Frontend (run from repo root):

```bash
npm install
npm run dev      # Vite dev server (default port 5173, auto-opens browser)
npm run build    # tsc -b && vite build
npm run lint     # eslint .
npm run preview  # Vite preview of production build
```

Backend (run from `server/`):

```bash
mvn spring-boot:run            # Default http://localhost:8084/api
mvn -DskipTests package        # Build jar
mvn test -Dtest=ClassName      # Run a single JUnit test class
mvn test -Dtest=ClassName#method
```

There is currently no frontend test runner configured (`npm test` is not defined).

## Environment configuration

Both frontend and backend read a single `.env` at the repo root (copy from `.env.example`). Do **not** create `server/.env` — this was removed. Keys that matter most:

- `SERVER_PORT` — backend port (default `8084`); Vite proxies `/api` to this host
- `VITE_PORT`, `VITE_API_PROXY_TARGET`, `VITE_API_BASE_URL` — frontend dev server and API base
- `MYSQL_*`, `REDIS_*` — datastore connections
- `JWT_SECRET` — **must** be overridden when `APP_ENV != development`, otherwise the backend refuses to boot
- `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_ANALYSIS_MODEL` — main AI integration (backend-side)
- `APP_ENV=development` auto-provisions a dev account via `DEV_ACCOUNT_EMAIL` / `DEV_ACCOUNT_PASSWORD` (defaults `test@example.com` / `Test123456`)
- `FIELD_OPTIMIZE_PROMPTS_FILE` — path to the field-optimize prompt YAML, defaults to `config/field-optimize-prompts.yml`

Database schema is applied from `server/src/main/resources/schema.sql` on startup — there is no Flyway migration pipeline, so schema changes go into that file directly.

In development the email verification code is not actually sent via SMTP; it is printed to the backend log. The AI flows live behind the backend — `VITE_AI_*` variables are legacy/compat shims and should not be relied on.

## Architecture

### Big picture

```
Browser ──► Vite dev (5173) ──/api proxy──► Spring Boot (8084) ──► MySQL / Redis / upstream AI
```

`vite.config.ts` also proxies two DashScope paths directly to `https://dashscope.aliyuncs.com`, so any code that hits those paths bypasses the Java backend.

### Frontend (`src/`)

- `main.tsx` / `App.tsx` — React Router routes. Routes under `/dashboard`, `/editor/:id`, `/preview/:id`, and `/editor/:id/modules/:moduleId/field-optimize` are wrapped in `ProtectedRoute`, which redirects to `/login` based on `useAuthStore`.
- `api/client.ts` — Axios instance. Central rules that touch every request:
  - Attaches `Bearer <accessToken>` from `localStorage` to all non-public-auth requests.
  - Unwraps the `{ code, message, data }` envelope; non-200 codes reject with `message`.
  - On 401 (or 403 when a refresh token exists), performs a single-flight refresh against `/auth/refresh`, retries the original request, and queues concurrent failures. On refresh failure it clears tokens and hard-redirects to `/login`.
  - New API calls should go through this client so they inherit these behaviors; do not call `axios` directly.
- `api/auth.ts`, `api/resume.ts` — typed wrappers around backend endpoints listed in the README.
- `store/` — Zustand stores. `authStore` holds auth state and tokens; `resumeStore` owns the resume list, `currentResumeId`, loaded `modules`, and all mutation flows (`createResume`, `importResume`, `updateModuleContent`, etc.). Mutations always re-sort the resume list via `sortResumeList` (createdAt desc, id tiebreak). Module mutations are only applied to local state when `currentResumeId` matches — follow this pattern when adding new actions.
- `pages/` — page-level components: `LoginPage`, `RegisterPage`, `DashboardPage`, `EditorPage` (three-pane editor: sidebar navigation, module form, live preview), `ChromePreviewPage` (standalone preview window used by `ChromePreviewFrame`), `FieldOptimizePage` (per-field AI optimization tool).
- `components/`
  - `components/modules/` — one form component per resume module type (`BasicInfoForm`, `EducationForm`, `InternshipForm`, `ProjectForm`, `PaperForm`, `ResearchForm`, `AwardForm`, `SkillForm`, `JobIntentionForm`). Several of these are multi-instance modules (internship, project, paper, research, award). `AiOptimizeStreamModal` is the streaming AI output dialog; `ModuleSaveBar` is the shared save/action bar.
  - `components/forms/` — older/simpler form components kept around alongside the `modules/` directory; prefer `modules/` for new module types.
  - `components/editor/` — editor shell: `ModuleSidebar`, `PreviewPanel`, `ChromePreviewFrame` (embeds `ChromePreviewPage` in an iframe and auto-resizes it).
  - `components/preview/ResumePreview.tsx` — the on-screen HTML preview (separate from the PDF renderer).
  - `components/analysis/` — `ResumeAnalysis` (full-resume scoring) and `AiOptimizePanel`.
  - `components/ui/` — shared primitives (`Button`, `Input`, `Select`, `TextArea`, `AutoResizeTextarea`, `Section`, `ConfirmDialog`, `MarkdownPreview`).
- `utils/`
  - `resumePdf.tsx` — `@react-pdf/renderer` document used for PDF export. Relies on fonts bundled under `public/fonts/`; missing fonts will break export.
  - `importers/` — Markdown/TXT resume importers (`importers/markdown.ts`). Word and PDF imports are defined but not yet wired into the UI.
  - `moduleContent.ts` — serialization/normalization between backend module content and typed structures in `types/index.ts`.
  - `aiService.ts`, `analyzer.ts`, `resumeAnalysisAdapter.ts` — AI flow helpers and analysis result adapters.
- `types/index.ts` — canonical module content interfaces (`BasicInfoContent`, `EducationContent`, `InternshipContent`, `ProjectContent`, etc.). When adding a new module type, add its interface here and a matching form in `components/modules/`.

### Backend (`server/`)

Standard Spring Boot layout under `com.itwanger.pairesume`:

- `controller/` — REST entry points: `AuthController`, `ResumeController`, `ResumeAnalysisController`, `AiController`, `AiPromptController`, `SmartOnePageController`, `HealthController`
- `service/` + `service/impl/` — business logic (`ResumeService`, `ResumeModuleService`, `AuthService`, `AiService`, `AiOptimizeRecordService`, `ResumeAnalysisRecordService`)
- `mapper/` — MyBatis-Plus mappers
- `entity/`, `dto/`, `vo/` — persistence, request, and response models
- `security/` — JWT filter, Spring Security config
- `config/` — app/bean configuration
- `common/` — shared envelopes and utilities
- `src/main/resources/schema.sql` — the source of truth for the DB schema (no Flyway)

Controllers return the `{ code, message, data }` envelope that the frontend Axios interceptor unwraps.

### Resume module model

Resumes are rows in the `resumes` table; each resume has an ordered collection of **modules** where each module row stores `moduleType` + freeform JSON `content`. The backend is mostly type-agnostic about `content`; the frontend enforces shapes via the interfaces in `src/types/index.ts` and the corresponding forms. When adding a module type, the minimal surface area is: (1) type in `types/index.ts`, (2) form in `components/modules/`, (3) registration in `ModuleSidebar` / editor wiring, (4) rendering in `components/preview/ResumePreview.tsx` and `utils/resumePdf.tsx`, (5) importer coverage in `utils/importers/` if needed.

### Field-optimize prompts

The default prompts shown on the field-optimize page live in `config/field-optimize-prompts.yml` (multi-line YAML). Both backend (per-request reload) and frontend (served from backend) consume the same file, so editing it changes prompts in both places. After edits, backend picks up the new file on the next request, but the frontend field-optimize page must be re-entered to refresh its copy.

## Conventions worth following

- Treat `src/api/client.ts` as the only entry for backend HTTP calls — do not bypass the interceptors.
- Zustand stores mutate via `set(state => ...)` and keep list ordering consistent with `sortResumeList`. Module updates are conditional on `currentResumeId` matching to avoid cross-resume bleed-through.
- The envelope convention (`code === 200` means success) is assumed throughout the frontend; new endpoints should honor it on the backend side.
- PDF export is a separate render tree in `utils/resumePdf.tsx` — on-screen preview changes in `components/preview/ResumePreview.tsx` do not automatically apply there. Update both when changing layout.
