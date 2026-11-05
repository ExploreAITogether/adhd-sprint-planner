# Code Review Report: ADHD Sprint Planner

**Reviewer:** Senior Developer (the mean one)
**Date:** 2026-02-06
**Verdict:** Requesting changes. 34 findings. Do not merge.

---

## 🔴 Critical (fix now)

### C1. API key leaked in frontend bundle and network requests
**File:** `src/lib/gemini.ts:120`, `src/lib/promptGenerator.ts:101`
**Status: resolved.** The app now uses a bring-your-own-key flow: the key lives in the local SQLite `settings` table, is entered in Settings, and is sent as a request header. Original finding below.

**What's wrong:** The Gemini API key was embedded via a Vite `VITE_*` environment variable which Vite inlines into the production JS bundle as a string literal. Anyone who opens DevTools or inspects the built `.js` files can extract it. Furthermore, `fetch(\`${GEMINI_API_URL}?key=${apiKey}\`)` puts the key in the URL, which means it shows up in browser history, network logs, and any proxy/CDN logs.
**What could go wrong:** Someone extracts your API key, racks up usage on your Gemini account (or exhausts your free tier for all users), and you eat the bill. Since this is a desktop app the bundle ships to every user's machine.
**Suggested fix:** Proxy API calls through a Tauri Rust command. The Rust backend holds the key (read from env at runtime or a secure store), makes the HTTP call, and returns the result. The key never touches the frontend JS bundle.

### C2. Content Security Policy is `null` — wide open to code injection
**File:** `src-tauri/tauri.conf.json:27`
**What's wrong:** `"csp": null` disables the Content Security Policy entirely. In a Tauri app the webview runs with elevated privileges (filesystem, SQL, dialogs). Any XSS vector (e.g., from malicious AI response content rendered as HTML) could escalate to full local system access via Tauri APIs.
**What could go wrong:** If Gemini ever returns content containing `<script>` tags or event handler attributes, and that content is rendered without sanitization (see C3), an attacker can execute arbitrary code in the webview context, which has filesystem write access per `capabilities/default.json`.
**Suggested fix:** Set a strict CSP: `"csp": "default-src 'self'; script-src 'self'; connect-src 'self' https://generativelanguage.googleapis.com; style-src 'self' 'unsafe-inline'"`. Tighten further as needed.

### C3. User-controlled and AI-generated content rendered without sanitization
**File:** `src/components/TaskCard.tsx:206`, `src/components/HistoryView.tsx:446-449`, `src/components/HelpPromptModal.tsx:255`
**What's wrong:** Task titles come from Gemini AI responses and are rendered directly in JSX. While React escapes text content by default, the `HighlightText` component (`HistoryView.tsx:66-90`) uses `RegExp` constructed from user search input and `split()` to create DOM fragments. The regex is escaped, which is good, but the generated prompt in `HelpPromptModal` is displayed in a `<textarea>` with `readOnly` — if this ever changes to `dangerouslySetInnerHTML` or a rich renderer, it's game over. Combined with CSP=null (C2), this is a latent XSS vector.
**What could go wrong:** A crafted brain dump could trick Gemini into returning a title with embedded markup. With CSP disabled, this could execute code with Tauri IPC access.
**Suggested fix:** Fix C2 (CSP) first. Then add input sanitization on AI responses in `parseGeminiResponse()` — strip any HTML tags from `title` fields.

### C4. Filesystem scope is `$HOME/**` — overly broad write access
**File:** `src-tauri/capabilities/default.json:25`
**What's wrong:** The FS scope grants write access to `$HOME/**`. Combined with CSP=null and the `fs:allow-write-text-file` permission, any code injection vulnerability (see C2/C3) can write arbitrary files anywhere under the user's home directory.
**What could go wrong:** An attacker could overwrite `~/.bashrc`, `~/.ssh/authorized_keys`, `~/.gitconfig`, etc. The `$DOWNLOAD` and `$DOCUMENT` scopes are sufficient for export functionality.
**Suggested fix:** Remove `{ "path": "$HOME/**" }` from the scope. Keep `$DOWNLOAD/**` and `$DOCUMENT/**` only. If you need `$DESKTOP`, keep that too, but `$HOME/**` is a superset that includes everything.

