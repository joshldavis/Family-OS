/**
 * AI service layer — provider-agnostic chat + structured calls.
 *
 * Goals:
 *  - One interface (`chat`, `structured`) for every feature (Briefing, Coach, Scan, …).
 *  - User can pick which model powers each feature in Settings.
 *  - Bring-your-own-key: users paste API keys in Settings; `.env` is dev fallback only.
 *
 * Security note: localStorage is XSS-readable. Acceptable for a self-hosted family app
 * where the user controls their own browser. NOT acceptable for a multi-tenant public
 * SaaS — that would require a backend key proxy.
 */

import { GoogleGenAI, Type } from '@google/genai';

// ─── Providers & models ──────────────────────────────────────────────────────

export type AIProvider = 'gemini' | 'claude';

/** Features that can have their own model preference. */
export type AIFeature = 'briefing' | 'coach' | 'scan' | 'chat' | 'insights';

/** Speed/cost vs. quality tiers, used by the simple Settings picker. */
export type AITier = 'fast' | 'balanced' | 'best';

export interface AIModel {
  id: string;                  // Stable identifier used in storage + API calls
  provider: AIProvider;
  displayName: string;         // Human label shown in Settings
  tier: AITier;
  /** Whether the model accepts images as input (needed for Magic Scan). */
  supportsVision: boolean;
  /** Whether the model reliably honors a JSON schema response. */
  supportsStructured: boolean;
  /** Rough relative cost — 1 = cheapest, 5 = priciest. UI hint only. */
  costHint: 1 | 2 | 3 | 4 | 5;
  /** One-line description for the picker. */
  description: string;
}

/**
 * Canonical model catalog. Update as providers release new models.
 * Each `id` must be unique across providers.
 */
export const AVAILABLE_MODELS: AIModel[] = [
  // Google Gemini
  {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    displayName: 'Gemini 2.0 Flash',
    tier: 'fast',
    supportsVision: true,
    supportsStructured: true,
    costHint: 1,
    description: 'Cheap and fast. Best for scans, briefings, and high-volume tasks.',
  },
  {
    id: 'gemini-2.5-pro',
    provider: 'gemini',
    displayName: 'Gemini 2.5 Pro',
    tier: 'best',
    supportsVision: true,
    supportsStructured: true,
    costHint: 3,
    description: 'Google\'s flagship. Strong reasoning, good for the Coach.',
  },
  // Anthropic Claude
  {
    id: 'claude-haiku-4-5-20251001',
    provider: 'claude',
    displayName: 'Claude Haiku 4.5',
    tier: 'fast',
    supportsVision: true,
    supportsStructured: true,
    costHint: 2,
    description: 'Anthropic\'s fast tier. Warmer prose than Gemini Flash.',
  },
  {
    id: 'claude-sonnet-4-6',
    provider: 'claude',
    displayName: 'Claude Sonnet 4.6',
    tier: 'balanced',
    supportsVision: true,
    supportsStructured: true,
    costHint: 4,
    description: 'Great balance. Strong for the Coach and conversational features.',
  },
  {
    id: 'claude-opus-4-6',
    provider: 'claude',
    displayName: 'Claude Opus 4.6',
    tier: 'best',
    supportsVision: true,
    supportsStructured: true,
    costHint: 5,
    description: 'Highest-quality option. Slowest and most expensive.',
  },
];

export function getModel(id: string): AIModel | undefined {
  return AVAILABLE_MODELS.find(m => m.id === id);
}

export function getModelsForProvider(provider: AIProvider): AIModel[] {
  return AVAILABLE_MODELS.filter(m => m.provider === provider);
}

// ─── Per-feature default model ───────────────────────────────────────────────

/**
 * Default model for each feature when the user hasn't set a preference.
 * Magic Scan needs vision; Coach benefits from longer context; Briefing should be cheap.
 */
const FEATURE_DEFAULTS: Record<AIFeature, string> = {
  briefing: 'gemini-2.0-flash',
  coach:    'gemini-2.0-flash',
  scan:     'gemini-2.0-flash',
  chat:     'gemini-2.0-flash',
  insights: 'gemini-2.0-flash',
};

// ─── User preferences (localStorage) ─────────────────────────────────────────

