/**
 * LLM provider layer with automatic fallback.
 *
 *   primary  `anna`   the host runtime LLM (Anna credits)
 *   backup   `cline`  Cline's OpenAI-compatible Chat Completions API
 *
 * The backup is resolved through the bundled `earth-data` Executa proxy via
 * `runtime.tools.invoke` (`llm.complete`). The Cline bearer token lives only
 * in the Executa runner environment (`CLINE_API_KEY`) and never reaches the
 * browser bundle, exactly as the bundled-handle audit recommends. The proxy
 * is enabled by default; set `VITE_CLINE_PROXY=false` to disable it.
 *
 *   VITE_CLINE_MODEL     `provider/model-name`, defaults to the free
 *                        "minimax/minimax-m2.5"
 *   VITE_CLINE_PROXY     "false" to disable the Executa proxy transport
 *
 * Docs: https://docs.cline.bot/api/getting-started
 */

import { getAnnaRuntime, getToolId, type LLMMessage } from '@/anna-runtime';

export type { LLMMessage };

export type LlmProviderId = 'anna' | 'cline';

export interface LlmCompletion {
  text: string;
  provider: LlmProviderId;
  model?: string;
  /** Transport detail, e.g. `executa-proxy` vs `direct` for the cline backup. */
  via?: string;
}

/** A provider that was tried and failed before the completion succeeded. */
export interface LlmAttempt {
  provider: LlmProviderId;
  error: string;
}

export interface LlmChainResult extends LlmCompletion {
  attempts: LlmAttempt[];
}

// ─── Cline configuration ─────────────────────────────────────────────────────

const DEFAULT_CLINE_BASE_URL = 'https://api.cline.bot/api/v1';
/** Free-tier model, so the backup works even with zero Cline credits. */
export const DEFAULT_CLINE_MODEL = 'minimax/minimax-m2.5';