### C5. Database singleton is not race-condition safe
**File:** `src/lib/database.ts:6-12`
**What's wrong:** `getDb()` checks `if (!db)` then awaits `Database.load()`. If two callers invoke `getDb()` concurrently before the first resolves, you get two database connections and `db` gets overwritten. One connection leaks, and concurrent writes on different connections to the same SQLite file can corrupt data.
**What could go wrong:** On app startup, `initDatabase()` and `getActiveSprint()` and `getWeekDays()` can all race. In practice this might work most of the time, but under load or on slow disks you'll get "database is locked" errors or silent data corruption.
**Suggested fix:**
```typescript
let dbPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:adhd-sprint-planner.db');
  }
  return dbPromise;
}
```

### C6. Sprint creation + task insertion is not transactional
**File:** `src/App.tsx:77-85`
**What's wrong:** `handleSubmit` creates a sprint, then inserts tasks one at a time in a `for` loop. If the app crashes, the network drops, or any single `addTask` call fails, you get an orphaned sprint with partial tasks in the database. There's no transaction wrapping these operations.
**What could go wrong:** User sees a sprint with 2 of 5 tasks. The other 3 are lost forever. The raw brain dump is saved but there's no retry/recovery mechanism.
**Suggested fix:** Wrap the sprint creation + all task inserts in a single SQLite transaction using `database.execute('BEGIN TRANSACTION')` ... `database.execute('COMMIT')` with a `ROLLBACK` in the catch block.

---

## 🟡 Important (fix soon)

### I1. N+1 query in `getSprintHistory()` — history view will choke on data
**File:** `src/lib/database.ts:269-291`
**What's wrong:** Fetches all sprints, then for each sprint fires a separate `SELECT * FROM tasks WHERE sprint_id = $1`. With 100 sprints, that's 101 queries. With 500 sprints over a year of daily use, 501 queries.
**What could go wrong:** History view takes 5+ seconds to load for a power user. On older hardware with spinning disk, this could hang the UI entirely. There's no pagination, no limit, no lazy loading.
**Suggested fix:** Single query with JOIN: `SELECT s.*, t.* FROM sprints s LEFT JOIN tasks t ON t.sprint_id = s.id ORDER BY s.created_at DESC, t.position ASC`. Then group in JS. Or at minimum add `LIMIT` + pagination.

### I2. No indexes on frequently queried columns
**File:** `src/lib/database.ts:17-63`
**What's wrong:** No `CREATE INDEX` statements for `tasks.sprint_id`, `tasks.status`, `tasks.completed_at`, or `sprints.status`. Every query that filters on these columns does a full table scan.
**What could go wrong:** Works fine with 50 tasks. Starts dragging at 5,000. The `getWeekDays()` function queries `WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at >= $1 AND completed_at < $2` — that's a full scan of the entire tasks table on every page load and every task toggle.
**Suggested fix:** Add at minimum:
```sql
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(status, completed_at);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);
```

### I3. `updateTaskPositions` fires N separate UPDATE queries with no transaction
**File:** `src/lib/database.ts:249-256`
**What's wrong:** Every drag-and-drop reorder fires one UPDATE per task, sequentially, with no transaction. With 5 tasks that's 5 round-trips. If the app crashes mid-update, positions are inconsistent.
**What could go wrong:** Positions get corrupted — two tasks share the same position, or there are gaps. Task ordering becomes unpredictable. The user sees tasks jump around after restarting the app.
**Suggested fix:** Wrap in a transaction. Or use a single query with CASE/WHEN.

### I4. Migration strategy is a time bomb
**File:** `src/lib/database.ts:66-82`
**What's wrong:** The migration for adding the `position` column uses a try/catch that silently swallows "column already exists" errors. But it also swallows every other error — disk full, permission denied, corrupted database. The `catch {}` block is completely empty. Furthermore, this migration runs on every app launch, querying all tasks by rowid and updating them one by one.
**What could go wrong:** A legitimate migration error goes unnoticed. User's data silently fails to migrate. The position column never gets populated and tasks appear in random order. The user has no idea anything went wrong.
**Suggested fix:** Check the error type. Use a proper migration tracking table (`schema_version`) so migrations run exactly once. At minimum, catch only the specific "duplicate column name" error.

