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
 * Outside the Anna host (plain `vite` dev server) the proxy has no tool
 * channel, so the backup needs a browser transport:
 *
 *   VITE_CLINE_RELAY=true   dev server relays `/cline-api/*` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ api.cline.bot
 *                           and injects `CLINE_API_KEY` server-side. Preferred
 *                           for local dev: the key never reaches the bundle.
 *   VITE_CLINE_DIRECT=true  embeds `VITE_CLINE_API_KEY` in the bundle and calls
 *                           api.cline.bot from the browser. Only works where
 *                           CORS is not enforced (Cline's API sends no
 *                           Access-Control-Allow-Origin), i.e. not localhost.
 *
 *   VITE_CLINE_MODEL        `provider/model-name`, defaults to the free
 *                           "google/gemma-4-31b-it:free"
 *   VITE_CLINE_MODEL_FALLBACKS
 *                           comma-separated models tried in order when the
 *                           primary is throttled upstream ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â free-tier models
 *                           share an upstream quota and answer 429 at random
 *   VITE_CLINE_MAX_TOKENS   per-section completion budget (default 8192;
 *                           reasoning models need ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥8k)
 *   VITE_CLINE_RETRY_DELAY_MS
 *                           overrides the 429 cooldown (default: the upstream
 *                           retry hint, capped at 60s; 0 disables the wait)
 *   VITE_CLINE_PROXY        "false" to disable the Executa proxy transport
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

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Cline configuration ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

const DEFAULT_CLINE_BASE_URL = 'https://api.cline.bot/api/v1';
/**
 * Free-tier default, chosen deliberately: `google/gemma-4-31b-it:free` is a
 * plain instruct model ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â it answers in a few seconds with no account balance.
 * Reasoning models on the same API (e.g. `minimax/minimax-m2.5`) burn ~7k
 * tokens thinking before the visible answer, so they need
 * `VITE_CLINE_MAX_TOKENS` ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â¥ 8k or they fail with "empty response content".
 */
export const DEFAULT_CLINE_MODEL = 'google/gemma-4-31b-it:free';

/**
 * Ordered fallbacks for the browser transport. The free models are served from
 * different upstream providers, so a single-provider quota exhaustion (e.g.
 * Google's 16k token/minute limit on the Gemma models) does not stall the
 * whole chain — the next model, from a completely different provider, is tried
 * immediately.
 *
 * Defaults verified live against api.cline.bot as of 2026-09.
*/
const DEFAULT_CLINE_MODEL_FALLBACKS = 'google/gemma-4-26b-a4b-it:free,' + 
  'nvidia/nemotron-3-super-120b-a12b:free,' + 
  'qwen/qwen3-30b-a4b:free';

/** Ordered model list; the first one that answers wins. */
export function clineModelChain(): string[] {
  const primary = env('VITE_CLINE_MODEL')?.trim() || DEFAULT_CLINE_MODEL;
  const raw = env('VITE_CLINE_MODEL_FALLBACKS')?.trim() || DEFAULT_CLINE_MODEL_FALLBACKS;
  const chain = [primary, ...raw.split(',').map((model) => model.trim()).filter(Boolean)];
  return [...new Set(chain)];
}

/**
 * Per-section completion budget. Cline's free default (MiniMax M2.5) is a
 * reasoning model: it burns thousands of tokens on internal reasoning before
 * writing the visible answer (~7k measured on one observatory section). A
 * small `max_tokens` therefore yields a 500 "empty response content" instead
 * of an answer. Billed usage is what actually happened, so a generous cap
 * costs nothing extra.
 */
const DEFAULT_CLINE_MAX_TOKENS = 8192;
/** Hard ceiling for the automatic retry with extra headroom. */
const MAX_CLINE_MAX_TOKENS = 20480;

