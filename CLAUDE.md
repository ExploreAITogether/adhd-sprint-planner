# CLAUDE.md

## Project Overview

ADHD Sprint Planner is a desktop app that turns messy brain dumps into clear, actionable task sprints. Users type (or voice-dictate) a stream-of-consciousness dump, Gemini AI parses it into 1-5 discrete tasks, and users complete them with satisfying animations and sound effects.

**Tech stack:** Tauri v2 (Rust backend + React 19 frontend), TypeScript, Tailwind CSS v4, SQLite via `@tauri-apps/plugin-sql`, Gemini 2.5 Flash API (free tier).

**Design philosophy:** Calming Headspace/Calm aesthetic with soft gradients, gentle animations, and micro-interactions. Low friction input, dopamine-hit completion feedback (particles, sounds, celebrations). Local-first data — everything stored in SQLite on disk, no account needed.

## Project Structure

```
src/
├── App.tsx                  # Root component, view router, sprint state management
├── main.tsx                 # React entry point
├── index.css                # Tailwind config, theme tokens, shared component classes
├── App.css                  # App-specific styles
├── components/
│   ├── LandingScreen.tsx    # Brain dump textarea + voice input + today theme
│   ├── SprintView.tsx       # Active sprint with drag-to-reorder tasks + today theme
│   ├── TaskCard.tsx         # Individual task with complete/edit/delete
│   ├── HistoryView.tsx      # Past sprints, search, tag filter, markdown export
│   ├── WeeklyStrip.tsx      # Horizontal Mon-Sun strip with theme emojis + completion dots
│   ├── ThemeEditorModal.tsx # Modal to set/edit/clear a day's theme
│   ├── HelpPromptModal.tsx  # AI-generated help prompts for tasks
│   ├── SettingsModal.tsx    # Gemini API key (+ free-tier guide), theme, sound settings
│   ├── ModalShell.tsx       # Shared modal backdrop + panel + close button
│   ├── Toast.tsx            # Shared toast (neutral/success/error, optional action)
│   ├── TodayThemeChip.tsx   # Today's day-theme pill above view headings
│   ├── icons.tsx            # Shared SVG icon set (use these, not emoji, for UI icons)
│   └── ErrorBoundary.tsx    # Global error handler
├── lib/
│   ├── database.ts          # All SQLite CRUD operations + getWeekDays helper
│   ├── geminiConfig.ts      # Gemini model URL + API key lookup from settings (BYOK)
│   ├── gemini.ts            # Gemini API: brain dump → parsed tasks
│   ├── promptGenerator.ts   # Gemini API: task → help prompt for Claude/ChatGPT
│   └── sounds.ts            # Web Audio API sound effects
├── hooks/
│   ├── useSpeechRecognition.ts  # Web Speech API hook for voice input
│   ├── useFocusTrap.ts          # Keeps Tab focus inside open modals
│   └── useTheme.ts              # Theme context object + useTheme() hook
├── contexts/
│   └── ThemeContext.tsx      # Light/dark/system theme provider (component only)
└── types/
    └── index.ts             # All TypeScript interfaces

src-tauri/
├── src/
│   ├── main.rs              # Tauri entry point
│   └── lib.rs               # Plugin registration (single-instance, sql, dialog, fs, window-state, opener)
├── Cargo.toml               # Rust deps: tauri, tauri-plugin-sql, dialog, fs, single-instance, opener
├── tauri.conf.json           # App config (window size, identifier, build paths)
└── capabilities/default.json # Security permissions for Tauri plugins
```

## Key Files

- **`src/App.tsx`** — Main app state (active sprint, current view, weekly themes, loading/error). Routes between `LandingScreen`, `SprintView`, and `HistoryView`. Manages day theme editing flow and weekly strip data refresh.
- **`src/lib/database.ts`** — All database operations. Singleton `getDb()` pattern. Schema creation in `initDatabase()`. CRUD for sprints, tasks, settings, and day themes.
- **`src/lib/gemini.ts`** — Calls Gemini 2.5 Flash to parse brain dump text into 1-5 tasks with title, emoji, and tags. API key comes from the `settings.api_key` column via `getApiKey()` in `src/lib/geminiConfig.ts`, which also centralizes the model URL and the user-facing missing/invalid key messages.
- **`src/lib/promptGenerator.ts`** — Generates AI-friendly help prompts for individual tasks. Results cached in the `tasks.generated_prompt` column.
- **`src/types/index.ts`** — All shared TypeScript interfaces.