### I5. Optimistic UI updates don't roll back on failure
**File:** `src/components/SprintView.tsx:222-223`, `src/components/SprintView.tsx:287-289`, `src/components/SprintView.tsx:307-309`
**What's wrong:** Every task toggle, edit, delete, and reorder does an optimistic local state update, then fires the database write with `.catch((err) => console.error(...))`. If the database write fails, the UI shows a state that doesn't match what's persisted. On next app launch, the user sees the old state.
**What could go wrong:** User completes all tasks, gets the celebration, closes the app. On restart, tasks are all pending again because the DB writes silently failed. That's the opposite of a dopamine hit.
**Suggested fix:** Either (a) await the DB write and revert on failure, or (b) keep a queue of pending writes and retry, or (c) at minimum show a toast/error when a DB write fails instead of silently logging to console.

### I6. Delete + Undo is a race condition factory
**File:** `src/components/SprintView.tsx:296-349`
**What's wrong:** `handleDelete` immediately deletes from DB (`dbDeleteTask`), then stores the task for potential undo. If the user clicks Undo, `restoreTask` re-inserts it. But if `dbDeleteTask` hasn't completed yet when undo fires, you could attempt to INSERT a row that still exists (the DELETE is async). Also, only ONE deleted task is stored — rapid-fire deletes lose undo history for all but the last deletion.
**What could go wrong:** User deletes task A, then task B. Undo only restores B. Task A is gone forever with no warning. Or: user deletes and immediately undoes — `restoreTask` fires before `dbDeleteTask` finishes, causing a primary key conflict and a silent error.
**Suggested fix:** Queue undo operations. Don't delete from DB until the undo timeout expires. Use a "soft delete" pattern or delay the actual DB deletion.

### I7. `JSON.parse(row.tags)` with no error handling
**File:** `src/lib/database.ts:101`
**What's wrong:** `mapTaskRow` does `JSON.parse(row.tags)` without try/catch. If a task's `tags` column contains invalid JSON (e.g., from a botched migration, manual DB edit, or a Gemini response that snuck through validation), the entire sprint/history view crashes with an unrecoverable error.
**What could go wrong:** One corrupted `tags` field = entire history view is a white screen. The ErrorBoundary catches it, but the user can't recover without manually editing the SQLite database.
**Suggested fix:** `try { return JSON.parse(row.tags) } catch { return [] }`.

### I8. `HighlightText` regex reconstruction causes false matches
**File:** `src/components/HistoryView.tsx:66-90`
**What's wrong:** The regex is recreated with `new RegExp(...)` on every `.test()` call inside the `.map()`. The `g` flag means the regex has internal state (`lastIndex`), so alternating `.test()` calls can skip matches or produce inconsistent highlighting. Specifically, `regex.test(part)` in the map callback shares the same regex instance with `g` flag, meaning `lastIndex` advances and the second call to `.test()` on the same regex may return `false` for a valid match.
**What could go wrong:** Search highlighting is inconsistent — some matches are highlighted, others aren't. Users think search is broken.
**Suggested fix:** Either use `part.toLowerCase().includes(query.toLowerCase())` for the check instead of `regex.test()`, or create a new regex for each test, or remove the `g` flag since you only need to test once per part.

### I9. Speech recognition clears existing text on start
**File:** `src/components/LandingScreen.tsx:108-109`
**What's wrong:** `handleVoiceToggle` calls `resetTranscript()` and `setInput('')` before starting speech recognition. If the user has typed 200 words and then decides to add more via voice, all their text is wiped without confirmation.
**What could go wrong:** User loses their entire brain dump because they accidentally tapped the mic button. For ADHD users — the exact target audience — this is especially frustrating as they may not be able to reconstruct what they typed.
**Suggested fix:** Append voice transcript to existing text instead of replacing it. Or at minimum, show a confirmation dialog if input is non-empty.

