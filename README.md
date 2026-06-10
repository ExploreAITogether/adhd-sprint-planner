# ADHD Sprint Planner

A calming desktop app that takes messy brain dumps and turns them into clear, manageable task sprints. Built with a Headspace/Calm aesthetic specifically for ADHD brains.

## How It Works

1. **Dump your thoughts** -- Type or speak whatever is on your mind
2. **AI parses tasks** -- Gemini extracts 1-5 clear, actionable tasks with emojis and tags
3. **Complete your sprint** -- Check off tasks with satisfying animations and sounds
4. **Track your history** -- See everything you've accomplished, searchable and exportable

## Features

- **Brain dump input** with voice recognition support
- **AI-powered task parsing** via Gemini 2.5 Flash (free tier)
- **Satisfying completion animations** -- check fills, bursts, strikethroughs, and celebration particles
- **Completion sounds** -- subtle audio chimes using Web Audio API
- **"Help Me" prompts** -- AI generates ready-to-paste prompts for any task
- **Sprint history** with search, tag filtering, and date grouping
- **Markdown export** -- save your history to `.md` files
- **Light / Dark / System themes** -- calm palettes that follow your OS preference
- **Settings** -- toggle sounds, pick theme, set default export location
- **Local-first storage** -- SQLite database, your data stays on your device
- **Cross-platform** -- macOS and Windows via Tauri

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri 2](https://tauri.app/) (Rust backend, web frontend) |
| Frontend | React 19 + TypeScript 5.9 |
| Styling | Tailwind CSS 4 + CSS custom properties |
| Build | Vite 7 |
| AI | [Gemini 2.5 Flash](https://ai.google.dev/) (free tier) |
| Database | SQLite via `tauri-plugin-sql` |
| Audio | Web Audio API |
| Voice | Web Speech API |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- Platform build tools:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++"
  - **Linux**: `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`
- A [Gemini API key](https://aistudio.google.com/apikey) (free)

### Setup

```bash
# Clone the repo
git clone https://github.com/ExploreAITogether/adhd-sprint-planner.git
cd adhd-sprint-planner

# Install dependencies
npm install

# Set up your API key
cp .env.example .env
# Edit .env and paste your Gemini API key

# Run in development
npm run tauri dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_GEMINI_API_KEY` | Your Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) |

`VITE_GEMINI_API_KEY` is embedded into production bundles by Vite at build time. Do not commit `.env`, and rebuild the app after changing or rotating the key.

## Building for Release

### GitHub Actions (recommended — builds both platforms)

The [Release workflow](.github/workflows/release.yml) builds installers for
**macOS** (universal binary: Apple Silicon + Intel) and **Windows** (.msi and
.exe) and attaches them to a draft GitHub Release.

**One-time setup:** add a repository secret named `GEMINI_API_KEY` containing
your Gemini API key (Settings → Secrets and variables → Actions). The key is
baked into the bundle at build time.

**To cut a release**, either:

```bash
# Option A: push a version tag
git tag v1.0.0
git push origin v1.0.0

# Option B: trigger manually
gh workflow run release.yml
```

Then publish the draft release from the GitHub Releases page and download the
installers:

- **macOS**: open the `.dmg`, drag the app to Applications. The build is
  unsigned, so the first launch needs right-click → Open (or
  `xattr -cr "/Applications/ADHD Sprint Planner.app"`).
- **Windows**: run the `.exe` (NSIS) installer. If SmartScreen appears,
  click "More info" → "Run anyway".

> Bumping the version: update `version` in `package.json`,
> `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`, then tag to match.

### Local build — macOS

```bash
npm run tauri build
```

Outputs:
- `.app` bundle in `src-tauri/target/release/bundle/macos/`
- `.dmg` installer in `src-tauri/target/release/bundle/dmg/`

### Local build — Windows

```bash
npm run tauri build
```

Outputs:
- `.exe` in `src-tauri/target/release/`
- `.msi` installer in `src-tauri/target/release/bundle/msi/`
- NSIS installer in `src-tauri/target/release/bundle/nsis/`

### Code Signing (Optional)

For distribution outside personal use:

- **macOS**: Requires an Apple Developer account ($99/year) for notarization. Set `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` environment variables. See [Tauri macOS signing docs](https://tauri.app/distribute/sign/macos/).
- **Windows**: Requires a code signing certificate. Set the `TAURI_SIGNING_PRIVATE_KEY` environment variable. See [Tauri Windows signing docs](https://tauri.app/distribute/sign/windows/).

## Project Structure

```
src/                        # React frontend
  components/
    LandingScreen.tsx       # Brain dump input
    SprintView.tsx          # Active sprint with task cards
    TaskCard.tsx            # Individual task with animations
    HistoryView.tsx         # Past sprints with search & export
    HelpPromptModal.tsx     # AI prompt generator modal
    SettingsModal.tsx       # Settings panel
    ErrorBoundary.tsx       # Global error handler
  contexts/
    ThemeContext.tsx         # Light/dark/system theme provider
  hooks/
    useSpeechRecognition.ts # Voice input hook
  lib/
    database.ts             # SQLite operations
    gemini.ts               # Gemini API integration
    promptGenerator.ts      # Help prompt generation
    sounds.ts               # Web Audio sound effects
  types/
    index.ts                # TypeScript interfaces
  App.tsx                   # Main app with view routing
  index.css                 # Theme variables & animations

src-tauri/                  # Rust backend
  src/
    lib.rs                  # Tauri plugin initialization
    main.rs                 # Entry point
  capabilities/
    default.json            # Security permissions
  tauri.conf.json           # App configuration
  Cargo.toml                # Rust dependencies
```

## Testing Checklist

- [ ] App launches without errors
- [ ] Text brain dump creates tasks correctly
- [ ] Voice input works (Chrome/Edge)
- [ ] Tasks check off with animations and sounds
- [ ] Progress bar and celebration on sprint completion
- [ ] History view loads and displays grouped by date
- [ ] Search filters by title and `#tag` syntax
- [ ] Markdown export creates valid file
- [ ] Help prompts generate and cache correctly
- [ ] Settings persist across app restart
- [ ] Theme switching (light/dark/system) works
- [ ] Window resizing down to 400px minimum width
- [ ] Error boundary catches unexpected crashes
- [ ] Offline: history viewable, AI shows connection error
- [ ] API rate limit shows friendly message

## Data Storage

All data is stored locally in a SQLite database:
- **macOS**: `~/Library/Application Support/com.adhd-sprint-planner.app/adhd-sprint-planner.db`
- **Windows**: `%APPDATA%/com.adhd-sprint-planner.app/adhd-sprint-planner.db`
- **Linux**: `~/.local/share/com.adhd-sprint-planner.app/adhd-sprint-planner.db`

No data is sent to any server except the Gemini API for task parsing and prompt generation.

## Future Ideas

- Recurring/template sprints
- Drag-and-drop task reordering
- Pomodoro timer integration
- Task time estimates and tracking
- Multiple sprint queues
- Cloud sync (optional, opt-in)
- Mobile companion app
- Custom sound packs
- Focus mode with ambient sounds

## License

MIT