const PREFS_KEY = 'family_os_ai_prefs';
const KEYS_KEY  = 'family_os_ai_keys';

export interface AIPreferences {
  /** Per-feature model override; falls back to FEATURE_DEFAULTS when unset. */
  featureModels: Partial<Record<AIFeature, string>>;
}

export interface APIKeys {
  gemini?: string;
  claude?: string;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
}

export function loadPreferences(): AIPreferences {
  return safeParse(localStorage.getItem(PREFS_KEY), { featureModels: {} });
}

export function savePreferences(prefs: AIPreferences): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function loadKeys(): APIKeys {
  return safeParse(localStorage.getItem(KEYS_KEY), {});
}

export function saveKeys(keys: APIKeys): void {
  localStorage.setItem(KEYS_KEY, JSON.stringify(keys));
}

/** Returns the user's chosen model for the given feature, or the default. */
export function modelFor(feature: AIFeature): AIModel {
  const prefs = loadPreferences();
  const override = prefs.featureModels[feature];
  const fallback = FEATURE_DEFAULTS[feature];
  const id = override ?? fallback;
  return getModel(id) ?? getModel(fallback)!;
}

/**
 * Resolve an API key for a provider. Priority:
 *  1. User-entered key in localStorage (BYOK).
 *  2. Env var fallback (for dev / self-host).
 */
export function getApiKey(provider: AIProvider): string | undefined {
  const keys = loadKeys();
  if (provider === 'gemini') {
    return keys.gemini || (import.meta.env.VITE_API_KEY as string | undefined);
  }
  if (provider === 'claude') {
    return keys.claude || (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined);
  }
  return undefined;
}

/** True if the configured key for this model's provider exists. */
export function isModelConfigured(model: AIModel): boolean {
  return !!getApiKey(model.provider);
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class AIConfigError extends Error {
  constructor(public provider: AIProvider, message: string) {
    super(message);
    this.name = 'AIConfigError';
  }
}

// ─── Chat call ───────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model: AIModel;
  systemInstruction?: string;
  history?: ChatMessage[];
  maxOutputTokens?: number;
}

/**
 * Send a chat completion. Returns plain text.
 * Throws AIConfigError if the provider key is missing.
 */
export async function chat(prompt: string, opts: ChatOptions): Promise<string> {
  const { model, systemInstruction, history = [], maxOutputTokens = 1024 } = opts;
  const apiKey = getApiKey(model.provider);
  if (!apiKey) {
    throw new AIConfigError(
      model.provider,
      `No API key configured for ${model.provider}. Add one in Settings → AI Providers.`,
    );
  }

  if (model.provider === 'gemini') {
    return chatGemini(prompt, { apiKey, modelId: model.id, systemInstruction, history, maxOutputTokens });
  }
  if (model.provider === 'claude') {
    return chatClaude(prompt, { apiKey, modelId: model.id, systemInstruction, history, maxOutputTokens });
  }
  throw new Error(`Unknown provider: ${model.provider}`);
}

interface ProviderCallArgs {
  apiKey: string;
  modelId: string;
  systemInstruction?: string;
  history?: ChatMessage[];
  maxOutputTokens: number;
}

async function chatGemini(prompt: string, args: ProviderCallArgs): Promise<string> {
  const { apiKey, modelId, systemInstruction, history = [], maxOutputTokens } = args;
  const ai = new GoogleGenAI({ apiKey });

  const contents = [
    ...history.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: prompt }] },
  ];

  const result = await ai.models.generateContent({
    model: modelId,
    contents,
    config: {
      maxOutputTokens,
      ...(systemInstruction ? { systemInstruction } : {}),
    },
  });

  const text = (result.text ?? '').trim();
  if (!text) throw new Error('Empty response from Gemini.');
  return text;
}

