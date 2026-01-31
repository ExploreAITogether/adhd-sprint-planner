# ADHD Sprint Planner — Task Plan

> **Companion to:** System Spec v1.0
> **Purpose:** Ordered implementation steps for Claude Code
> **Rule:** Complete each task before moving to the next. No redesigning mid-build.

---

## Phase 0: Project Setup

### 0.1 Initialize Tauri + React project
- [ ] Create new Tauri project with React + TypeScript template
- [ ] Verify it runs on your machine (dev mode)
- [ ] Set app name: "ADHD Sprint Planner"
- [ ] Configure for macOS + Windows builds

### 0.2 Add dependencies
- [ ] Install Tailwind CSS and configure
- [ ] Install additional packages: uuid generator, date formatting (date-fns)
- [ ] Set up basic folder structure (`/components`, `/hooks`, `/lib`, `/types`)

### 0.3 Set up local database
- [ ] Add Tauri SQLite plugin
- [ ] Create database schema (sprints, tasks, settings tables)
- [ ] Write basic CRUD functions (create sprint, add task, update task, etc.)

---

## Phase 1: Core Input Flow

### 1.1 Build the landing screen
- [ ] Create main layout component with Calm/Headspace styling
- [ ] Soft gradient background (lavender → soft blue)
- [ ] Centered card with generous padding and rounded corners
- [ ] Calm heading: "What do you need to get done?"

### 1.2 Add text input
- [ ] Large, comfortable textarea for brain dump
- [ ] Placeholder text: "Just dump it all here..."
- [ ] Auto-expanding height as user types
- [ ] Soft border, rounded corners, calm focus state

### 1.3 Add "Make tasks" button
- [ ] Styled button below textarea: "✨ Make tasks"
- [ ] Disabled state when textarea is empty
- [ ] Loading state for when AI is processing

---

## Phase 2: AI Integration

### 2.1 Set up Gemini API connection
- [ ] Create API utility file for Gemini calls
- [ ] Store API key securely (Tauri secure storage or env)
- [ ] Create function: `parsebrainDump(text) → Task[]`

### 2.2 Build the parsing prompt
- [ ] Craft prompt that instructs Gemini to:
  - Split messy input into 1–5 discrete tasks
  - Clean up grammar/clarity
  - Add contextual emoji per task
  - Generate 1–3 topic tags per task
  - Return structured JSON
- [ ] Handle edge cases (empty input, single task, too many tasks)

### 2.3 Wire up the flow
- [ ] On "Make tasks" click → send to Gemini → receive tasks
- [ ] Save sprint + tasks to local database
- [ ] Transition to sprint view

---

## Phase 3: Sprint View (Task List)

### 3.1 Build task list layout
- [ ] Sprint view container with same calm styling
- [ ] Header: "Your Sprint" or similar calm copy
- [ ] List of task cards (rounded, soft shadows, generous spacing)

### 3.2 Build individual task card
- [ ] Display: checkbox, number, emoji, task title
- [ ] "🪄 Help" button on each card (right side)
- [ ] Pending state: normal appearance
- [ ] Completed state: strikethrough, muted colors, checkmark

### 3.3 Add progress indicator
- [ ] Show "2/5 done" or visual progress bar
- [ ] Soft, rounded progress bar that fills with calm color
- [ ] Updates live as tasks are completed

---

## Phase 4: Task Completion (Dopamine Hits)

### 4.1 Implement check-off interaction
- [ ] Click checkbox or card to toggle complete
- [ ] Update task status in database
- [ ] Update UI immediately (optimistic update)

### 4.2 Add completion animation
- [ ] Checkmark appears with satisfying pop/burst
- [ ] Task text gets gentle strikethrough animation
- [ ] Card slightly fades or shifts to "done" state
- [ ] Keep animations smooth and calm (not hyperactive)

### 4.3 Add completion sound
- [ ] Soft chime or pop sound on task complete
- [ ] Respect sound_enabled setting (default: on)
- [ ] Keep sound file small and pleasant

### 4.4 Add sprint completion celebration
- [ ] When all tasks done → brief celebration moment
- [ ] Calm message: "That's a wrap. 5 for 5." (or similar)
- [ ] Subtle confetti or gentle animation
- [ ] Option to start new sprint or view history

---

## Phase 5: Voice Input

### 5.1 Add voice button to input screen
- [ ] Microphone button next to "Make tasks": "🎤 Voice"
- [ ] Visual states: idle, recording, processing