### I10. No character limit enforcement on AI-parsed task titles
**File:** `src/lib/gemini.ts:85`
**What's wrong:** Task titles from Gemini are sliced to 100 characters, but the SYSTEM_PROMPT says "under 60 characters." The user can manually add tasks with up to 120 characters (`SprintView.tsx:600`). The DB column has no length constraint. There's no consistent enforcement.
**What could go wrong:** Long titles overflow the TaskCard layout, especially on the minimum window width of 400px. The drag handle, checkbox, title, and action buttons all compete for space.
**Suggested fix:** Pick a limit (100 chars is fine) and enforce it consistently: in the DB schema, in the AI parsing, and in the manual add input.

### I11. `getWeekDays()` is called on every task toggle
**File:** `src/App.tsx:121-122`
**What's wrong:** `handleTaskToggle` calls `refreshWeekDays()` which runs a full database query (get all themes + query all completed tasks for the week) every time any task checkbox is clicked. This is a database round-trip on every click.
**What could go wrong:** On slow storage (older machines, HDDs), there's a perceptible delay on every task toggle. For a "dopamine hit" app, that lag kills the experience.
**Suggested fix:** Debounce `refreshWeekDays`, or derive `hasCompletedTasks` from local state instead of re-querying the database.

### I12. `handleSubmit` doesn't prevent double-submission
**File:** `src/App.tsx:63-98`
**What's wrong:** While `isLoading` prevents the button from being clicked, there's no guard against double-calling `handleSubmit` programmatically (e.g., from the `Ctrl+Enter` keyboard shortcut). If `handleSubmit` is called while `isLoading` is already `true`, the `setIsLoading(true)` at line 64 is a no-op, but the API call and sprint creation proceed again.
**What could go wrong:** User rapidly double-taps Ctrl+Enter. Two API calls fire, two sprints are created, but only one is set as the active sprint. The other is an orphan in the database.
**Suggested fix:** Check `isLoading` at the start of `handleSubmit` and bail out early (the `handleSubmit` in `LandingScreen` does this, but the one in `App.tsx` does not have the same guard before the API call).

### I13. AudioContext created but never cleaned up
**File:** `src/lib/sounds.ts:1-12`
**What's wrong:** The module-level `audioContext` is created on first sound play and never closed. Oscillator nodes are created but cleanup relies on `osc.stop()` auto-disconnecting. In long sessions, if `AudioContext.state` becomes `interrupted` (e.g., system sleep), `resume()` may silently fail on some platforms.
**What could go wrong:** After the laptop sleeps and wakes, sounds stop working silently. No error, no indication to the user. They think the feature is broken.
**Suggested fix:** Add error handling around `audioContext.resume()`. Consider recreating the context if `state === 'closed'`.

---

## 🟢 Nice to have

### N1. Dual state management between App.tsx and SprintView.tsx
**File:** `src/App.tsx:110-158`, `src/components/SprintView.tsx:154-156`
**What's wrong:** `App.tsx` maintains sprint state and passes it down. `SprintView` copies it into local `tasks` state on mount. Both maintain separate copies. Changes in `SprintView` notify the parent via callbacks, but the parent's state and child's state can drift. For example, `SprintView.handleToggle` updates local `tasks` AND calls `onTaskToggle` which updates `App.activeSprint.tasks`. These are two separate state updates that could theoretically render different values.
**What could go wrong:** State desynchronization. Currently works because `SprintView` is the only consumer, but adding any sibling component that reads `activeSprint.tasks` would show stale data.
**Suggested fix:** Pick one source of truth. Either lift all task mutations to `App.tsx`, or let `SprintView` fully own task state and only sync on mount/unmount.

