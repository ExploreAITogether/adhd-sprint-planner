import Database from '@tauri-apps/plugin-sql';
import { v4 as uuidv4 } from 'uuid';
import type { Sprint, Task, Settings, DayTheme, WeekDay } from '../types';

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:adhd-sprint-planner.db');
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = await getDb();

  await database.execute(`
    CREATE TABLE IF NOT EXISTS sprints (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      raw_input TEXT NOT NULL
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      sprint_id TEXT NOT NULL,
      title TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at TEXT,
      generated_prompt TEXT,
      FOREIGN KEY (sprint_id) REFERENCES sprints(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      sound_enabled INTEGER NOT NULL DEFAULT 1,
      theme TEXT NOT NULL DEFAULT 'system',
      export_path TEXT NOT NULL DEFAULT ''
    )
  `);

  // Insert default settings if they don't exist
  await database.execute(`
    INSERT OR IGNORE INTO settings (id, sound_enabled, theme, export_path)
    VALUES (1, 1, 'system', '')
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS day_themes (
      id TEXT PRIMARY KEY,
      day_of_week INTEGER NOT NULL,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      UNIQUE(day_of_week)
    )
  `);

  // Migration: add position column to tasks if not present
  try {
    await database.execute(
      'ALTER TABLE tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0'
    );
    // Backfill positions for pre-existing tasks: assign sequential indices
    // per sprint so each sprint's tasks get independent 0-based ordering.
    const existingTasks = await database.select<{ id: string; sprint_id: string }[]>(
      'SELECT id, sprint_id FROM tasks ORDER BY rowid'
    );
    const sprintPositions = new Map<string, number>();
    for (const task of existingTasks) {
      const pos = sprintPositions.get(task.sprint_id) ?? 0;
      await database.execute('UPDATE tasks SET position = $1 WHERE id = $2', [pos, task.id]);
      sprintPositions.set(task.sprint_id, pos + 1);
    }
  } catch {
    // Column already exists, ignore
  }
}

interface TaskRow {
  id: string;
  sprint_id: string;
  title: string;
  emoji: string;
  tags: string;
  status: string;
  completed_at: string | null;
  generated_prompt: string | null;
  position: number;
}

interface SprintRow {
  id: string;
  created_at: string;
  status: string;
  raw_input: string;
}

const VALID_TASK_STATUSES: ReadonlySet<Task['status']> = new Set(['pending', 'completed']);
const VALID_SPRINT_STATUSES: ReadonlySet<Sprint['status']> = new Set(['active', 'completed', 'abandoned']);
const VALID_THEMES: ReadonlySet<Settings['theme']> = new Set(['light', 'dark', 'system']);

function parseTaskStatus(status: string): Task['status'] {
  if (VALID_TASK_STATUSES.has(status as Task['status'])) {
    return status as Task['status'];
  }
  return 'pending';
}

function parseSprintStatus(status: string): Sprint['status'] {
  if (VALID_SPRINT_STATUSES.has(status as Sprint['status'])) {
    return status as Sprint['status'];
  }
  return 'active';
}

function parseTheme(theme: string): Settings['theme'] {
  if (VALID_THEMES.has(theme as Settings['theme'])) {
    return theme as Settings['theme'];
  }
  return 'system';
}

