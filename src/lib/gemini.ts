import type { Task } from '../types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key || key === 'your_gemini_api_key_here') {
    throw new Error(
      'Gemini API key not configured. Set VITE_GEMINI_API_KEY in your .env file.'
    );
  }
  return key;
}

const SYSTEM_PROMPT = `You are a helpful task parser for an ADHD-friendly sprint planner app. Your job is to take messy, stream-of-consciousness brain dumps and extract clear, actionable tasks.

Rules:
- Extract 1 to 5 discrete, actionable tasks. Never more than 5.
- If the input contains more than 5 tasks, prioritize the most actionable and urgent ones.
- Clean up grammar and clarify vague phrasing. Make each task specific and actionable.
- Keep task titles concise but clear — ideally under 60 characters.
- Add a single contextual emoji at the start that represents the task's nature.
- Generate 1 to 3 topic tags per task. Tags should be lowercase single words like "email", "coding", "health", "finance", "errands".
- If input is vague, make reasonable assumptions rather than asking questions.
- Be a helpful assistant, not robotic. Task titles should feel natural.

You MUST respond with valid JSON only, no markdown, no explanation. Use this exact format:

{
  "tasks": [
    {
      "title": "Reply to Sarah's email about the project timeline",
      "emoji": "📧",
      "tags": ["email", "work", "communication"]
    }
  ]
}

If the input doesn't contain anything that can be turned into tasks, return:
{"tasks": []}`;

interface GeminiTaskResult {
  title: string;
  emoji: string;
  tags: string[];
}

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
  error?: {
    message?: string;
  };
}

function parseGeminiResponse(responseText: string): GeminiTaskResult[] {
  // Strip markdown code fences if the model wraps its response
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
    throw new Error('Response missing "tasks" array');
  }

  // Validate and sanitize each task
  return parsed.tasks
    .filter(
      (t: unknown): t is GeminiTaskResult =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as GeminiTaskResult).title === 'string' &&
        (t as GeminiTaskResult).title.length > 0
    )
    .slice(0, 5)
    .map((t: GeminiTaskResult) => ({
      title: t.title.slice(0, 100),
      emoji: t.emoji || '📝',
      tags: Array.isArray(t.tags)
        ? t.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 3)
        : [],
    }));
}

export async function parseBrainDump(text: string): Promise<Omit<Task, 'id' | 'sprint_id' | 'position'>[]> {
  const apiKey = getApiKey();

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        parts: [
          {
            text: `Here is my brain dump. Parse it into tasks:\n\n${text}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error("That took too long. Let's try again.");
    }
    throw new Error("Couldn't connect to AI. Check your internet and try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');

    if (response.status === 429) {
      throw new Error('Slow down! Take a breath and try again in a minute.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("There's an issue with the AI setup. Check your API key in the .env file.");
    }
    throw new Error(`Something went wrong with the AI (${response.status}). ${errorBody.slice(0, 100)}`);
  }

  const data: GeminiResponse = await response.json();

  if (data.error) {
    throw new Error(`Gemini error: ${data.error.message || 'Unknown error'}`);
  }

  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error('Empty response from Gemini. Please try again.');
  }

  let tasks: GeminiTaskResult[];
  try {
    tasks = parseGeminiResponse(responseText);
  } catch {
    console.error('Failed to parse Gemini response:', responseText);
    throw new Error('Could not parse AI response. Please try again.');
  }

  if (tasks.length === 0) {
    return [];
  }

  return tasks.map((t) => ({
    title: t.title,
    emoji: t.emoji,
    tags: t.tags,
    status: 'pending' as const,
    completed_at: null,
    generated_prompt: null,
  }));
}
