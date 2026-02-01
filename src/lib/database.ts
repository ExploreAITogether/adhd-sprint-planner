import Database from '@tauri-apps/plugin-sql';
import { v4 as uuidv4 } from 'uuid';
import type { Sprint, Task, Settings } from '../types';

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

  // Migration: add position column to tasks if not present
  try {
    await database.execute(
      'ALTER TABLE tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0'
    );
    // Set initial positions for existing tasks based on rowid order
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

function mapTaskRow(row: TaskRow): Task {
  return {
    ...row,
    status: row.status as Task['status'],
    tags: JSON.parse(row.tags),
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

export async function getActiveSprint(): Promise<Sprint | null> {
  const database = await getDb();

  const sprints = await database.select<
    { id: string; created_at: string; status: string; raw_input: string }[]
  >('SELECT * FROM sprints WHERE status = $1 ORDER BY created_at DESC LIMIT 1', ['active']);

  if (sprints.length === 0) return null;

  const sprint = sprints[0];
  const tasks = await database.select<TaskRow[]>(
    'SELECT * FROM tasks WHERE sprint_id = $1 ORDER BY position ASC',
    [sprint.id]
  );

  return {
    ...sprint,
    status: sprint.status as Sprint['status'],
    tasks: tasks.map(mapTaskRow),
  };
}

export async function getSprintById(id: string): Promise<Sprint | null> {
  const database = await getDb();

  const sprints = await database.select<
    { id: string; created_at: string; status: string; raw_input: string }[]
  >('SELECT * FROM sprints WHERE id = $1', [id]);

  if (sprints.length === 0) return null;

  const sprint = sprints[0];
  const tasks = await database.select<TaskRow[]>(
    'SELECT * FROM tasks WHERE sprint_id = $1 ORDER BY position ASC',
    [sprint.id]
  );

  return {
    ...sprint,
    status: sprint.status as Sprint['status'],
    tasks: tasks.map(mapTaskRow),
  };
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

export async function updateTaskPositions(
  taskPositions: { id: string; position: number }[]
): Promise<void> {
  const database = await getDb();
  for (const { id, position } of taskPositions) {
    await database.execute('UPDATE tasks SET position = $1 WHERE id = $2', [position, id]);
  }
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

export async function getSprintHistory(): Promise<Sprint[]> {
  const database = await getDb();

  const sprints = await database.select<
    { id: string; created_at: string; status: string; raw_input: string }[]
  >('SELECT * FROM sprints ORDER BY created_at DESC');

  const result: Sprint[] = [];
  for (const sprint of sprints) {
    const tasks = await database.select<TaskRow[]>(
      'SELECT * FROM tasks WHERE sprint_id = $1 ORDER BY position ASC',
      [sprint.id]
    );

    result.push({
      ...sprint,
      status: sprint.status as Sprint['status'],
      tasks: tasks.map(mapTaskRow),
    });
  }

  return result;
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
    theme: row.theme as Settings['theme'],
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
