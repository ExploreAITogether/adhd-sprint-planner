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

export const GEMINI_BUSY_MESSAGE =
  "Gemini is overloaded right now. That's on Google's side, not yours. Give it a minute and try again.";

export const GEMINI_RATE_LIMIT_MESSAGE =
  "You've hit Gemini's free-tier limit for now. Wait a minute and try again. If it keeps happening, today's free quota may be used up.";

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

export type GeminiErrorKind = 'timeout' | 'network' | 'busy' | 'rate-limit' | 'invalid-key' | 'http';

/** A failed Gemini call, with a user-facing message and a kind callers can branch on. */
export class GeminiRequestError extends Error {
  readonly kind: GeminiErrorKind;
  readonly status?: number;

  constructor(kind: GeminiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'GeminiRequestError';
    this.kind = kind;
    this.status = status;
  }
}

// Gemini returns 503 ("model is overloaded") and other 5xx errors in short
// bursts, especially on the free tier. These usually clear within seconds, so
// retry them a couple of times before bothering the user. 429 is a quota
// limit, so retrying straight away wouldn't help.
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1_500, 4_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function postOnce(apiKey: string, body: unknown, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: geminiHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new GeminiRequestError('timeout', "That took too long. Let's try again.");
    }
    throw new GeminiRequestError('network', "Couldn't connect to AI. Check your internet and try again.");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * POST a generateContent request with the saved key, retrying transient
 * server errors. Throws MissingApiKeyError or GeminiRequestError, whose
 * message is safe to show the user as-is.
 */
export async function requestGemini(body: unknown, timeoutMs: number): Promise<GeminiResponse> {
  const apiKey = await getApiKey();

  for (let attempt = 0; ; attempt++) {
    const response = await postOnce(apiKey, body, timeoutMs);

    if (response.ok) {
      return (await response.json()) as GeminiResponse;
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }

    const errorBody = await response.text().catch(() => '');
    console.error(`Gemini request failed (${response.status}):`, errorBody);

    if (response.status === 401 || response.status === 403) {
      throw new GeminiRequestError('invalid-key', INVALID_API_KEY_MESSAGE, response.status);
    }
    if (response.status === 429) {
      throw new GeminiRequestError('rate-limit', GEMINI_RATE_LIMIT_MESSAGE, response.status);
    }
    if (RETRYABLE_STATUSES.has(response.status)) {
      throw new GeminiRequestError('busy', GEMINI_BUSY_MESSAGE, response.status);
    }
    throw new GeminiRequestError(
      'http',
      `Something went wrong with the AI (error ${response.status}). Please try again.`,
      response.status
    );
  }
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
