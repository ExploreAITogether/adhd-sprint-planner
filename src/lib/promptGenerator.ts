import type { Task } from '../types';
import { GEMINI_API_URL, INVALID_API_KEY_MESSAGE, geminiHeaders, getApiKey } from './geminiConfig';
import type { GeminiResponse } from './geminiConfig';

const META_PROMPT = `You are a helpful AI prompt engineer. Given a task from an ADHD-friendly sprint planner, generate a ready-to-use prompt that the user can paste into any AI assistant (like Claude, ChatGPT, etc.) to get help completing the task.

Instructions:
1. Identify the task type (coding, writing, research, admin, communication, creative, planning, health, errands, etc.)
2. Generate a specific, actionable prompt tailored to that task type
3. Include [bracketed placeholders] where the user should fill in specific details
4. The prompt should be conversational and natural — not robotic
5. Keep it concise but thorough enough to get good AI assistance
6. Structure the prompt so the AI assistant knows exactly what to do

You MUST respond with ONLY the generated prompt text. No JSON, no markdown fences, no explanation — just the prompt itself.

Examples:

Task: "Fix the login bug in the dashboard"
Prompt: I need to debug a login issue in my web dashboard. The bug is [describe what happens — e.g., redirect loop, wrong error message, session not persisting]. My tech stack is [e.g., React + Node.js + PostgreSQL]. Here's the relevant code:

[paste the login-related code here]

Help me identify the root cause and walk me through fixing it step by step.

Task: "Write the intro for my blog post about AI tools"
Prompt: Help me write an engaging introduction for a blog post about AI tools. Here's the context:
- Target audience: [e.g., developers, small business owners, students]
- Tone: [casual/professional/conversational]
- The post will cover: [list 2-3 main topics]
- Desired length for the intro: [e.g., 2-3 paragraphs]

Give me 2-3 options to choose from, each with a different hook style.

Task: "Research competitors' pricing"
Prompt: Help me research and compare pricing strategies for [your product/service type]. I need to analyze [number] competitors in the [industry] space. For each competitor, I need:
- Pricing tiers and what's included
- Free tier limitations
- Enterprise/custom pricing info
- Any notable discounts or annual pricing

Create a comparison table and highlight where there might be gaps or opportunities for my product.`;

const FALLBACK_PROMPT = (title: string) =>
  `Help me with this task: "${title}". Break it down into clear, manageable steps and guide me through completing it. If you need more context, ask me specific questions first.`;

export async function generateHelpPrompt(task: Task): Promise<string> {
  // Throws MissingApiKeyError when no key is saved; the modal shows that message.
  const apiKey = await getApiKey();

  const tagsContext = task.tags.length > 0
    ? ` (tags: ${task.tags.join(', ')})`
    : '';

  const body = {
    system_instruction: {
      parts: [{ text: META_PROMPT }],
    },
    contents: [
      {
        parts: [
          {
            text: `Generate a helpful AI prompt for this task:\n\n${task.emoji} ${task.title}${tagsContext}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 512,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: geminiHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return FALLBACK_PROMPT(task.title);
    }
    return FALLBACK_PROMPT(task.title);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // A rejected key is something the user can fix, so surface it instead of
    // silently falling back to the generic prompt.
    if (response.status === 401 || response.status === 403) {
      throw new Error(INVALID_API_KEY_MESSAGE);
    }
    return FALLBACK_PROMPT(task.title);
  }

  const data: GeminiResponse = await response.json();

  if (data.error) {
    return FALLBACK_PROMPT(task.title);
  }

  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!responseText) {
    return FALLBACK_PROMPT(task.title);
  }

  // Strip markdown code fences if model wraps the response
  let cleaned = responseText;
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:\w+)?\s*/, '').replace(/\s*```$/, '');
  }

  return cleaned;
}
