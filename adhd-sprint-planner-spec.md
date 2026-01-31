# ADHD Sprint Planner — System Spec

> **Version:** 1.0 (MVP)
> **Date:** January 30, 2025
> **Status:** Planning

---

## 1. What Are We Building?

A calming desktop app that helps people with ADHD capture overwhelming thoughts, turn them into a focused 1–5 task sprint, and feel good completing them.

**One-liner:** Voice or text dump → AI cleans it up → Short task list with dopamine rewards → Logged history you can look back on.

---

## 2. The Problem

When you have ADHD and feel overwhelmed:

- Your brain is full of "things to do" but they're tangled and vague
- Writing out detailed task lists feels exhausting and causes more scatter
- You finish things but have no record, so it feels like you accomplished nothing
- Typical productivity apps are either too complex or too sterile to engage with

---

## 3. The Solution

A **low-friction, calming tool** that:

1. Accepts messy brain dumps (voice or text)
2. Uses AI to gently clean them into 1–5 actionable tasks
3. Makes completing tasks feel rewarding
4. Keeps a searchable history so you can prove to yourself what you've done
5. Offers an escape hatch: "Help me with this task" → generates a prompt you can use with any AI

---

## 4. What "Done" Looks Like (MVP)

A user can:

- [ ] Open the app and immediately start a voice recording or text dump
- [ ] See their messy input transformed into 1–5 clean, numbered tasks
- [ ] Check off tasks with satisfying visual/audio feedback
- [ ] View a history log of completed tasks, organized by date
- [ ] Search past tasks by keyword or auto-generated tag
- [ ] Export history as markdown
- [ ] Click "Help me" on any task to generate a contextual AI prompt

---

## 5. Features (MVP Scope)

### 5.1 Input: Brain Dump

| Capability | Details |
|------------|---------|
| Text input | Paste or type a messy paragraph of thoughts |
| Voice input | Press a button, dictate, release to submit |
| No formatting required | User just dumps; AI does the parsing |

### 5.2 Output: Task List

| Capability | Details |
|------------|---------|
| 1–5 tasks max | Enforced limit to prevent overwhelm |
| Numbered list | Simple, scannable |
| Visual polish | Color accents, emoji per task, rounded cards |
| Reorderable | Drag to reprioritize (nice-to-have for MVP) |

### 5.3 AI Processing (Light Touch)

| Capability | Details |
|------------|---------|
| Parse dump | Split messy input into discrete tasks |
| Clean up | Fix grammar, clarify vague phrasing |
| Add emoji | Contextual emoji per task type |
| Auto-tag | Generate 1–3 topic tags per task (for history) |
| No questions | AI doesn't ask clarifying questions; just does its best |

### 5.4 Task Completion (Dopamine Hits)

| Capability | Details |
|------------|---------|
| Check off | Click/tap to mark complete |
| Animation | Satisfying visual feedback (checkmark burst, strikethrough swoosh, subtle confetti) |
| Sound | Optional completion sound (soft chime) |
| Progress indicator | "3/5 done" or progress bar |
| Celebration | Brief message on sprint completion ("Nice sprint! 5/5 done.") |

### 5.5 History & Record Keeping

| Capability | Details |
|------------|---------|
| Log view | Scrollable list by date ("Friday Jan 31: ✓ task, ✓ task") |
| Auto-tags | AI-generated topic tags, curated over time |
| Search | Find past tasks by keyword or tag |
| Export | Download history as markdown file |
| Persistence | Stored locally on device |

### 5.6 "Help Me" Prompt Generator

| Capability | Details |
|------------|---------|
| Per-task button | Each task has a "🪄 Help me" option |
| Context-aware | AI analyzes task type (coding, writing, research, admin, etc.) |
| Output | Generates a ready-to-copy prompt tailored to that task |
| Use anywhere | User copies prompt to Claude, ChatGPT, Gemini, etc. |

---

## 6. Non-Goals (Explicitly Out of Scope for MVP)

| What | Why Not |
|------|---------|
| Cloud sync | Adds complexity; local-first is simpler and more private |
| Collaboration / sharing | This is a personal focus tool |
| Calendar integration | Future feature; MVP stays standalone |
| Pomodoro timer | Tempting, but scope creep—maybe v2 |
| Mobile app | Desktop only for MVP; Tauri can support mobile later |
| Multiple sprints at once | One active sprint at a time keeps it focused |
| Heavy AI processing | No clarifying questions, no breaking tasks into subtasks automatically |
| Offline voice transcription | Will use system/browser speech-to-text or online API for MVP |

---

## 7. Technical Architecture

### 7.1 Stack

| Layer | Technology |
|-------|------------|
| Framework | **Tauri** (Rust backend + web frontend) |
| Frontend | React + TypeScript |
| Styling | Tailwind CSS (easy to achieve Calm/Headspace aesthetic) |
| AI | Gemini API (free tier: Gemini 1.5 Flash) |
| Voice input | Web Speech API (built into browser/webview) |
| Local storage | SQLite via Tauri's built-in fs/database plugins |
| Platforms | macOS, Windows (Linux possible but not prioritized) |