function parseTags(tagsJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(tagsJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

function mapTaskRow(row: TaskRow): Task {
  return {
    ...row,
    status: parseTaskStatus(row.status),
    tags: parseTags(row.tags),
  };
}

export async function createSprint(rawInput: string): Promise<Sprint> {
  const database = await getDb();
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  await database.execute(
    'INSERT INTO sprints (id, created_at, status, raw_input) VALUES ($1, $2, $3, $4)',
    [id, createdAt, 'active', rawInput]
  );

  return {
    id,
    created_at: createdAt,
    status: 'active',
    raw_input: rawInput,
    tasks: [],
  };
}

/** Fetch a sprint's tasks and assemble the full Sprint object. */
async function loadSprintWithTasks(database: Database, row: SprintRow): Promise<Sprint> {
  const tasks = await database.select<TaskRow[]>(
    'SELECT * FROM tasks WHERE sprint_id = $1 ORDER BY position ASC',
    [row.id]
  );

  return {
    ...row,
    status: parseSprintStatus(row.status),
    tasks: tasks.map(mapTaskRow),
  };
}

export async function getActiveSprint(): Promise<Sprint | null> {
  const database = await getDb();

  const sprints = await database.select<SprintRow[]>(
    'SELECT * FROM sprints WHERE status = $1 ORDER BY created_at DESC LIMIT 1', ['active']
  );

  if (sprints.length === 0) return null;
  return loadSprintWithTasks(database, sprints[0]);
}

export async function getSprintById(id: string): Promise<Sprint | null> {
  const database = await getDb();

  const sprints = await database.select<SprintRow[]>(
    'SELECT * FROM sprints WHERE id = $1', [id]
  );

  if (sprints.length === 0) return null;
  return loadSprintWithTasks(database, sprints[0]);
}

export async function updateSprintStatus(
  id: string,
  status: Sprint['status']
): Promise<void> {
  const database = await getDb();
  await database.execute('UPDATE sprints SET status = $1 WHERE id = $2', [status, id]);
}

export async function addTask(
  sprintId: string,
  task: Omit<Task, 'id' | 'sprint_id' | 'position'>,
  position: number = 0
): Promise<Task> {
  const database = await getDb();
  const id = uuidv4();

  await database.execute(
    `INSERT INTO tasks (id, sprint_id, title, emoji, tags, status, completed_at, generated_prompt, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      sprintId,
      task.title,
      task.emoji,
      JSON.stringify(task.tags),
      task.status,
      task.completed_at,
      task.generated_prompt,
      position,
    ]
  );

  return { id, sprint_id: sprintId, position, ...task };
}

export async function updateTaskStatus(
  id: string,
  status: Task['status'],
  completedAt?: string
): Promise<void> {
  const database = await getDb();
  console.log('[DB] updateTaskStatus:', { id, status, completedAt: completedAt ?? null });
  await database.execute(
    'UPDATE tasks SET status = $1, completed_at = $2 WHERE id = $3',
    [status, completedAt ?? null, id]
  );
  console.log('[DB] updateTaskStatus: write confirmed for task', id);
}

export async function updateTaskTitle(
  id: string,
  title: string
): Promise<void> {
  const database = await getDb();
  await database.execute('UPDATE tasks SET title = $1 WHERE id = $2', [title, id]);
}

export async function deleteTask(id: string): Promise<void> {
  const database = await getDb();
  await database.execute('DELETE FROM tasks WHERE id = $1', [id]);
}

export async function restoreTask(task: Task): Promise<void> {
  const database = await getDb();
  await database.execute(
    `INSERT INTO tasks (id, sprint_id, title, emoji, tags, status, completed_at, generated_prompt, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      task.id,
      task.sprint_id,
      task.title,
      task.emoji,
      JSON.stringify(task.tags),
      task.status,
      task.completed_at,
      task.generated_prompt,
      task.position,
    ]
  );
}

async function writeTaskPositions(
  taskPositions: { id: string; position: number }[]
): Promise<void> {
  const database = await getDb();
  for (const { id, position } of taskPositions) {
    await database.execute('UPDATE tasks SET position = $1 WHERE id = $2', [position, id]);
  }
}

// Debounced position writer: drag-and-drop fires rapid reorder events, so we
// batch them into a single DB write after 300ms of inactivity. Each call
// replaces any pending positions (only the latest order matters) and collects
// promise resolvers so every caller gets notified when the write completes.
let positionDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPositions: { id: string; position: number }[] | null = null;
let positionResolvers: { resolve: () => void; reject: (err: unknown) => void }[] = [];

export function updateTaskPositions(
  taskPositions: { id: string; position: number }[]
): Promise<void> {
  pendingPositions = taskPositions;

  return new Promise<void>((resolve, reject) => {
    positionResolvers.push({ resolve, reject });

    if (positionDebounceTimer) clearTimeout(positionDebounceTimer);

    positionDebounceTimer = setTimeout(() => {
      const positions = pendingPositions!;
      const resolvers = positionResolvers;
      pendingPositions = null;
      positionResolvers = [];
      positionDebounceTimer = null;

      writeTaskPositions(positions).then(
        () => resolvers.forEach((r) => r.resolve()),
        (err) => resolvers.forEach((r) => r.reject(err))
      );
    }, 300);
  });
}

export async function updateTaskPrompt(
  id: string,
  generatedPrompt: string
): Promise<void> {
  const database = await getDb();
  await database.execute(
    'UPDATE tasks SET generated_prompt = $1 WHERE id = $2',
    [generatedPrompt, id]
  );
}

export async function getSprintHistory(
  limit: number = 50,
  offset: number = 0
): Promise<{ sprints: Sprint[]; hasMore: boolean }> {
  const database = await getDb();

  // Fetch one extra to determine if there are more pages
  const sprints = await database.select<SprintRow[]>(
    'SELECT * FROM sprints ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit + 1, offset]
  );

  const hasMore = sprints.length > limit;
  const page = hasMore ? sprints.slice(0, limit) : sprints;

  const result: Sprint[] = [];
  for (const sprint of page) {
    result.push(await loadSprintWithTasks(database, sprint));
  }

  return { sprints: result, hasMore };
}

export async function getSettings(): Promise<Settings> {
  const database = await getDb();

  const rows = await database.select<
    { sound_enabled: number; theme: string; export_path: string }[]
  >('SELECT * FROM settings WHERE id = 1');

  if (rows.length === 0) {
    return { sound_enabled: true, theme: 'system', export_path: '' };
  }

  const row = rows[0];
  return {
    sound_enabled: row.sound_enabled === 1,
    theme: parseTheme(row.theme),
    export_path: row.export_path,
  };
}

export async function updateSettings(
  settings: Partial<Settings>
): Promise<void> {
  const database = await getDb();

  const updates: string[] = [];
  const values: (string | number)[] = [];
  let paramIndex = 1;

  if (settings.sound_enabled !== undefined) {
    updates.push(`sound_enabled = $${paramIndex++}`);
    values.push(settings.sound_enabled ? 1 : 0);
  }
  if (settings.theme !== undefined) {
    updates.push(`theme = $${paramIndex++}`);
    values.push(settings.theme);
  }
  if (settings.export_path !== undefined) {
    updates.push(`export_path = $${paramIndex++}`);
    values.push(settings.export_path);
  }

  if (updates.length > 0) {
    await database.execute(
      `UPDATE settings SET ${updates.join(', ')} WHERE id = 1`,
      values
    );
  }
}

// ── Day Themes ──

export async function getDayThemes(): Promise<(DayTheme | null)[]> {
  const database = await getDb();

  const rows = await database.select<DayTheme[]>(
    'SELECT * FROM day_themes ORDER BY day_of_week ASC'
  );

  const themesByDay = new Map<number, DayTheme>();
  for (const row of rows) {
    themesByDay.set(row.day_of_week, row);
  }

  // Return array of 7 entries (index 0 = Monday/day 1, index 6 = Sunday/day 7)
  return Array.from({ length: 7 }, (_, i) => themesByDay.get(i + 1) ?? null);
}

export async function getDayTheme(dayOfWeek: number): Promise<DayTheme | null> {
  const database = await getDb();

  const rows = await database.select<DayTheme[]>(
    'SELECT * FROM day_themes WHERE day_of_week = $1',
    [dayOfWeek]
  );

  return rows.length > 0 ? rows[0] : null;
}

export async function setDayTheme(
  dayOfWeek: number,
  name: string,
  emoji: string
): Promise<DayTheme> {
  const database = await getDb();
  const id = uuidv4();

  // Upsert: replace if day_of_week already exists (UNIQUE constraint)
  await database.execute(
    `INSERT INTO day_themes (id, day_of_week, name, emoji)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(day_of_week) DO UPDATE SET name = $3, emoji = $4, id = $1`,
    [id, dayOfWeek, name, emoji]
  );

  return { id, day_of_week: dayOfWeek, name, emoji };
}

export async function clearDayTheme(dayOfWeek: number): Promise<void> {
  const database = await getDb();
  await database.execute(
    'DELETE FROM day_themes WHERE day_of_week = $1',
    [dayOfWeek]
  );
}

// ── Week Days Helper ──

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Format a Date as YYYY-MM-DD for date-only comparisons. */
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getWeekDays(): Promise<WeekDay[]> {
  const today = new Date();
  // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat. We need Monday-based offsets
  // (Mon=0 .. Sun=6) so Sunday (0) maps to offset 6, and all others shift by -1.
  const jsDay = today.getDay();
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;

  // Calculate Monday of the current week
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() - mondayOffset);

  const themes = await getDayThemes();

  // Week boundaries for the completed-tasks query: [monday 00:00, next-monday 00:00).
  // Using ISO strings works for range comparison because they sort lexicographically.
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  const mondayISO = monday.toISOString();
  const sundayISO = sunday.toISOString();

  // Query only tasks completed within this week
  const database = await getDb();
  const completedTasks = await database.select<{ completed_at: string }[]>(
    "SELECT completed_at FROM tasks WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at >= $1 AND completed_at < $2",
    [mondayISO, sundayISO]
  );

  // Build a set of date strings (YYYY-MM-DD) that have completed tasks
  const completedDates = new Set<string>();
  for (const task of completedTasks) {
    completedDates.add(toDateKey(new Date(task.completed_at)));
  }

  const todayStr = toDateKey(today);

  const weekDays: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateKey = toDateKey(date);

    weekDays.push({
      dayOfWeek: i + 1,     // 1=Monday, 7=Sunday
      label: DAY_LABELS[i],
      date,
      theme: themes[i],
      isToday: dateKey === todayStr,
      hasCompletedTasks: completedDates.has(dateKey),
    });
  }

  return weekDays;
}