interface ClineConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function env(name: string): string | undefined {
  const value = (import.meta.env as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

function flag(name: string, defaultOn: boolean): boolean {
  const raw = env(name)?.trim().toLowerCase();
  if (!raw) return defaultOn;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return defaultOn;
}

/** Executa proxy transport is on unless explicitly disabled. */
export function clineProxyEnabled(): boolean {
  return flag('VITE_CLINE_PROXY', true);
}

/** Direct browser transport is off unless explicitly enabled. */
function clineDirectEnabled(): boolean {
  return flag('VITE_CLINE_DIRECT', false);
}

function getDirectClineConfig(): ClineConfig | null {
  if (!clineDirectEnabled()) return null;
  const apiKey = env('VITE_CLINE_API_KEY')?.trim();
  if (!apiKey) return null;

  const baseUrl = (env('VITE_CLINE_BASE_URL')?.trim() || DEFAULT_CLINE_BASE_URL).replace(/\/+$/, '');
  const model = env('VITE_CLINE_MODEL')?.trim() || DEFAULT_CLINE_MODEL;
  return { baseUrl, apiKey, model };
}

/** Model override shared by both transports (proxy reads its own env too). */
function clineModelOverride(): string | null {
  return env('VITE_CLINE_MODEL')?.trim() || null;
}

/**
 * True when some Cline transport is available: the Executa proxy (default on,
 * confirmed at invoke time) or an explicitly enabled direct browser key.
 * Kept synchronous for existing call sites; the proxy's `not_configured`
 * state surfaces per-attempt at completion time.
 */
export function clineConfigured(): boolean {
  return clineProxyEnabled() || getDirectClineConfig() !== null;
}

/** The model the backup will use, or null when no transport is available. */
export function clineModel(): string | null {
  return clineConfigured() ? clineModelOverride() ?? DEFAULT_CLINE_MODEL : null;
}

// ─── Providers ───────────────────────────────────────────────────────────────

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function completeViaAnna(params: {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<LlmCompletion> {
  const runtime = await getAnnaRuntime();
  if (!runtime?.llm?.complete) {
    throw new Error('Anna runtime unavailable (running outside the Anna host).');
  }

  const response = await runtime.llm.complete({
    messages: params.messages,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
  });

  const text = typeof response.content === 'string'
    ? response.content
    : '';

  return { text, provider: 'anna' };
}

/** OpenAI content parts → plain strings, which every compatible API accepts. */
function toPlainContent(content: LLMMessage['content']): string {
  return typeof content === 'string' ? content : content.text;
}

type ProxyInvokePayload = {
  success: boolean;
  data?: {
    text?: string;
    model?: string;
  };
  error?: string;
  code?: string;
};

function normalizeProxyResponse(raw: unknown): ProxyInvokePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const wrapped = raw as { ok?: boolean; result?: unknown; error?: { message?: string } };
  if (wrapped.result && typeof wrapped.result === 'object') {
    return wrapped.result as ProxyInvokePayload;
  }
  const record = raw as Record<string, unknown>;
  if ('success' in record) return raw as ProxyInvokePayload;
  if (wrapped.ok === false) {
    return { success: false, error: wrapped.error?.message ?? 'Tool invoke failed' };
  }
  return null;
}

/**
 * Cline via the bundled Executa — the key stays in the runner environment.
 * Throws `not_configured: …` when the runner has no CLINE_API_KEY so the
 * chain can fall through to the direct transport or report cleanly.
 */
async function completeViaClineProxy(params: {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<LlmCompletion> {
  const runtime = await getAnnaRuntime();
  if (!runtime?.tools?.invoke) {
    throw new Error('Executa proxy unavailable (no Anna runtime tool channel).');
  }

  const resolvedId = getToolId('earth-data', 'tool-dev-earth-data');

  // The dispatcher unwraps `{ success, data }` envelopes itself; retries
  // below only help when the *transport* failed, never for a clean
  // `success: false` answer. These retries handle transient runner hiccups
  // (cold start, one-off EOF) — gateway HTTP errors already came back clean.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let raw: unknown;
    try {
      raw = await runtime.tools.invoke(
        resolvedId,
        'llm.complete',
        {
          messages: params.messages.map((message) => ({
            role: message.role,
            content: toPlainContent(message.content),
          })),
          ...(clineModelOverride() ? { model: clineModelOverride() } : {}),
          ...(params.maxTokens !== undefined ? { maxTokens: params.maxTokens } : {}),
          ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        },
      );
    } catch (error) {
      // Transport-level failure (timeout, EOF, spawn). Worth one retry.
      if (attempt === 0) continue;
      throw new Error(`Executa proxy transport failed: ${errorMessage(error)}`);
    }

    const resp = normalizeProxyResponse(raw);
    if (resp?.success && typeof resp.data?.text === 'string' && resp.data.text.length > 0) {
      return {
        text: resp.data.text,
        provider: 'cline',
        model: resp.data.model ?? clineModelOverride() ?? DEFAULT_CLINE_MODEL,
        via: 'executa-proxy',
      };
    }
    // Clean envelope — retrying would just repeat the same gateway error.
    throw new Error(resp?.error ?? 'Executa proxy returned no completion.');
  }
  throw new Error('Executa proxy returned no completion.');
}

/** Direct browser call — opt-in only (embeds the key in the bundle). */

async function completeViaCline(params: {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<LlmCompletion> {
  const config = getDirectClineConfig();
  if (!config) throw new Error('Cline direct transport is disabled (set VITE_CLINE_DIRECT=true with VITE_CLINE_API_KEY for local/dev only).');

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'X-Title': 'Earth Anomaly Observatory',
    },
    body: JSON.stringify({
      model: config.model,
      messages: params.messages.map((message) => ({
        role: message.role,
        content: toPlainContent(message.content),
      })),
      stream: false,
      ...(params.maxTokens !== undefined ? { max_tokens: params.maxTokens } : {}),
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    }),
  });

  if (!response.ok) {
    // 402 Payment Required = out of Cline credits; surface the code verbatim.
    let detail = '';
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (typeof body?.error?.message === 'string') detail = `: ${body.error.message}`;
    } catch {
      // The error body was not JSON; the status code alone is still useful.
    }
    throw new Error(`Cline API ${response.status}${detail}`);
  }

  const payload = (await response.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
  };

  const text = payload.choices?.[0]?.message?.content ?? '';
  if (text.length === 0) throw new Error('Cline API returned an empty completion.');

  return { text, provider: 'cline', model: payload.model ?? config.model, via: 'direct' };
}

// ─── Chain ───────────────────────────────────────────────────────────────────

function describe(attempts: LlmAttempt[]): string {
  return attempts.map((attempt) => `${attempt.provider}: ${attempt.error}`).join(' | ');
}

/**
 * Completes via the primary (Anna) provider, falling back to the backup
 * (Cline) when the primary is unavailable, unconfigured, out of credits or
 * simply failing. The backup itself tries the Executa proxy first (key held
 * server-side) and then the opt-in direct browser transport. Throws only when
 * every provider in the chain failed, and the error message then names each
 * attempt.
 */
export async function completeWithFallback(params: {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<LlmChainResult> {
  const attempts: LlmAttempt[] = [];

  try {
    return { ...(await completeViaAnna(params)), attempts };
  } catch (error) {
    attempts.push({ provider: 'anna', error: errorMessage(error) });
  }

  if (!clineConfigured()) {
    attempts.push({ provider: 'cline', error: 'backup not configured (no proxy transport and no direct key)' });
    throw new Error(describe(attempts));
  }

  if (clineProxyEnabled()) {
    try {
      return { ...(await completeViaClineProxy(params)), attempts };
    } catch (error) {
      attempts.push({ provider: 'cline', error: `proxy: ${errorMessage(error)}` });
    }
  }

  if (getDirectClineConfig() !== null) {
    try {
      return { ...(await completeViaCline(params)), attempts };
    } catch (error) {
      attempts.push({ provider: 'cline', error: `direct: ${errorMessage(error)}` });
    }
  }

  throw new Error(describe(attempts));
}