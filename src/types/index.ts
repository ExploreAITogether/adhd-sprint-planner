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
