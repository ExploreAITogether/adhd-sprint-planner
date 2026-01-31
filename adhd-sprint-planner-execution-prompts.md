# ADHD Sprint Planner — Execution Prompts

> **Companion to:** System Spec v1.0 + Task Plan
> **Purpose:** Copy-paste prompts for Claude Code
> **Usage:** Run each phase's prompt, verify it works, then move to the next

---

## How to Use This Document

1. **Start each session** by telling Claude Code which phase you're on
2. **Copy the prompt** for that phase
3. **Paste it** into Claude Code
4. **Let it build**, then test before moving on
5. **If something breaks**, fix it before proceeding to the next phase

**Pro tip:** At the start of each Claude Code session, paste this context-setter:

```
I'm building an ADHD Sprint Planner app. Here's the quick context:
- Desktop app using Tauri (Rust + React/TypeScript)
- Calming Headspace/Calm aesthetic
- Takes messy brain dumps → AI parses into 1-5 tasks → satisfying completion tracking
- Uses Gemini API (free tier) for AI features
- Local SQLite storage

I'm currently on [PHASE X]. Let's continue.
```

---

## Phase 0: Project Setup

### Prompt 0.1 — Initialize Tauri + React Project

```
Create a new Tauri v2 project with React and TypeScript. 

Requirements:
- App name: "ADHD Sprint Planner"
- Use Vite as the bundler
- Configure for both macOS and Windows builds
- Set up the basic Tauri configuration with a simple window (800x600 default size, resizable)
- The window title should be "ADHD Sprint Planner"

After scaffolding, verify the project runs in dev mode.

Show me the commands to run and what the folder structure should look like when done.
```

### Prompt 0.2 — Add Dependencies & Folder Structure

```
Now let's add dependencies and set up the folder structure.

Install and configure:
1. Tailwind CSS v3 (with PostCSS)
2. uuid package for generating unique IDs
3. date-fns for date formatting

Create this folder structure in /src:
```
/src
  /components    # React components
  /hooks         # Custom React hooks
  /lib           # Utility functions, API calls
  /types         # TypeScript type definitions
  /assets        # Images, sounds, etc.
```

Also create a `/src/types/index.ts` file with these TypeScript types based on our data model:

```typescript
export interface Sprint {
  id: string;
  created_at: string;
  status: 'active' | 'completed' | 'abandoned';
  raw_input: string;
  tasks: Task[];
}

export interface Task {
  id: string;
  sprint_id: string;
  title: string;
  emoji: string;
  tags: string[];
  status: 'pending' | 'completed';
  completed_at: string | null;
  generated_prompt: string | null;
}

export interface Settings {
  sound_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  export_path: string;
}
```

Verify Tailwind is working by adding a simple colored div to App.tsx.
```

### Prompt 0.3 — Set Up SQLite Database

```
Set up local SQLite storage using Tauri's SQL plugin.

Steps:
1. Add the Tauri SQL plugin (tauri-plugin-sql) to the project
2. Configure it in the Tauri config and Rust backend
3. Create a database initialization function that creates these tables if they don't exist:

Tables needed:
- sprints (id TEXT PRIMARY KEY, created_at TEXT, status TEXT, raw_input TEXT)
- tasks (id TEXT PRIMARY KEY, sprint_id TEXT, title TEXT, emoji TEXT, tags TEXT, status TEXT, completed_at TEXT, generated_prompt TEXT)
- settings (id INTEGER PRIMARY KEY, sound_enabled INTEGER, theme TEXT, export_path TEXT)

4. Create a `/src/lib/database.ts` file with these functions:
- initDatabase() - creates tables
- createSprint(rawInput: string) -> Sprint
- getActiveSprint() -> Sprint | null
- updateSprintStatus(id: string, status: string)
- addTask(sprintId: string, task: Omit<Task, 'id' | 'sprint_id'>)
- updateTaskStatus(id: string, status: string, completedAt?: string)
- getSprintHistory() -> Sprint[]
- getSettings() -> Settings
- updateSettings(settings: Partial<Settings>)

Make sure the database initializes when the app starts.
```

---

## Phase 1: Core Input Flow

### Prompt 1.1 — Build the Landing Screen

```
Build the main landing screen with a Headspace/Calm aesthetic.

Design requirements:
- Soft gradient background (lavender #E8E0F0 to soft blue #D6E5F5)
- Centered card with:
  - White/cream background (#FDFBF7)
  - Generous padding (32px+)
  - Large border radius (24px)
  - Subtle shadow
- Calm heading at top of card: "What do you need to get done?"
  - Use Inter or system sans-serif font
  - Font weight: medium (500)
  - Color: warm gray (#4A4A4A)

Create this as the main App component for now. We'll add the input elements in the next step.

The overall vibe should feel like opening a meditation app - calming, spacious, inviting.
```