### N2. Multiple `as` type casts for database row types
**File:** `src/lib/database.ts:100`, `src/lib/database.ts:141-142`, `src/lib/database.ts:284-285`
**What's wrong:** `row.status as Task['status']` and `sprint.status as Sprint['status']` assume the database always contains valid enum values. If someone manually edits the SQLite file or a migration goes wrong, you get a TypeScript type at compile time that doesn't match the runtime value.
**What could go wrong:** A `status` value of `"in_progress"` (which doesn't exist in the union type) would pass the `as` cast silently and cause undefined behavior downstream — no filter match, no rendering, ghost data.
**Suggested fix:** Validate at the boundary: `if (!['active', 'completed', 'abandoned'].includes(sprint.status)) throw new Error(...)`.

### N3. `useEffect` dependency on `[task]` object reference causes unnecessary re-generation
**File:** `src/components/HelpPromptModal.tsx:27-51`
**What's wrong:** The `useEffect` that generates the help prompt depends on `[task]`, which is an object. Since `task` comes from `useState` in the parent, every render creates a new object reference (even if the task hasn't changed), potentially re-triggering the generation effect.
**What could go wrong:** In practice this is mitigated because the modal mounts/unmounts, but if the parent re-renders while the modal is open, the effect would fire again, making a duplicate API call and overwriting the cached prompt.
**Suggested fix:** Depend on `task.id` instead of `task`.

### N4. Inline styles everywhere instead of CSS classes
**File:** Every component
**What's wrong:** Nearly every component uses extensive inline `style={{}}` props for theming. This means:
- Styles aren't cacheable by the browser
- Hover effects require `onMouseEnter`/`onMouseLeave` handlers (dozens of them across the codebase)
- Each hover handler is creating new style assignments on every hover event
**What could go wrong:** Performance isn't great with 50+ DOM elements each having hover handlers. More importantly, the `onMouseEnter`/`onMouseLeave` pairs don't clean up properly if the mouse leaves the viewport while hovering — the element stays in hover state.
**Suggested fix:** Use CSS custom properties in Tailwind classes or CSS modules. Replace inline hover handlers with CSS `:hover` rules.

### N5. Settings gear SVG path duplicated 4 times
**File:** `src/components/LandingScreen.tsx:163-166`, `src/components/SprintView.tsx:508-510`, `src/components/HistoryView.tsx:253-255`, `src/components/SettingsModal.tsx:149-152`
**What's wrong:** The exact same 10-line SVG path for the settings gear icon is copy-pasted in 4 different components. Any update to the icon requires changing it in 4 places.
**Suggested fix:** Extract to a shared `<SettingsIcon />` component or use an icon library.

### N6. `ErrorBoundary` "Try again" doesn't actually recover
**File:** `src/components/ErrorBoundary.tsx:26-28`
**What's wrong:** `handleRestart` just clears the error state, which re-renders the children. If the error was caused by a persistent condition (corrupted DB, invalid state), the same error fires immediately and the user is stuck in a loop.
**What could go wrong:** User clicks "Try again" 15 times, gets the same error, rage-quits. "Don't worry, your data is safe" — but is it? If the error was a DB corruption, their data might not be safe at all.
**Suggested fix:** Add a "force refresh" option that reloads the webview. Or navigate to a clean state (clear sprint, go to landing page).

### N7. `ThemeEditorModal` emoji input accepts any text, not just emoji
**File:** `src/components/ThemeEditorModal.tsx:168-185`
**What's wrong:** The emoji input is a regular `<input type="text" maxLength={4}>`. Users can type "abcd" and save it as their "emoji." There's no validation that the input is actually an emoji.
**What could go wrong:** User types "WORK" as the emoji. Now the weekly strip shows "WORK" crammed into a 28px text span. Layout breaks. Not critical, but looks bad.
**Suggested fix:** Either validate that input contains only emoji (regex for emoji ranges) or use an emoji picker component.

### N8. No loading/empty state handling for initial DB load race
**File:** `src/App.tsx:40-61`
**What's wrong:** The init `useEffect` calls `initDatabase()`, then `getActiveSprint()`, then `getWeekDays()` sequentially. If `initDatabase()` succeeds but `getActiveSprint()` throws, `setDbReady(true)` never runs and the user sees "Loading..." forever. But the error is caught by the outer try/catch which sets `dbError`, so it shows the DB error screen. However, `getWeekDays()` failing would also show as a DB error, which is misleading.
**What could go wrong:** A benign failure in `getWeekDays()` (e.g., date parsing edge case) shows the scary "Something went wrong initializing the database" error, making users think their data is corrupted.
**Suggested fix:** Separate the error handling. DB init errors should be fatal. Sprint loading and week day loading should be non-fatal.