/** Completion budget per section request (`VITE_CLINE_MAX_TOKENS` overrides). */
export function clineMaxTokens(): number {
  const raw = Number.parseInt(env('VITE_CLINE_MAX_TOKENS')?.trim() ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_CLINE_MAX_TOKENS;
}

/**
 * Same-origin dev-server relay (`vite.config.ts` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `/cline-api/*`). It exists
 * because api.cline.bot sends no CORS headers, so no browser transport can
 * reach it directly; the relay also injects the Authorization header
 * server-side from `CLINE_API_KEY` so no key ever reaches the bundle.
 */
const RELAY_BASE_URL = '/cline-api/api/v1';

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

/** Dev-server relay transport is off unless explicitly enabled. */
function clineRelayEnabled(): boolean {
  return flag('VITE_CLINE_RELAY', false);
}

/** A key-bearing browser transport config (direct mode only). */
function getDirectClineConfig(): ClineConfig | null {
  if (!clineDirectEnabled()) return null;
  const apiKey = env('VITE_CLINE_API_KEY')?.trim();
  if (!apiKey) return null;

  const baseUrl = (env('VITE_CLINE_BASE_URL')?.trim() || DEFAULT_CLINE_BASE_URL).replace(/\/+$/, '');
  const model = env('VITE_CLINE_MODEL')?.trim() || DEFAULT_CLINE_MODEL;
  return { baseUrl, apiKey, model };
}

/** Keyless relay config: the dev server holds the key server-side. */
function getRelayClineConfig(): ClineConfig | null {
  if (!clineRelayEnabled()) return null;
  const model = env('VITE_CLINE_MODEL')?.trim() || DEFAULT_CLINE_MODEL;
  return { baseUrl: RELAY_BASE_URL, apiKey: '', model };
}

/** Model override shared by both transports (proxy reads its own env too). */
function clineModelOverride(): string | null {
  return env('VITE_CLINE_MODEL')?.trim() || null;
}

/**
 * True when some Cline transport is available: the Executa proxy (default on,
 * confirmed at invoke time), the dev-server relay, or an explicitly enabled
 * direct browser key. Kept synchronous for existing call sites; the proxy's
 * `not_configured` state surfaces per-attempt at completion time.
 */
export function clineConfigured(): boolean {
  return clineProxyEnabled() || getDirectClineConfig() !== null || getRelayClineConfig() !== null;
}

/**
 * The browser-side Cline transport that would be used, exposed for tests and
 * diagnostics: `null` when neither transport is enabled, or with `apiKey: ''`
 * in relay mode (the dev server injects the Authorization header).
 */
export function clineBrowserTransport(): ClineConfig | null {
  // An explicit key wins over the relay, which needs no key at all.
  return getDirectClineConfig() ?? getRelayClineConfig();
}

/** The model the backup will use, or null when no transport is available. */
export function clineModel(): string | null {
  return clineConfigured() ? clineModelOverride() ?? DEFAULT_CLINE_MODEL : null;
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Providers ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

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

/** OpenAI content parts ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ plain strings, which every compatible API accepts. */
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
 * Cline via the bundled Executa ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â the key stays in the runner environment.
 * Throws `not_configured: ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦` when the runner has no CLINE_API_KEY so the
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
  // (cold start, one-off EOF) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â gateway HTTP errors already came back clean.
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
    // Clean envelope ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â retrying would just repeat the same gateway error.
    throw new Error(resp?.error ?? 'Executa proxy returned no completion.');
  }
  throw new Error('Executa proxy returned no completion.');
}

/** Direct browser call ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â opt-in only (embeds the key in the bundle). */

/** OpenAI chat-completion shapes, tolerant of the gateway's envelope. */
interface ClineCompletionMessage { content?: string }
interface ClineCompletionChoice { message?: ClineCompletionMessage; finish_reason?: string }
interface ClineCompletionPayload { model?: string; choices?: ClineCompletionChoice[] }

function isEnvelope(payload: unknown): payload is { data: ClineCompletionPayload } {
  return typeof payload === 'object' && payload !== null
    && 'data' in (payload as Record<string, unknown>)
    && typeof (payload as { data?: unknown }).data === 'object'
    && Array.isArray((payload as { data?: { choices?: unknown } }).data?.choices);
}

/** Upstream quota exhaustion: 429, "quota", "RESOURCE_EXHAUSTED", rate limits. */
function isRateLimited(message: string): boolean {
  return /\b429\b|rate.?limit|resource_exhausted|quota/i.test(message);
}

/** A bad key fails on every model, so there is no point walking the chain. */
function isAuthFailure(message: string): boolean {
  return /\bCline API 401\b|unauthorized/i.test(message);
}

/**
 * Cooldown before retrying a rate-limited request. The upstream hint
 * ("Please retry in 32.55s" / `"retryDelay": "32s"`) is honoured when present;
 * `VITE_CLINE_RETRY_DELAY_MS` overrides it outright (0 skips the wait).
 */
export function clineRateLimitWaitMs(message: string): number {
  const override = Number.parseInt(env('VITE_CLINE_RETRY_DELAY_MS')?.trim() ?? '', 10);
  if (Number.isFinite(override) && override >= 0) return override;

  const seconds = /retry in ([0-9.]+)\s*s/i.exec(message)?.[1]
    ?? /retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)"?\s*s/i.exec(message)?.[1];
  const parsed = seconds === undefined ? NaN : Number.parseFloat(seconds);
  const wait = Number.isFinite(parsed) ? (parsed + 1) * 1000 : 30_000;
  return Math.min(Math.max(Math.ceil(wait), 1000), 60_000);
}

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