### 5.2 Implement Web Speech API
- [ ] Use browser's built-in speech recognition
- [ ] Start recording on button press
- [ ] Stop on button release (or second tap)
- [ ] Transcribe speech to text

### 5.3 Wire voice to existing flow
- [ ] Transcribed text populates the textarea
- [ ] User can edit before submitting
- [ ] Then proceeds through normal "Make tasks" flow

---

## Phase 6: History & Record Keeping

### 6.1 Build history view
- [ ] New screen/tab: "History"
- [ ] Navigation: button on sprint view to access history
- [ ] Same calm styling as rest of app

### 6.2 Display completed sprints
- [ ] Grouped by date: "Friday, Jan 31"
- [ ] Show completed tasks with emoji and checkmark
- [ ] Show tags as small pills/badges
- [ ] Scrollable list, newest first

### 6.3 Add search functionality
- [ ] Search input at top of history view
- [ ] Search by keyword (task title) or tag
- [ ] Filter results live as user types
- [ ] Clear search button

### 6.4 Add markdown export
- [ ] "Export" button in history view
- [ ] Generates markdown file with all completed tasks
- [ ] Format: dates as headers, tasks as checklist items
- [ ] Uses Tauri file save dialog for location

---

## Phase 7: "Help Me" Prompt Generator

### 7.1 Build prompt generation logic
- [ ] Create function: `generateHelpPrompt(task) → string`
- [ ] Craft Gemini prompt that analyzes task type:
  - Coding task → debugging/implementation prompt
  - Writing task → drafting/outlining prompt
  - Research task → investigation prompt
  - Admin task → step-by-step prompt
  - Generic fallback for unclear types

### 7.2 Build prompt modal/panel
- [ ] Click "🪄 Help" → opens modal or side panel
- [ ] Shows generated prompt in copyable text area
- [ ] "Copy to clipboard" button
- [ ] Close button to return to sprint

### 7.3 Polish the experience
- [ ] Loading state while prompt generates
- [ ] Success feedback on copy ("Copied!")
- [ ] Store generated prompt in database (optional, for reference)

---

## Phase 8: Settings & Polish

### 8.1 Build settings screen
- [ ] Accessible from main view (gear icon or menu)
- [ ] Toggle: Sound effects on/off
- [ ] Toggle: Theme (light/dark/system)
- [ ] Default export location (optional)

### 8.2 Implement theme support
- [ ] Light mode: soft warm gradients
- [ ] Dark mode: calm dark with muted accents
- [ ] System mode: follow OS preference
- [ ] Persist setting to database

### 8.3 Final UI polish
- [ ] Review all spacing, ensure generous whitespace
- [ ] Check all animations are smooth and calm
- [ ] Ensure consistent border radius everywhere
- [ ] Test typography (Inter or SF Pro, proper weights)

### 8.4 Error handling
- [ ] Graceful handling if Gemini API fails
- [ ] Offline state handling (can still view history)
- [ ] User-friendly error messages (calm tone)

---

## Phase 9: Build & Release

### 9.1 Test on both platforms
- [ ] Test full flow on macOS
- [ ] Test full flow on Windows
- [ ] Fix any platform-specific bugs

### 9.2 Build release versions
- [ ] Create macOS build (.dmg or .app)
- [ ] Create Windows build (.exe or .msi)
- [ ] Test installers on clean machines if possible

### 9.3 Final checklist
- [ ] App icon designed and added
- [ ] App metadata complete (name, version, description)
- [ ] README for the repo
- [ ] First release tagged in git

---

## Quick Reference: Task Count by Phase

| Phase | Tasks | Focus |
|-------|-------|-------|
| 0 | 3 | Setup |
| 1 | 3 | Input UI |
| 2 | 3 | AI Integration |
| 3 | 3 | Task List |
| 4 | 4 | Dopamine Hits |
| 5 | 3 | Voice Input |
| 6 | 4 | History |
| 7 | 3 | Help Prompts |
| 8 | 4 | Settings/Polish |
| 9 | 3 | Build/Release |
| **Total** | **33** | |

---

## How to Use This Plan

1. **Start at Phase 0.1** — don't skip ahead
2. **One task at a time** — check it off, then move on
3. **If something's broken** — fix it before proceeding
4. **If you discover a missing step** — add it to the list, don't spiral
5. **Use the Execution Prompts doc** — each phase has a matching prompt for Claude Code

---

*Next document: Execution Prompts (copy-paste prompts for Claude Code)*