### Prompt 1.2 — Add Text Input

```
Add the brain dump text input to the landing screen card.

Requirements:
- Large textarea below the heading
- Placeholder text: "Just dump it all here... tasks, thoughts, whatever's on your mind."
- Styling:
  - Soft border (#E5E5E5)
  - Border radius: 16px
  - Padding: 16px
  - Min height: 150px
  - Auto-expand as user types (up to 300px max)
  - Calm focus state: soft blue border (#A8C5DA), no harsh outline
  - Font: 16px, same warm gray color
- Store the input value in React state

The textarea should feel comfortable and low-pressure to type in.
```

### Prompt 1.3 — Add "Make Tasks" Button

```
Add the "Make tasks" button below the textarea.

Requirements:
- Button text: "✨ Make tasks"
- Styling:
  - Background: soft gradient (calm blue #7EB5D6 to slightly deeper #6BA5C9)
  - Text: white, medium weight
  - Padding: 14px 28px
  - Border radius: 12px
  - Subtle shadow
  - Hover: slightly brighter, gentle scale (1.02)
  - Transition: smooth (200ms ease)
- States:
  - Disabled when textarea is empty (grayed out, cursor not-allowed)
  - Loading state: show a gentle spinner or "Thinking..." text
- On click: for now, just console.log the textarea content (we'll wire up AI next)

Also add a subtle "or" divider and placeholder for the voice button (just a disabled 🎤 button for now - we'll implement voice in Phase 5).
```

---

## Phase 2: AI Integration

### Prompt 2.1 — Set Up Gemini API Connection

```
Set up the Gemini API integration for parsing brain dumps.

Create `/src/lib/gemini.ts` with:

1. A function to initialize/configure the Gemini API
   - Use Gemini 1.5 Flash model (free tier)
   - API key should be stored securely (use environment variable VITE_GEMINI_API_KEY for now)

2. A function `parseBrainDump(text: string): Promise<Task[]>` that:
   - Sends the brain dump text to Gemini
   - Returns an array of parsed tasks

For now, just set up the API connection and a basic test call. We'll craft the actual prompt in the next step.

Also create a `.env.example` file showing what environment variables are needed:
```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

Add .env to .gitignore if not already there.
```

### Prompt 2.2 — Build the Parsing Prompt

```
Create the prompt that instructs Gemini to parse brain dumps into tasks.

Update the `parseBrainDump` function in `/src/lib/gemini.ts` with this carefully crafted prompt:

The prompt should instruct Gemini to:
1. Take messy, stream-of-consciousness input
2. Extract 1-5 discrete, actionable tasks (never more than 5)
3. Clean up grammar and clarify vague phrasing
4. Add a single contextual emoji at the start of each task
5. Generate 1-3 topic tags per task (lowercase, single words like "email", "coding", "health")
6. Return valid JSON in this exact format:

```json
{
  "tasks": [
    {
      "title": "Reply to Sarah's email about the project timeline",
      "emoji": "📧",
      "tags": ["email", "work", "communication"]
    }
  ]
}
```

The prompt should also specify:
- If input is vague, make reasonable assumptions rather than asking questions
- If input has more than 5 tasks, prioritize the most actionable/urgent ones
- Keep task titles concise but clear (under 60 characters ideally)
- Tone: helpful assistant, not robotic

Add error handling for:
- Empty responses
- Invalid JSON
- API errors

Return empty array if parsing fails completely.
```

### Prompt 2.3 — Wire Up the Full Flow

```
Connect the brain dump input to the AI and database.

When user clicks "Make tasks":

1. Show loading state on button
2. Call `parseBrainDump()` with textarea content
3. Create a new sprint in the database with:
   - Generated UUID
   - Current timestamp
   - Status: "active"
   - Raw input: the original textarea content
4. Add each parsed task to the database
5. Clear the textarea
6. Navigate/transition to the sprint view (for now, just update state to show tasks)

Create a simple temporary sprint view that displays:
- The list of tasks with their emoji and title
- A "Back to input" button (temporary, for testing)

Test the full flow: type messy input → click button → see cleaned tasks appear.

Handle edge cases:
- API timeout (show friendly error, let user retry)
- No tasks parsed (show "Hmm, I couldn't find any tasks in there. Try again?")
```

---

## Phase 3: Sprint View (Task List)

### Prompt 3.1 — Build Task List Layout

```
Build the proper sprint view layout to replace the temporary one.