## Data Model

### SQLite Tables

**sprints** — A sprint is one brain dump session with its parsed tasks.
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID v4 |
| created_at | TEXT | ISO 8601 |
| status | TEXT | 'active' \| 'completed' \| 'abandoned' |
| raw_input | TEXT | Original brain dump text |

**tasks** — Individual tasks belonging to a sprint.
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID v4 |
| sprint_id | TEXT FK | References sprints(id) |
| title | TEXT | Task name |
| emoji | TEXT | Single emoji from AI |
| tags | TEXT | JSON array of strings |
| status | TEXT | 'pending' \| 'completed' |
| completed_at | TEXT | ISO 8601, null if pending |
| generated_prompt | TEXT | Cached AI help prompt |
| position | INTEGER | Order within sprint (drag-drop) |

**settings** — Single-row config table (enforced by `CHECK (id = 1)`).
| Column | Type | Notes |
|--------|------|-------|
| sound_enabled | INTEGER | 0/1 boolean |
| theme | TEXT | 'light' \| 'dark' \| 'system' |
| export_path | TEXT | Folder of the last History export; the save dialog opens there next time. Set automatically, not shown in Settings |
| api_key | TEXT | User's Gemini API key (nullable; null until set in Settings) |

**day_themes** — Weekly day themes (one per weekday).
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID v4 |
| day_of_week | INTEGER | 1=Monday through 7=Sunday, UNIQUE |
| name | TEXT | Theme label, e.g. "Work on blog" |
| emoji | TEXT | Theme emoji, e.g. "📝" |

### TypeScript Interfaces

- `Sprint` — id, created_at, status, raw_input, tasks[]
- `Task` — id, sprint_id, title, emoji, tags[], status, completed_at, generated_prompt, position
- `Settings` — sound_enabled, theme, export_path, api_key
- `DayTheme` — id, day_of_week, name, emoji
- `WeekDay` — dayOfWeek, label, date, theme, isToday, hasCompletedTasks

## Conventions

### IDs and Timestamps
- All entity IDs are UUID v4 via `import { v4 as uuidv4 } from 'uuid'`
- All timestamps stored as ISO 8601 strings (`new Date().toISOString()`)
- Date formatting for display uses `date-fns` (`format`, `formatDistanceToNow`)

### Database Patterns
- Singleton connection via `getDb()` returning `Database` from `@tauri-apps/plugin-sql`
- Parameterized queries with `$1, $2, ...` placeholders
- Complex types (arrays) stored as JSON strings, parsed on read via `JSON.parse`
- Booleans stored as INTEGER (0/1), converted on read (`row.field === 1`)
- Migrations wrapped in try/catch (column-exists errors are silently caught)

### Styling
- Tailwind CSS v4; `@theme` in `index.css` sets `--font-sans` (Inter) and `--font-display` (Fraunces)
- Fonts are bundled via `@fontsource-variable/*`, imported in `main.tsx` (not `index.css` — Tailwind inlines CSS imports without rebasing font URLs, which breaks the production build). The CSP only allows `font-src 'self'`.
- Dual theme system: `--t-*` CSS custom properties for light/dark mode
- Dark mode applied by toggling `.theme-dark` class on `<html>`
- `ThemeProvider` (contexts/ThemeContext.tsx) provides resolved theme + toggle; consumers call `useTheme()` from `hooks/useTheme.ts`
- Shared component classes in `index.css` (`@layer components`): `app-bg` (aurora page background), `glass-card`, `surface`, `btn` + `btn-primary|secondary|ghost|soft|danger`, `icon-btn`, `field`, `chip`, `kbd`, `emoji-tile`, `segmented`, `toast`, `modal-panel`, `task-card`, `strike`. Put hover/focus states in these classes — don't mutate styles in `onMouseEnter`/`onMouseLeave`.
- Headings use `font-display`. Keyboard focus uses a global `:focus-visible` outline; don't add `focus:ring-*` per element.
- The aurora background is intentionally static (an animated background under `backdrop-filter` costs GPU continuously).

### Component Patterns
- No external state management (no Redux/Zustand) — `useState` + callback props
- `App.tsx` owns sprint state, passes handlers down to child components
- Optimistic UI updates — state changes immediately, DB writes in background
- `@dnd-kit` for drag-to-reorder tasks with position tracking

