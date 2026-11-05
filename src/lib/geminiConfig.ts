import { getSettings } from './database';

export const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/** Where users create a free Gemini API key. Linked from Settings and the first-run notice. */
export const GEMINI_KEY_URL = 'https://aistudio.google.com/apikey';

/** Setup guide links; each URL is explicitly allowed in the Tauri opener scope. */
export const GOOGLE_BILLING_URL = 'https://console.cloud.google.com/billing';
export const GOOGLE_BILLING_HELP_URL = 'https://docs.cloud.google.com/billing/docs/how-to/modify-project';

export const MISSING_API_KEY_MESSAGE =
  'Add your free Gemini API key in Settings to turn brain dumps into tasks.';

export const INVALID_API_KEY_MESSAGE =
  "Gemini didn't accept your API key. Double-check it in Settings.";

/** Thrown when an AI feature is used before a key has been saved in Settings. */
export class MissingApiKeyError extends Error {
  constructor() {
    super(MISSING_API_KEY_MESSAGE);
    this.name = 'MissingApiKeyError';
  }
}

/**
 * Read the user's Gemini API key from local settings (bring-your-own-key).
 * The key is never baked into the bundle; it lives only in the app's SQLite
 * database on the user's machine.
 */
export async function getApiKey(): Promise<string> {
  const settings = await getSettings();
  const key = settings.api_key?.trim();
  if (!key) {
    throw new MissingApiKeyError();
  }
  return key;
}

/** True when a non-empty key is saved in Settings. */
export async function hasApiKey(): Promise<boolean> {
  try {
    const settings = await getSettings();
    return Boolean(settings.api_key?.trim());
  } catch {
    return false;
  }
}

/**
 * Request headers for Gemini calls. The key goes in a header rather than a
 * `?key=` query parameter so it never lands in URL logs.
 */
export function geminiHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };
}

export interface GeminiResponse {
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