Requirements:
- Same calm gradient background as landing screen
- Centered card (slightly wider than input card - max 600px)
- Header inside card: "Your Sprint" in calm typography
- Subheader: light gray text showing date ("Friday, January 31")
- Task list container below header
- Same generous spacing and rounded corners as the rest of the app

Create a SprintView component that:
- Receives the current sprint data (or reads from state/database)
- Displays tasks in a vertical list
- Has room at bottom for progress indicator and action buttons

The layout should feel spacious, not cramped. Each task should have breathing room.
```

### Prompt 3.2 — Build Individual Task Card

```
Build the TaskCard component for displaying individual tasks.

Requirements:
- Card styling:
  - White background
  - Border radius: 16px
  - Subtle shadow
  - Padding: 16px
  - Margin bottom: 12px between cards
- Layout (horizontal):
  - Left: circular checkbox (24px)
  - Middle: emoji + task title
  - Right: "🪄 Help" button (subtle, appears on hover or always visible on mobile)

States:
- Pending:
  - Checkbox: empty circle with soft border
  - Text: normal color
  - Help button: visible
- Completed:
  - Checkbox: filled with soft green, white checkmark
  - Text: strikethrough, muted gray color
  - Help button: hidden
  - Entire card: slightly muted/faded (opacity 0.7)

Make the entire card clickable to toggle completion (in addition to the checkbox).

For now, clicking just toggles local state. We'll add animations and database updates in Phase 4.
```

### Prompt 3.3 — Add Progress Indicator

```
Add a progress indicator at the bottom of the sprint view.

Requirements:
- Positioned below the task list
- Shows completion status in two ways:
  1. Text: "2 of 5 done" (use calm, friendly copy)
  2. Visual progress bar below the text