async function chatClaude(prompt: string, args: ProviderCallArgs): Promise<string> {
  const { apiKey, modelId, systemInstruction, history = [], maxOutputTokens } = args;

  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: prompt },
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: maxOutputTokens,
      ...(systemInstruction ? { system: systemInstruction } : {}),
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = (body as { error?: { message?: string } })?.error?.message
      ?? `Claude API error ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json() as { content?: Array<{ text?: string }> };
  const text = (data.content?.[0]?.text ?? '').trim();
  if (!text) throw new Error('Empty response from Claude.');
  return text;
}

// ─── Structured / vision call ────────────────────────────────────────────────

export interface StructuredOptions<T> {
  model: AIModel;
  systemInstruction: string;
  /** JSON schema describing the expected response shape. */
  responseSchema: object;
  /** Optional image input (base64 + mimeType). Triggers vision call path. */
  image?: { data: string; mimeType: string };
  /** Optional text input alongside or instead of the image. */
  text?: string;
  /** TypeScript fallback parser. Not validated against schema. */
  parse?: (raw: unknown) => T;
}

/**
 * Send a structured-output call. Returns parsed JSON.
 * Used by Magic Scan and other OCR-style flows.
 */
export async function structured<T = unknown>(opts: StructuredOptions<T>): Promise<T> {
  const { model, systemInstruction, responseSchema, image, text, parse } = opts;

  if (image && !model.supportsVision) {
    throw new Error(`Model ${model.displayName} does not support vision input.`);
  }
  if (!model.supportsStructured) {
    throw new Error(`Model ${model.displayName} does not support structured output.`);
  }

  const apiKey = getApiKey(model.provider);
  if (!apiKey) {
    throw new AIConfigError(
      model.provider,
      `No API key configured for ${model.provider}. Add one in Settings → AI Providers.`,
    );
  }

  let raw: unknown;
  if (model.provider === 'gemini') {
    raw = await structuredGemini({ apiKey, modelId: model.id, systemInstruction, responseSchema, image, text });
  } else if (model.provider === 'claude') {
    raw = await structuredClaude({ apiKey, modelId: model.id, systemInstruction, responseSchema, image, text });
  } else {
    throw new Error(`Unknown provider: ${model.provider}`);
  }

  return parse ? parse(raw) : (raw as T);
}

interface StructuredCallArgs {
  apiKey: string;
  modelId: string;
  systemInstruction: string;
  responseSchema: object;
  image?: { data: string; mimeType: string };
  text?: string;
}

async function structuredGemini(args: StructuredCallArgs): Promise<unknown> {
  const { apiKey, modelId, systemInstruction, responseSchema, image, text } = args;
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
  if (image) parts.push({ inlineData: image });
  if (text)  parts.push({ text });
  if (parts.length === 0) parts.push({ text: 'Process the input and return structured data.' });

  const result = await ai.models.generateContent({
    model: modelId,
    contents: [{ parts }],
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      systemInstruction,
    },
  });

  return JSON.parse(result.text || '{}');
}

async function structuredClaude(args: StructuredCallArgs): Promise<unknown> {
  const { apiKey, modelId, systemInstruction, responseSchema, image, text } = args;

  // Claude uses tool-use to enforce JSON shapes. We define a single tool whose
  // input_schema matches the requested response schema, then read the tool_use
  // block from the response.
  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  > = [];
  if (image) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: image.mimeType, data: image.data },
    });
  }
  if (text) content.push({ type: 'text', text });
  if (content.length === 0) {
    content.push({ type: 'text', text: 'Process the input and return structured data.' });
  }

  // Translate JSON Schema -> Claude tool input_schema. We pass the schema through;
  // both shapes are JSON Schema-compatible at the basic types we use.
  const tool = {
    name: 'return_data',
    description: 'Return the extracted data in the required schema.',
    input_schema: claudeSchemaFromGemini(responseSchema),
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 2048,
      system: systemInstruction,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'return_data' },
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = (body as { error?: { message?: string } })?.error?.message
      ?? `Claude API error ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json() as { content?: Array<{ type: string; input?: unknown }> };
  const toolUse = data.content?.find(c => c.type === 'tool_use');
  if (!toolUse?.input) throw new Error('Claude did not return a structured response.');
  return toolUse.input;
}

/**
 * Convert a Gemini-style schema (using @google/genai's Type enum) to plain JSON
 * Schema for Claude. The Type enum values are already lowercase strings like
 * "OBJECT" / "STRING" — we lowercase them.
 */
function claudeSchemaFromGemini(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(claudeSchemaFromGemini);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === 'type' && typeof v === 'string') {
      out[k] = v.toLowerCase();
    } else if (v && typeof v === 'object') {
      out[k] = claudeSchemaFromGemini(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Re-export Type so callers can build schemas without a second import.
export { Type };