/**
 * Cline browser transport: a key-bearing direct call, or (dev) the keyless
 * same-origin relay that `vite.config.ts` provides.
 *
 * Resilience, in order: a doubled-budget retry when a reasoning model exhausts
 * its cap ("empty response content"), then ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â for upstream quota (429) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a
 * cooldown honouring the gateway's own retry hint, then the next model in the
 * fallback chain. Auth failures (401) abort immediately: no model can succeed.
 */
async function completeViaCline(params: {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<LlmCompletion> {
  const config = clineBrowserTransport();
  if (!config) {
    throw new Error(
      'Cline browser transport is disabled (set VITE_CLINE_RELAY=true with CLINE_API_KEY for local/dev, or VITE_CLINE_DIRECT=true with VITE_CLINE_API_KEY).',
    );
  }

  const via = config.apiKey ? 'direct' : 'relay';

  const attempt = async (model: string, maxTokens: number): Promise<LlmCompletion> => {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Relay mode sends no key: the dev server injects it server-side.
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        'X-Title': 'Earth Anomaly Observatory',
      },
      body: JSON.stringify({
        model,
        messages: params.messages.map((message) => ({
          role: message.role,
          content: toPlainContent(message.content),
        })),
        stream: false,
        ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      }),
    });

    if (!response.ok) {
      // The gateway sends errors as `{"error": "<msg>", "success": false}`
      // (or the OpenAI `{"error": {"message": ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦}}` shape) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â accept both.
      let detail = '';
      try {
        const body = (await response.json()) as { error?: string | { message?: string } };
        detail = typeof body?.error === 'string' ? body.error : body?.error?.message ?? '';
      } catch {
        // Non-JSON error body: the status code alone is still useful.
      }
      throw new Error(`Cline API ${response.status}${detail ? `: ${detail}` : ''}`);
    }

    const payload = (await response.json()) as
      & ClineCompletionPayload
      & { data?: unknown };

    // api.cline.bot wraps the OpenAI payload in `{ data: ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦, success: true }`.
    const completion: ClineCompletionPayload = isEnvelope(payload) ? payload.data : payload;
    const choice = completion.choices?.[0];
    const text = choice?.message?.content?.trim() ?? '';

    if (text.length === 0) {
      throw new Error(
        choice?.finish_reason === 'length'
          ? `Cline API returned no content: ${model} spent its ${maxTokens}-token budget on reasoning before answering. Raise VITE_CLINE_MAX_TOKENS or switch VITE_CLINE_MODEL.`
          : 'Cline API returned an empty completion.',
      );
    }

    return { text, provider: 'cline', model: completion.model ?? model, via };
  };

  /**
   * One model attempt, with extra budget when the cap was exhausted. Rate-limit
   * failures are excluded: they need a cooldown or another model, not more
   * tokens.
   */
  const attemptWithHeadroom = async (model: string): Promise<LlmCompletion> => {
    try {
      return await attempt(model, clineMaxTokens());
    } catch (error) {
      const message = errorMessage(error);
      if (isRateLimited(message)) throw error;
      if (!/empty (response|completion)|500|budget|no content/i.test(message)) throw error;
      return attempt(model, Math.min(clineMaxTokens() * 2, MAX_CLINE_MAX_TOKENS));
    }
  };

  let lastError: unknown = new Error('No Cline model answered.');

  // First pass: walk the chain; a rate-limited model is skipped immediately so
  // a single-provider quota exhaustion never stalls the whole request.
  for (const model of clineModelChain()) {
    try {
      return await attemptWithHeadroom(model);
    } catch (error) {
      lastError = error;
      const message = errorMessage(error);
      if (isAuthFailure(message)) throw error;
      if (!isRateLimited(message)) continue; // non-quota failure: let the next model try
      // Quota exhausted on this model: skip immediately to the next one.
    }
  }

  // If every model in the chain was throttled, honour the upstream retry hint
  // once on the primary before giving up — this is the only place we wait.
  const chain = clineModelChain();
  if (chain.length > 0) {
    const message = errorMessage(lastError);
    if (isRateLimited(message)) {
      const waitMs = clineRateLimitWaitMs(message);
      if (waitMs > 0) {
        await sleep(waitMs);
        try {
          return await attempt(chain[0], clineMaxTokens());
        } catch (retryError) {
          lastError = retryError;
        }
      }
    }
  }

  throw lastError;
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Chain ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

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

  if (clineBrowserTransport() !== null) {
    try {
      return { ...(await completeViaCline(params)), attempts };
    } catch (error) {
      attempts.push({ provider: 'cline', error: `direct: ${errorMessage(error)}` });
    }
  }

  throw new Error(describe(attempts));
}