### API Key (bring your own)
- No key ships with the app and nothing is read from the environment at build time. Each user pastes their own Gemini key into **Settings → Gemini API key**; it is stored in the `settings.api_key` column of the local SQLite database.
- `getApiKey()` in `src/lib/geminiConfig.ts` is async, reads settings, and throws `MissingApiKeyError` (friendly message pointing at Settings) when no key is saved. `hasApiKey()` drives the first-run notice on `LandingScreen`.
- The key is sent as the `x-goog-api-key` request header, never as a `?key=` URL parameter.
- `App.tsx` re-checks the key when `SettingsModal` closes so the first-run notice disappears as soon as a key is saved.
- 401/403 responses surface `INVALID_API_KEY_MESSAGE` (points at Settings) in both brain dump parsing and Help Me prompts.
- Model URL lives in `src/lib/geminiConfig.ts`. Update there if Gemini deprecates the current model (history: `gemini-2.0-flash` → `gemini-2.5-flash` after 2.0 hit `RESOURCE_EXHAUSTED` 429s on free tier)
- All Gemini calls go through `requestGemini()` in `geminiConfig.ts`, which retries 5xx overloads ("model is overloaded" 503s are common on the free tier) and maps 401/403, 429, and 5xx to friendly messages. Never show the raw response body to the user.
- Never commit a real key anywhere in the repo, including docs and tests.
- Voice-to-text does **not** use Gemini. It uses the Web Speech API via `useSpeechRecognition`; Gemini is used for brain dump parsing and Help Me prompt generation.

### Tauri Security
- `tauri-plugin-shell` is intentionally not registered; do not add shell permissions unless a feature truly needs external URL/process opening.
- `tauri-plugin-opener` is registered only so the "get a Gemini API key" links can open the system browser. Its `opener:allow-open-url` scope in `default.json` allows exactly `https://aistudio.google.com/apikey`; widen it only if a feature truly needs another URL. The plugin's init script routes `<a target="_blank">` clicks through that same scope, so other external links stay blocked.
- `default.json` limits markdown export writes to `$DOWNLOAD/**`, `$DOCUMENT/**`, and `$DESKTOP/**`. Avoid re-adding broad `$HOME/**` filesystem scope.
- `tauri.conf.json` defines a CSP. Keep script sources tight; inline styles are currently allowed because the React UI uses many inline CSS custom-property styles.

### Single-Instance Behavior
- `tauri-plugin-single-instance` is registered in `src-tauri/src/lib.rs`. Launching the app a second time (e.g. from a Stream Deck button or Start Menu shortcut) does not spawn a duplicate — the plugin's callback unminimizes, shows, and focuses the existing `main` window. This avoids SQLite lock contention from concurrent instances and makes the app feel right when bound to a hotkey.

### Voice Input Behavior
- `LandingScreen` supports voice dictation for the initial brain dump; dictation appends after any already typed text.
- `SprintView` also supports voice dictation when adding a single task via `+ Add task`; the mic button appends dictation after any already typed text and stops/reset recording on submit or close.
- macOS only allows mic and speech recognition access because `src-tauri/Info.plist` declares `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription`. Without them the webview gets `not-allowed` with no prompt. After editing the plist, touch `src-tauri/build.rs` so Cargo re-embeds it in dev builds.

## Build & Dev Commands

```bash
npm run dev          # Start Vite dev server (frontend only)
npm run build        # TypeScript check + Vite production build
npm run tauri dev    # Launch full Tauri app in dev mode
npm run tauri build  # Production build of desktop app
npm run lint         # ESLint
```

## Weekly Day Themes Feature

Fully implemented end-to-end. Lets users assign an emoji + name theme to each weekday.

- **Data:** `day_themes` table, CRUD functions (`getDayThemes`, `getDayTheme`, `setDayTheme`, `clearDayTheme`), `getWeekDays()` helper (scoped to current Mon-Sun week)
- **UI:** `WeeklyStrip` (horizontal day buttons above main card on landing + sprint views), `ThemeEditorModal` (set/edit/clear per-day theme)
- **Integration:** App.tsx manages state, refreshes on mount + theme save/clear + task toggle. Today's theme shown above heading on both LandingScreen and SprintView.
- **Accessibility:** aria-labels on day buttons, focus trap in modal, dialog role, labeled inputs, 44px min tap targets