### 7.2 Data Model (Simplified)

```
Sprint
├── id: uuid
├── created_at: timestamp
├── status: "active" | "completed" | "abandoned"
├── raw_input: string (original brain dump)
└── tasks: Task[]

Task
├── id: uuid
├── sprint_id: uuid
├── title: string
├── emoji: string
├── tags: string[]
├── status: "pending" | "completed"
├── completed_at: timestamp | null
└── generated_prompt: string | null

Settings
├── sound_enabled: boolean
├── theme: "light" | "dark" | "system"
└── export_path: string (default export location)
```

### 7.3 AI Integration

**Endpoint:** Gemini 1.5 Flash (free tier)

**Use cases:**
1. **Parse brain dump** → Returns JSON array of tasks with titles, emojis, tags
2. **Generate help prompt** → Takes task context, returns tailored prompt string

**Rate limits (free tier):** 15 requests/minute, 1M tokens/day — more than sufficient for personal use.

---

## 8. Design Direction

**Inspiration:** Headspace, Calm

### 8.1 Visual Principles

| Principle | Implementation |
|-----------|----------------|
| Soft gradients | Background uses gentle color transitions (lavender → soft blue, peach → warm white) |
| Generous spacing | Lots of whitespace; nothing feels cramped |
| Rounded shapes | Border radius on everything (cards, buttons, inputs) |
| Calm color palette | Muted pastels, soft greens, warm neutrals; no harsh primary colors |
| Gentle animations | Slow eases, nothing jarring; completion animations are satisfying but not hyperactive |

### 8.2 Microcopy Tone

- Friendly, calm, supportive
- No corporate productivity speak
- Examples:
  - "What's on your mind?" (not "Enter tasks")
  - "Nice. One down." (not "Task completed!")
  - "That's a wrap. 5 for 5." (not "Sprint complete: 100%")

### 8.3 Typography

- Clean sans-serif (Inter, SF Pro, or similar)
- Generous line height
- Limited font weights (regular + medium only)

---

## 9. User Flow (MVP)

```
┌─────────────────────────────────────────────────────────────┐
│                        APP OPENS                            │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                                                     │   │
│   │         "What do you need to get done?"             │   │
│   │                                                     │   │
│   │    ┌─────────────────────────────────────────┐      │   │
│   │    │                                         │      │   │
│   │    │      [Text area for brain dump]         │      │   │
│   │    │                                         │      │   │
│   │    └─────────────────────────────────────────┘      │   │
│   │                                                     │   │
│   │         [🎤 Voice]          [✨ Make tasks]         │   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

                            ↓ AI processes

┌─────────────────────────────────────────────────────────────┐
│                     YOUR SPRINT                             │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  ○  1. 📧 Reply to Sarah's email        [🪄 Help]   │   │
│   └─────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  ○  2. 💻 Fix the login bug             [🪄 Help]   │   │
│   └─────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  ○  3. 📝 Draft intro for blog post     [🪄 Help]   │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│                      Progress: 0/3                          │
│                                                             │
│              [View History]    [New Sprint]                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘

                            ↓ User completes tasks

┌─────────────────────────────────────────────────────────────┐
│                     YOUR SPRINT                             │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  ✓  1. 📧 Reply to Sarah's email        ✓ Done      │   │
│   └─────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  ✓  2. 💻 Fix the login bug             ✓ Done      │   │
│   └─────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  ○  3. 📝 Draft intro for blog post     [🪄 Help]   │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│                 ████████████░░░░  2/3                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Open Questions / Future Considerations

| Question | Notes |
|----------|-------|
| **Tauri vs Electron** | Chose Tauri for lighter footprint. Re-evaluate if AI debugging becomes a bottleneck during development. |
| Voice transcription quality | Web Speech API may be inconsistent. May need to explore Whisper API or Deepgram later. |
| Tag management | Auto-generated tags might need manual cleanup. Consider "merge tags" or "rename tag" in v2. |
| Sprint abandonment | What happens if user starts a new sprint without completing the old one? Log as "abandoned"? |
| Keyboard shortcuts | Power users will want hotkeys (Cmd+N for new sprint, etc.). Add in v2. |
| Widget / menubar mode | Quick-capture from menubar without opening full app. v2 feature. |

---

## 11. Success Metrics (Personal)

Since this is a personal tool, success = actually using it. Gut-check questions:

- Do I reach for this when I'm overwhelmed, or avoid it?
- Does completing tasks feel good?
- Do I ever look back at my history and feel proud?
- Has it reduced my "what did I even do today?" anxiety?

---

## 12. Next Steps

1. ✅ **Spec** — You are here
2. ⬜ **Task Plan** — Ordered implementation steps
3. ⬜ **Execution Prompts** — Prompts for Claude Code to build each piece

---

*This spec is a living document. Update as decisions evolve.*