Progress bar styling:
- Full width of card content
- Height: 8px
- Background: light gray (#E8E8E8)
- Fill: soft gradient matching button (calm blue)
- Border radius: 4px (fully rounded)
- Smooth animation when progress changes (300ms ease)

Also add two buttons below the progress bar:
- "View History" (secondary/outline style)
- "New Sprint" (only show when all tasks complete, primary style)

When sprint is complete (all tasks done), the progress text should change to something celebratory like "All done! 🎉" but keep it calm, not over the top.
```

---

## Phase 4: Task Completion (Dopamine Hits)

### Prompt 4.1 — Implement Check-Off Interaction

```
Wire up task completion with database persistence.

When a task is clicked/checked:
1. Immediately update UI (optimistic update)
2. Update task status in database:
   - Set status to "completed"
   - Set completed_at to current timestamp
3. Recalculate sprint progress
4. If all tasks complete, update sprint status to "completed"

Also handle unchecking (though users rarely do this):
- Set status back to "pending"
- Clear completed_at
- Update sprint status back to "active" if needed

Make sure the UI never feels laggy - the visual change should happen instantly, database write happens in background.
```

### Prompt 4.2 — Add Completion Animation

```
Add satisfying animations when completing a task.

Requirements:
1. Checkbox animation:
   - When checked, the circle fills from center outward
   - Checkmark draws in with a slight bounce
   - Use CSS transitions or Framer Motion (install if needed)

2. Text strikethrough:
   - Line draws through text from left to right (300ms)
   - Slight delay after checkbox completes

3. Card state change:
   - Gentle fade to muted state (opacity transition)
   - Maybe subtle scale down (0.98) then back

4. Small "burst" effect (optional but delightful):
   - Tiny particles or ring that expands outward from checkbox
   - Very subtle - think Apple's confetti but much smaller
   - Only lasts 400ms

Keep all animations:
- Smooth and calm (ease-out curves)
- Not too fast (humans need time to register the reward)
- Not too slow (shouldn't feel sluggish)

Test completing multiple tasks in a row - it should feel satisfying but not overwhelming.
```

### Prompt 4.3 — Add Completion Sound

```
Add an optional sound effect when completing a task.

Requirements:
1. Find or create a soft, pleasant completion sound:
   - Short (under 500ms)
   - Soft chime, pop, or gentle "ding"
   - Not jarring or loud
   - Consider using a royalty-free sound or generating one

2. Save the sound file in `/src/assets/sounds/complete.mp3` (or .wav)

3. Create a sound utility in `/src/lib/sounds.ts`:
   - Function: `playCompleteSound()`
   - Should check settings.sound_enabled before playing
   - Preload the sound on app start for instant playback

4. Play the sound when a task is completed (coordinated with the animation)

5. Add a way to toggle sound in the UI (temporary button for now, will move to settings later):
   - Small speaker icon in corner
   - Click to toggle sound on/off
   - Persist to database

The sound should make completing tasks feel good without being annoying if you complete several in a row.
```

### Prompt 4.4 — Add Sprint Completion Celebration

```
Add a celebration moment when all tasks in a sprint are completed.

Requirements:
1. Trigger when the last task is checked off

2. Visual celebration:
   - Brief pause (200ms) after last task animation
   - Subtle confetti or particle effect (keep it calm, not party-mode)
   - Or: gentle "glow" effect on the progress bar
   - Progress bar could do a subtle shimmer

3. Message change:
   - Progress text changes to celebration copy
   - Examples (pick one, keep it calm):
     - "That's a wrap. All done. ✨"
     - "Nice sprint. 5 for 5."
     - "Done and done. 🎉"
   - Use slightly larger/bolder text for this moment

4. Action prompt:
   - After 1 second, gently highlight the "New Sprint" button
   - Or show a subtle prompt: "Ready for another?" 

5. Sound (optional):
   - Slightly different/longer completion sound for sprint finish
   - Or just play the regular sound - keep it simple

The goal: a moment of genuine satisfaction without being cheesy or over-the-top. Think "Headspace session complete" energy.
```

---

## Phase 5: Voice Input

### Prompt 5.1 — Add Voice Button to Input Screen

```
Replace the placeholder voice button with a real one.

Requirements:
1. Button design:
   - Circular button with microphone icon (🎤 or SVG icon)
   - Same calm styling as rest of app
   - Size: 48px diameter
   - Background: soft gray (#F0F0F0)
   - Positioned next to "Make tasks" button

2. Visual states:
   - Idle: gray background, dark icon
   - Hover: slightly darker background
   - Recording: 
     - Red/coral background (#E57373)
     - Pulsing animation (gentle scale pulse)
     - Maybe subtle "recording" ring animation
   - Processing: show spinner or "..." animation

3. Layout update:
   - "Make tasks" and "Voice" buttons should be side by side
   - Or: Voice button on the left, Make tasks on the right
   - Keep the layout balanced and calm

For now, clicking the button just toggles the recording state visually. We'll add actual speech recognition next.
```

### Prompt 5.2 — Implement Web Speech API

```
Implement voice-to-text using the Web Speech API.

Requirements:
1. Create `/src/hooks/useSpeechRecognition.ts` custom hook:
   - Uses Web Speech API (window.SpeechRecognition or webkitSpeechRecognition)
   - Returns: { isListening, transcript, startListening, stopListening, error }
   - Handles browser compatibility (show friendly message if not supported)

2. Speech recognition settings:
   - Continuous: true (keep listening until stopped)
   - Interim results: true (show text as user speaks)
   - Language: 'en-US' (default)

3. Behavior:
   - Click voice button → start recording
   - Click again (or release if holding) → stop recording
   - As user speaks, transcript appears in the textarea in real-time
   - When stopped, final transcript stays in textarea

4. Error handling:
   - Microphone permission denied: show friendly message with instructions
   - No speech detected: show "I didn't catch anything. Try again?"
   - API not supported: hide voice button or show "Voice not supported in this browser"

Test that the transcript properly populates the textarea as you speak.
```

### Prompt 5.3 — Wire Voice to Existing Flow

```
Connect voice input to the full task creation flow.

Requirements:
1. After voice recording stops:
   - Transcript is in the textarea
   - User can review and edit if needed
   - "Make tasks" button becomes active (if transcript isn't empty)

2. Flow is then identical to text input:
   - Click "Make tasks" → AI parses → tasks appear

3. UX improvements:
   - While recording, show live transcript in textarea (so user sees it working)
   - After recording, textarea is editable (user might want to add/fix things)
   - Consider adding a "Clear" button to reset if transcript is wrong

4. Edge cases:
   - Very short transcript (under 5 words): still try to parse, might be valid
   - Very long transcript: cap at reasonable length or warn user

5. Accessibility:
   - Button should have aria-label: "Start voice recording" / "Stop recording"
   - Announce recording state to screen readers

Test the full voice flow: click record → speak messy thoughts → stop → see transcript → click Make tasks → see clean tasks.
```

---

## Phase 6: History & Record Keeping

### Prompt 6.1 — Build History View

```
Create the history view for browsing completed sprints.

Requirements:
1. New route/view: HistoryView component
2. Navigation:
   - "View History" button on sprint view goes here
   - Back button to return to current sprint (or landing if no active sprint)

3. Layout:
   - Same calm gradient background
   - Centered container (max-width 700px)
   - Header: "Your History" or "What You've Done"
   - Scrollable content area

4. Styling:
   - Match the calm Headspace aesthetic
   - Generous spacing between date groups
   - Same rounded cards and soft shadows

5. State management:
   - Load sprint history from database on mount
   - Show loading state while fetching
   - Show empty state if no history: "Nothing here yet. Complete your first sprint!"

For now, just set up the layout and navigation. We'll populate with data in the next step.
```

### Prompt 6.2 — Display Completed Sprints

```
Populate the history view with completed sprints and tasks.

Requirements:
1. Group sprints by date:
   - Header for each date: "Friday, January 31" 
   - Use relative dates for recent: "Today", "Yesterday"
   - Then fall back to full date format

2. Under each date, show completed tasks:
   - Compact card style (less padding than active sprint)
   - Show: ✓ emoji + task title
   - Tasks shown in a tighter list (8px gap instead of 12px)
   - All in muted/completed styling

3. Show tags:
   - Below each task or grouped at bottom of date section
   - Small pill/badge style
   - Soft colors (light background, darker text)
   - Clickable (will filter by tag - implement in search step)

4. Sprint metadata:
   - Optionally show "4 tasks completed" under date header
   - Subtle text, not prominent

5. Scrolling:
   - Newest sprints at top
   - Smooth scrolling
   - Consider "infinite scroll" or "Load more" if history gets long

Query the database for all sprints with status "completed", include their tasks.
```

### Prompt 6.3 — Add Search Functionality

```
Add search and filtering to the history view.

Requirements:
1. Search input:
   - Positioned at top of history view, below header
   - Placeholder: "Search tasks or tags..."
   - Same calm input styling as brain dump textarea
   - Smaller size (height: 44px)
   - Search icon (🔍) inside input on left

2. Search behavior:
   - Filter as user types (debounce 300ms)
   - Search in:
     - Task titles (partial match)
     - Tags (exact match)
   - Case insensitive

3. Results display:
   - Show matching tasks, still grouped by date
   - Highlight matching text (subtle background color)
   - If searching by tag, show "Showing tasks tagged: #coding"
   - If no results: "No tasks found for '[query]'"

4. Clear search:
   - X button appears when search has text
   - Click to clear and show all history

5. Tag clicking:
   - Clicking a tag pill fills the search with that tag
   - Quick way to see "all my coding tasks"

Test: complete a few sprints with different tags, then search by keyword and by tag.
```

### Prompt 6.4 — Add Markdown Export

```
Add the ability to export history as a markdown file.

Requirements:
1. Export button:
   - Position: top right of history view, near search
   - Text: "Export" with download icon
   - Secondary/outline button style

2. Export format (markdown):
```markdown
# Task History

## Friday, January 31, 2025

- [x] 📧 Reply to Sarah's email about the project timeline
  - Tags: email, work
- [x] 💻 Fix the login bug in the dashboard
  - Tags: coding, bugfix
- [x] 📝 Draft intro for the blog post
  - Tags: writing

## Thursday, January 30, 2025

- [x] 🏃 Schedule gym session for next week
  - Tags: health, planning

---
*Exported from ADHD Sprint Planner*
```

3. Export flow:
   - Click Export button
   - Tauri file save dialog opens
   - Default filename: "task-history-YYYY-MM-DD.md"
   - Default location: from settings (or Downloads)
   - User picks location and saves
   - Show success toast: "History exported!"

4. Options (optional, nice-to-have):
   - Export all history vs. filtered results (if search is active)
   - Date range picker (later version)

Use Tauri's file system API to write the file.
```

---

## Phase 7: "Help Me" Prompt Generator

### Prompt 7.1 — Build Prompt Generation Logic

```
Create the AI logic for generating contextual help prompts.

Create `/src/lib/promptGenerator.ts` with:

1. Function: `generateHelpPrompt(task: Task): Promise<string>`

2. This function should:
   - Send the task to Gemini with a meta-prompt
   - The meta-prompt asks Gemini to analyze the task type and generate a helpful prompt

3. The meta-prompt should instruct Gemini to:
   - Identify the task type (coding, writing, research, admin, communication, creative, planning, etc.)
   - Generate a ready-to-use prompt that the user can paste into any AI assistant
   - The generated prompt should be specific to the task
   - Include relevant context that would help the AI assist

4. Example outputs:

   Task: "Fix the login bug in the dashboard"
   Generated prompt: "I need to debug a login issue in my web dashboard. The bug is [describe symptoms]. My stack is [your stack]. Help me identify the root cause and fix it step by step."

   Task: "Write the intro for my blog post about AI tools"
   Generated prompt: "Help me write an engaging introduction for a blog post about AI tools. The target audience is [describe]. The tone should be [casual/professional]. The post will cover [topics]. Give me 2-3 options to choose from."

   Task: "Research competitors' pricing"
   Generated prompt: "Help me research and compare pricing strategies for [product type]. I need to analyze [number] competitors. Create a comparison table with pricing tiers, features, and positioning."

5. The prompt should include [bracketed placeholders] where the user might want to add specific details.

6. Error handling:
   - If generation fails, return a generic but still helpful prompt
   - Generic fallback: "Help me with this task: [task title]. Break it down into steps and guide me through it."
```

### Prompt 7.2 — Build Prompt Modal/Panel

```
Build the UI for displaying and copying generated prompts.

Requirements:
1. Trigger: clicking "🪄 Help" button on any task card

2. Modal design:
   - Centered modal with backdrop (semi-transparent dark overlay)
   - Modal card: white background, rounded corners, max-width 500px
   - Same calm aesthetic as rest of app

3. Modal content:
   - Header: "Here's a prompt to help with this:"
   - Task reminder: show the task emoji + title (smaller text)
   - Generated prompt: displayed in a styled text area
     - Monospace or slightly different font to indicate "code/prompt"
     - Soft background (#F5F5F5)
     - Rounded corners
     - Read-only but selectable
   - Copy button: "Copy to clipboard" (primary button style)
   - Close button: X in top right corner, or "Done" text button

4. States:
   - Loading: show skeleton or "Generating..." while AI works
   - Success: show the prompt
   - Error: show friendly message + generic fallback prompt

5. Interactions:
   - Click outside modal or X to close
   - Escape key closes modal
   - Copy button copies text and shows "Copied!" feedback (2 seconds)

6. Animation:
   - Modal fades in (200ms)
   - Backdrop fades in
   - Gentle scale up from 0.95 to 1

Test: click Help on different types of tasks, verify the prompts are contextually relevant.
```

### Prompt 7.3 — Polish the Experience

```
Polish the Help prompt feature with final touches.

Requirements:
1. Loading state improvement:
   - Show a calming loading animation
   - Maybe: "Crafting a prompt..." or "Thinking..." with animated dots
   - Don't make user wait more than 3-4 seconds (Gemini should be fast)

2. Copy feedback:
   - Button text changes to "Copied!" with checkmark
   - Button background briefly changes to soft green
   - Reverts after 2 seconds

3. Store generated prompts:
   - Save the generated prompt to the task record in database
   - On subsequent clicks, offer to show cached prompt or regenerate
   - "Show saved prompt" vs "Generate new"
   - This saves API calls and lets user reference prompts later

4. Usage hint:
   - Small text below prompt: "Paste this into Claude, ChatGPT, or any AI assistant"
   - Or show small icons of common AI tools

5. Keyboard shortcuts:
   - Cmd/Ctrl+C copies when modal is open
   - Enter key copies (alternative to clicking button)

6. Edge case:
   - If task is already completed, still allow Help (user might want the prompt for reference)
   - But maybe show it differently: "Need help with something similar?"

Test the full flow multiple times - it should feel seamless and quick.
```

---

## Phase 8: Settings & Polish

### Prompt 8.1 — Build Settings Screen

```
Create a settings screen for app preferences.

Requirements:
1. Access: gear icon (⚙️) in the top corner of main views
   - Position: top right of card/container
   - Subtle, doesn't dominate the UI

2. Settings view:
   - Could be a modal or a separate screen (modal is probably simpler)
   - Title: "Settings"
   - Same calm styling

3. Settings options:

   a) Sound effects:
      - Toggle switch
      - Label: "Completion sounds"
      - Sublabel: "Play a sound when you complete tasks"
   
   b) Theme:
      - Segmented control or radio buttons
      - Options: Light / Dark / System
      - Label: "Appearance"
   
   c) Export location:
      - Show current path (truncated if long)
      - "Change" button opens folder picker
      - Label: "Default export location"

4. Save behavior:
   - Changes save immediately (no Save button needed)
   - Show subtle feedback when changed: brief checkmark or "Saved"

5. Additional info (bottom of settings):
   - App version: "ADHD Sprint Planner v1.0"
   - Link: "View on GitHub" (if public)

Create the settings modal/view and wire up the toggles to update the database.
```

### Prompt 8.2 — Implement Theme Support

```
Implement light/dark/system theme switching.

Requirements:
1. Theme definitions:

   Light mode:
   - Background gradient: lavender (#E8E0F0) to soft blue (#D6E5F5)
   - Card background: warm white (#FDFBF7)
   - Text: warm gray (#4A4A4A)
   - Accents: calm blue (#7EB5D6)

   Dark mode:
   - Background: deep calm (#1A1A2E to #16213E gradient)
   - Card background: dark gray (#252540)
   - Text: soft white (#E8E8E8)
   - Accents: muted blue (#5A9BC7)
   - Keep it calm, not harsh black

   System mode:
   - Follow OS preference
   - Use prefers-color-scheme media query

2. Implementation:
   - Use CSS variables for all theme colors
   - Create a ThemeProvider or context
   - Apply theme class to root element
   - Smooth transition when changing themes (200ms)

3. Persistence:
   - Save preference to settings in database
   - Load and apply on app start
   - If "system", listen for OS changes

4. Testing:
   - Verify all components look good in both themes
   - Check contrast ratios are accessible
   - Test animations in both themes

Apply theme throughout the entire app - every component should respect the current theme.
```

### Prompt 8.3 — Final UI Polish

```
Final UI polish pass across the entire app.

Go through each screen and verify:

1. Spacing consistency:
   - Card padding: 24-32px throughout
   - Element gaps: consistent (8px, 12px, 16px scale)
   - No cramped areas

2. Border radius consistency:
   - Large containers: 24px
   - Cards: 16px
   - Buttons: 12px
   - Inputs: 12-16px
   - Small elements (tags, badges): 8px

3. Typography:
   - Use Inter font (install if needed) or system sans-serif
   - Font sizes: limited scale (14, 16, 18, 24px)
   - Line heights: generous (1.5 or more)
   - Only regular (400) and medium (500) weights

4. Shadows:
   - Consistent soft shadows
   - Cards: 0 2px 8px rgba(0,0,0,0.08)
   - Modals: slightly stronger 0 4px 20px rgba(0,0,0,0.15)

5. Animations:
   - All animations use ease-out or ease-in-out
   - Duration: 150-300ms for interactions, up to 500ms for celebrations
   - Nothing janky or jarring

6. Responsive:
   - Test at different window sizes
   - Minimum comfortable width: 400px
   - Maximum content width: 600-700px (centered)

7. Focus states:
   - All interactive elements have visible focus states
   - Soft blue outline for accessibility
   - Remove default browser outlines, replace with styled ones

Create a checklist of any issues found and fix them systematically.
```

### Prompt 8.4 — Error Handling & Edge Cases

```
Add comprehensive error handling throughout the app.

Scenarios to handle:

1. Gemini API errors:
   - Network failure: "Couldn't connect to AI. Check your internet and try again."
   - Rate limit: "Slow down! Take a breath and try again in a minute."
   - Invalid API key: "There's an issue with the AI setup. Check settings."
   - Display errors in a calm toast/notification, not harsh alert

2. Database errors:
   - Failed to save: retry silently, then show error if persistent
   - Corrupted data: graceful fallback, don't crash

3. Voice recognition:
   - Not supported: hide voice button, no error needed
   - Permission denied: "Microphone access needed for voice input. Enable in system settings."
   - No speech detected: "I didn't hear anything. Try again?"

4. Empty states (not errors, but handle gracefully):
   - No active sprint: show landing page
   - No history: "Nothing here yet" message
   - Search with no results: "No matches found"

5. Offline behavior:
   - Can still view history (it's local)
   - AI features show "You're offline" instead of failing mysteriously
   - Queue actions to retry when back online (optional, advanced)

6. Error UI component:
   - Create a reusable ErrorMessage component
   - Calm styling (soft red/coral background, not harsh)
   - Friendly, non-technical copy
   - "Try again" action where appropriate

7. Global error boundary:
   - Catch unexpected crashes
   - Show "Something went wrong" screen
   - Option to restart app or report issue

All error messages should maintain the app's calm, supportive tone.
```

---

## Phase 9: Build & Release

### Prompt 9.1 — Test on Both Platforms

```
Help me test the app on both macOS and Windows.

Create a testing checklist:

1. Core flows to test:
   - [ ] App launches without errors
   - [ ] Text brain dump → task creation works
   - [ ] Voice input works (if supported)
   - [ ] Tasks can be checked off
   - [ ] Animations and sounds play correctly
   - [ ] History is saved and displays
   - [ ] Search works
   - [ ] Export creates valid markdown file
   - [ ] Help prompts generate correctly
   - [ ] Settings persist across app restart
   - [ ] Theme switching works
   - [ ] Window resizing works properly

2. Platform-specific things to check:
   - macOS: window controls, menu bar, notifications permissions
   - Windows: title bar, file paths (backslashes), system tray

3. Performance:
   - App starts quickly (under 3 seconds)
   - No lag when typing
   - Animations are smooth 60fps
   - No memory leaks on long sessions

4. Data persistence:
   - Close and reopen app - active sprint still there
   - Database location is appropriate for each OS

Run through the checklist on each platform. Document any issues found.
```

### Prompt 9.2 — Build Release Versions

```
Configure and create release builds for macOS and Windows.

Requirements:

1. App metadata (update in tauri.conf.json):
   - Name: "ADHD Sprint Planner"
   - Version: "1.0.0"
   - Identifier: "com.yourname.adhd-sprint-planner"
   - Description: "A calming task planner for ADHD brains"
   - Author/publisher info

2. App icon:
   - Create or source a calm, friendly icon
   - Needs multiple sizes for both platforms
   - Should reflect the Headspace/Calm aesthetic
   - Place in appropriate Tauri asset folders

3. Build commands:
   - Document the exact commands to build for each platform
   - macOS: produces .app bundle and/or .dmg
   - Windows: produces .exe and/or .msi installer

4. Code signing (optional but recommended):
   - Note what's needed for macOS notarization
   - Note what's needed for Windows signing
   - Can skip for personal use, but document for future

5. Build optimizations:
   - Ensure release build (not debug)
   - Strip debug symbols
   - Minimize bundle size where possible

Provide step-by-step instructions for creating the release builds.
```

### Prompt 9.3 — Final Checklist & Documentation

```
Complete the final release checklist and documentation.

1. Create/update README.md:
   - What the app does (brief description)
   - Screenshot or GIF of the app
   - Features list
   - Download/install instructions
   - How to build from source
   - Tech stack used
   - License (probably MIT)

2. Final checklist:
   - [ ] All features working
   - [ ] No console errors in production build
   - [ ] App icon displays correctly
   - [ ] Window title is correct
   - [ ] Version number is set
   - [ ] Sensitive data (API keys) not in repo
   - [ ] .env.example file exists with instructions
   - [ ] .gitignore covers all build artifacts
   - [ ] Release builds tested on both platforms

3. Create first release:
   - Tag the release in git (v1.0.0)
   - Create GitHub release with:
     - Release notes (features in this version)
     - Download links for macOS and Windows builds
     - Known issues (if any)

4. Future improvements file (ROADMAP.md or in README):
   - List the "non-goals" that could become v2 features
   - Note the Tauri vs Electron decision for re-evaluation
   - Any bugs or improvements noticed during testing

Celebrate! 🎉 You built a thing!
```

---

## Troubleshooting Prompts

### If Tauri build fails:

```
The Tauri build is failing with this error:

[paste error here]

Help me debug this. Check:
1. Are all Rust dependencies installed correctly?
2. Is the Tauri CLI version compatible?
3. Are there any missing system dependencies?
4. Is the tauri.conf.json valid?

Give me specific steps to fix this.
```

### If Gemini API isn't working:

```
The Gemini API calls are failing. Here's what's happening:

[describe the issue - error message, behavior, etc.]

Help me debug:
1. Is the API key set correctly?
2. Is the request format correct for Gemini 1.5 Flash?
3. Are we hitting rate limits?
4. Is the response parsing correct?

Show me how to add better logging to identify the issue.
```

### If animations are janky:

```
The completion animations are not smooth - they're janky/stuttering.

Current implementation:
[paste relevant code]

Help me optimize:
1. Should we use CSS transitions or a library like Framer Motion?
2. Are we causing layout thrashing?
3. Are we animating the right properties (transform/opacity vs. width/height)?
4. Should we use requestAnimationFrame?

Rewrite the animation code for smooth 60fps performance.
```

### If the app is slow:

```
The app feels slow/laggy when [describe when].

Help me profile and optimize:
1. Are we doing unnecessary re-renders?
2. Is the database query slow?
3. Are we blocking the main thread?
4. Should we add loading states or optimistic updates?

Show me how to identify the bottleneck and fix it.
```

---

## Quick Reference

| Phase | Main Prompt Count | Focus |
|-------|------------------|-------|
| 0 | 3 | Project setup |
| 1 | 3 | Input UI |
| 2 | 3 | AI integration |
| 3 | 3 | Task list |
| 4 | 4 | Dopamine hits |
| 5 | 3 | Voice input |
| 6 | 4 | History |
| 7 | 3 | Help prompts |
| 8 | 4 | Polish |
| 9 | 3 | Release |
| **Total** | **33** | |

---

*Remember: If Claude Code builds something slightly different than expected, that's okay. Adapt the next prompt to what actually exists. The goal is a working app, not perfect adherence to this doc.*
