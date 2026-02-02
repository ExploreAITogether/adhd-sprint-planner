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
  position: number;
}

export interface Settings {
  sound_enabled: boolean;
  theme: 'light' | 'dark' | 'system';
  export_path: string;
}

export interface DayTheme {
  id: string;
  day_of_week: number;  // 1-7, Monday=1
  name: string;
  emoji: string;
}

export interface WeekDay {
  dayOfWeek: number;        // 1-7
  label: string;            // "M", "T", "W", etc.
  date: Date;               // Actual date for this week
  theme: DayTheme | null;   // null = open day
  isToday: boolean;
  hasCompletedTasks: boolean;  // Derived from sprint history
}