### N9. `handleHistoryBack` closes over stale `activeSprint`
**File:** `src/App.tsx:160-174`
**What's wrong:** `handleHistoryBack` has `[activeSprint]` in its dependency array, which means a new callback is created every time `activeSprint` changes. This is fine functionally, but the callback is passed to `HistoryView` as `onBack`, causing unnecessary re-renders of the history view whenever sprint state changes (e.g., from a background task toggle).
**Suggested fix:** Use a ref for `activeSprint.id` inside the callback to avoid dependency churn.

### N10. Voice input lang is hardcoded to `en-US`
**File:** `src/hooks/useSpeechRecognition.ts:94`
**What's wrong:** `recognition.lang = 'en-US'` is hardcoded. Non-English speakers can't use voice input effectively.
**What could go wrong:** French/Spanish/German users dictate in their language, get garbled English interpretations.
**Suggested fix:** Accept language as a parameter or detect from `navigator.language`.

### N11. `useEffect` on `[speechError]` doesn't clear previous voice errors
**File:** `src/components/LandingScreen.tsx:76-80`
**What's wrong:** The effect sets `voiceError` when `speechError` changes to a non-null value, but never clears `voiceError` when `speechError` becomes `null`. The voice error banner persists even after the error condition is resolved.
**What could go wrong:** User sees "I didn't hear anything. Try again?" forever until they manually dismiss it, even if they've successfully started a new recording.
**Suggested fix:** Add `else { setVoiceError(null) }` to clear the error when `speechError` is null.

### N12. Sprint status update after completing all tasks races with uncompleting
**File:** `src/components/SprintView.tsx:244-263`
**What's wrong:** When the last task is completed, `updateSprintStatus(sprint.id, 'completed')` fires asynchronously. If the user immediately uncompletes a task, `updateSprintStatus(sprint.id, 'active')` also fires. These are two concurrent, uncoordinated async writes. Depending on execution order, the sprint could end up in the wrong status.
**What could go wrong:** Sprint permanently shows as "completed" in history even though one task is pending. Or vice versa.
**Suggested fix:** Use a ref to track the latest intended status, or await the status update and check current state before writing.

### N13. Production console.log statements left in
**File:** `src/lib/database.ts:209`, `src/lib/database.ts:214`
**What's wrong:** `console.log('[DB] updateTaskStatus:', ...)` is left in production code. Every task toggle logs to the console.
**Suggested fix:** Remove them or gate behind a `__DEV__` check.

### N14. `getEmojiForTask` regex runs on every render cycle
**File:** `src/components/SprintView.tsx:114-137`
**What's wrong:** The `KEYWORD_EMOJI_MAP` array of 15 compiled regexes is fine, but `getEmojiForTask` is called inside `handleAddTaskSubmit` which is inside a `useCallback` — this is actually fine for execution, but the regex array is module-level with the `i` flag but no `g` flag, which is correct. No real issue here, just noting it's an O(n) scan per task add. Fine at n=15.
**What could go wrong:** Nothing at current scale. This is the least of your problems.

---

## Summary

| Severity | Count | Key themes |
|----------|-------|------------|
| 🔴 Critical | 6 | API key exposure, CSP disabled, overly broad FS access, DB race conditions, no transactions |
| 🟡 Important | 13 | N+1 queries, no indexes, silent error swallowing, optimistic UI without rollback, data loss on undo |
| 🟢 Nice to have | 14 | Dual state management, code duplication, hardcoded locale, stale closures |

**Top 3 priorities (if I had to pick):**
1. **C1 + C2 + C4**: The security trifecta. API key in bundle + no CSP + `$HOME/**` write access. Fix all three before shipping.
2. **C5 + C6**: Database integrity. Add connection mutex and transactions.
3. **I5 + I6**: Optimistic UI failures. Your ADHD users will lose tasks and trust.
