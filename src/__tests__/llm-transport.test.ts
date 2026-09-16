/**
 * Cline backup transport selection (`src/lib/llm.ts`).
 *
 * Three transports, tried in order: the Anna/Executa proxy (default on, but
 * only usable inside the Anna host), the local dev-server relay, and a
 * key-bearing browser call. These tests pin the env-driven selection so a
 * local setup keeps working after refactors.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clineBrowserTransport,
  clineConfigured,
  clineMaxTokens,
  clineModelChain,
  clineRateLimitWaitMs,
  completeWithFallback,
  DEFAULT_CLINE_MODEL,
} from '@/lib/llm';

const ENV_KEYS = [
  'VITE_CLINE_PROXY',
  'VITE_CLINE_RELAY',
  'VITE_CLINE_DIRECT',
  'VITE_CLINE_API_KEY',
  'VITE_CLINE_BASE_URL',
  'VITE_CLINE_MODEL',
  'VITE_CLINE_MAX_TOKENS',
  'VITE_CLINE_MODEL_FALLBACKS',
  'VITE_CLINE_RETRY_DELAY_MS',
] as const;

const saved = new Map<string, string | undefined>();

function setEnv(key: string, value: string | undefined) {
  const store = import.meta.env as unknown as Record<string, string | undefined>;
  if (value === undefined) delete store[key];
  else store[key] = value;
}

afterEach(() => {
  for (const [key, value] of saved) setEnv(key, value);
  saved.clear();
  vi.unstubAllGlobals();
});

function withEnv(overrides: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    saved.set(key, (import.meta.env as unknown as Record<string, string | undefined>)[key]);
    setEnv(key, undefined);
  }
  for (const [key, value] of Object.entries(overrides)) setEnv(key, value);
}

/** Fetch stub programmable per call, recording each outgoing request body. */
function stubFetch(responses: Array<{ status: number; body: unknown }>) {
  const bodies: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body ?? '{}')));
    const next = responses.shift();
    if (!next) throw new Error('unexpected extra fetch call');
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { bodies };
}

const USER_MESSAGE = [{ role: 'user' as const, content: { type: 'text' as const, text: 'ping' } }];

describe('Cline backup transport selection', () => {
  it('has no browser transport by default', () => {
    withEnv({});
    expect(clineBrowserTransport()).toBeNull();
  });

  it('falls back to the relay when enabled, without a key in the bundle', () => {
    withEnv({ VITE_CLINE_RELAY: 'true' });
    expect(clineBrowserTransport()).toEqual({
      baseUrl: '/cline-api/api/v1',
      apiKey: '',
      model: DEFAULT_CLINE_MODEL,
    });
    expect(clineConfigured()).toBe(true);
  });

  it('uses a key-bearing direct transport when explicitly enabled', () => {
    withEnv({ VITE_CLINE_DIRECT: 'true', VITE_CLINE_API_KEY: 'token-123' });
    expect(clineBrowserTransport()).toEqual({
      baseUrl: 'https://api.cline.bot/api/v1',
      apiKey: 'token-123',
      model: DEFAULT_CLINE_MODEL,
    });
  });

  it('refuses to embed a key unless VITE_CLINE_DIRECT is set', () => {
    withEnv({ VITE_CLINE_API_KEY: 'token-123' });
    expect(clineBrowserTransport()).toBeNull();
  });

  it('prefers the explicit key over the relay', () => {
    withEnv({
      VITE_CLINE_RELAY: 'true',
      VITE_CLINE_DIRECT: 'true',
      VITE_CLINE_API_KEY: 'token-123',
    });
    expect(clineBrowserTransport()?.apiKey).toBe('token-123');
  });

  it('honours base-url and model overrides (trailing slash trimmed)', () => {
    withEnv({
      VITE_CLINE_RELAY: 'true',
      VITE_CLINE_BASE_URL: '/cline-api/api/v1/',
      VITE_CLINE_MODEL: 'zai/glm-4.6',
    });
    expect(clineBrowserTransport()).toEqual({
      baseUrl: '/cline-api/api/v1',
      apiKey: '',
      model: 'zai/glm-4.6',
    });
  });

  it('reports unconfigured when both proxy and browser transports are off', () => {
    withEnv({ VITE_CLINE_PROXY: 'false' });
    expect(clineConfigured()).toBe(false);

    withEnv({ VITE_CLINE_PROXY: 'false', VITE_CLINE_RELAY: 'true' });
    expect(clineConfigured()).toBe(true);
  });
});

describe('Cline completion budget', () => {
  it('defaults high enough for reasoning models', () => {
    withEnv({});
    expect(clineMaxTokens()).toBe(8192);
  });

  it('honours a VITE_CLINE_MAX_TOKENS override', () => {
    withEnv({ VITE_CLINE_MAX_TOKENS: '12000' });
    expect(clineMaxTokens()).toBe(12000);

    withEnv({ VITE_CLINE_MAX_TOKENS: 'nonsense' });
    expect(clineMaxTokens()).toBe(8192);

    withEnv({ VITE_CLINE_MAX_TOKENS: '-5' });
    expect(clineMaxTokens()).toBe(8192);
  });
});

describe('Cline response parsing (browser transport)', () => {
  it('unwraps the gateway `{ data, success }` envelope', async () => {
    withEnv({ VITE_CLINE_PROXY: 'false', VITE_CLINE_RELAY: 'true' });
    const { bodies } = stubFetch([{
      status: 200,
      body: {
        data: {
          model: 'minimax/minimax-m2.5',
          choices: [{ message: { role: 'assistant', content: '  - Bullet one\n- Bullet two  ' }, finish_reason: 'stop' }],
        },
        success: true,
      },
    }]);

    const result = await completeWithFallback({ messages: USER_MESSAGE, maxTokens: 8192 });

    expect(result.text).toBe('- Bullet one\n- Bullet two');
    expect(result.provider).toBe('cline');
    expect(result.via).toBe('relay');
    // Relay mode must not put a key in the browser request.
    const headers = (vi.mocked(globalThis.fetch).mock.calls[0]?.[1] as RequestInit | undefined)?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(bodies[0]?.max_tokens).toBe(8192);
  });

  it('accepts a bare OpenAI payload too', async () => {
    withEnv({ VITE_CLINE_PROXY: 'false', VITE_CLINE_DIRECT: 'true', VITE_CLINE_API_KEY: 'k' });
    stubFetch([{
      status: 200,
      body: { model: 'm', choices: [{ message: { role: 'assistant', content: 'plain' } }] },
    }]);

    const result = await completeWithFallback({ messages: USER_MESSAGE });
    expect(result.text).toBe('plain');
    expect(result.via).toBe('direct');
  });

  it('retries with a doubled budget after "empty response content"', async () => {
    withEnv({ VITE_CLINE_PROXY: 'false', VITE_CLINE_RELAY: 'true', VITE_CLINE_MAX_TOKENS: '1000' });
    const { bodies } = stubFetch([
      { status: 500, body: { error: 'empty response content', success: false } },
      {
        status: 200,
        body: { data: { choices: [{ message: { role: 'assistant', content: 'recovered' } }] }, success: true },
      },
    ]);

    const result = await completeWithFallback({ messages: USER_MESSAGE });
    expect(result.text).toBe('recovered');
    expect(bodies[0]?.max_tokens).toBe(1000);
    expect(bodies[1]?.max_tokens).toBe(2000);
  });

  it('does not retry non-budget failures (auth, credits)', async () => {
    withEnv({ VITE_CLINE_PROXY: 'false', VITE_CLINE_RELAY: 'true' });
    stubFetch([{ status: 401, body: { error: 'Unauthorized' } }]);

    await expect(completeWithFallback({ messages: USER_MESSAGE })).rejects.toThrow('Cline API 401: Unauthorized');
    expect(vi.mocked(globalThis.fetch).mock.calls).toHaveLength(1);
  });
});

describe('Cline model fallback chain', () => {
  it('orders primary first and drops duplicates', () => {
    withEnv({});
    expect(clineModelChain()[0]).toBe(DEFAULT_CLINE_MODEL);
    expect(new Set(clineModelChain()).size).toBe(clineModelChain().length);

    withEnv({
      VITE_CLINE_MODEL: 'a/first',
      VITE_CLINE_MODEL_FALLBACKS: 'b/second, c/third ,a/first',
    });
    expect(clineModelChain()).toEqual(['a/first', 'b/second', 'c/third']);
  });
});

describe('Cline rate-limit resilience (429)', () => {
  const quotaError = {
    status: 500,
    body: {
      error:
        'inference request failed: failed to invoke model \'google/gemma-4-31b-it:free\' from Openrouter: request failed with status 429: '
        + 'Quota exceeded for metric: input_token_count, limit: 16000, model: gemma-4-31b. Please retry in 32.5s. '
        + 'status: RESOURCE_EXHAUSTED',
      success: false,
    },
  };

  const ok = (model: string) => ({
    status: 200,
    body: { data: { model, choices: [{ message: { role: 'assistant', content: 'answer' } }] }, success: true },
  });

  it('cools down per the upstream hint, then retries the same model', async () => {
    withEnv({
      VITE_CLINE_PROXY: 'false',
      VITE_CLINE_RELAY: 'true',
      VITE_CLINE_RETRY_DELAY_MS: '0',
    });
    stubFetch([quotaError, ok(DEFAULT_CLINE_MODEL)]);

    const result = await completeWithFallback({ messages: USER_MESSAGE });
    expect(result.text).toBe('answer');
    expect(result.model).toBe(DEFAULT_CLINE_MODEL);
    expect(vi.mocked(globalThis.fetch).mock.calls).toHaveLength(2);
  });

  it('walks to the fallback model when the primary stays throttled', async () => {
    withEnv({
      VITE_CLINE_PROXY: 'false',
      VITE_CLINE_RELAY: 'true',
      VITE_CLINE_RETRY_DELAY_MS: '0',
      VITE_CLINE_MODEL: 'primary/model',
      VITE_CLINE_MODEL_FALLBACKS: 'fallback/model',
    });
    // Primary is throttled → skipped immediately → fallback answers on its first try.
    const { bodies } = stubFetch([quotaError, ok('fallback/model')]);

    const result = await completeWithFallback({ messages: USER_MESSAGE });

    expect(result.text).toBe('answer');
    expect(result.model).toBe('fallback/model');
    expect(bodies.map((b) => b.model)).toEqual(['primary/model', 'fallback/model']);
  });

  it('skips to the next model on a non-quota failure', async () => {
    withEnv({
      VITE_CLINE_PROXY: 'false',
      VITE_CLINE_RELAY: 'true',
      VITE_CLINE_RETRY_DELAY_MS: '0',
      VITE_CLINE_MODEL: 'primary/model',
      VITE_CLINE_MODEL_FALLBACKS: 'fallback/model',
    });
    const { bodies } = stubFetch([
      { status: 502, body: { error: 'bad gateway', success: false } },
      ok('fallback/model'),
    ]);

    const result = await completeWithFallback({ messages: USER_MESSAGE });
    expect(result.model).toBe('fallback/model');
    expect(bodies.map((b) => b.model)).toEqual(['primary/model', 'fallback/model']);
  });

  it('fails fast on a bad key instead of walking the chain', async () => {
    withEnv({
      VITE_CLINE_PROXY: 'false',
      VITE_CLINE_RELAY: 'true',
      VITE_CLINE_RETRY_DELAY_MS: '0',
      VITE_CLINE_MODEL: 'primary/model',
      VITE_CLINE_MODEL_FALLBACKS: 'fallback/model',
    });
    stubFetch([{ status: 401, body: { error: 'Unauthorized' } }]);

    await expect(completeWithFallback({ messages: USER_MESSAGE })).rejects.toThrow('Cline API 401');
    expect(vi.mocked(globalThis.fetch).mock.calls).toHaveLength(1);
  });

  it('parses the upstream retry hint into a capped cooldown', () => {
    withEnv({});
    expect(clineRateLimitWaitMs('Quota exceeded. Please retry in 32.553773851s.')).toBe(33554);
    expect(clineRateLimitWaitMs('{"retryDelay": "32s"}')).toBe(33000);
    expect(clineRateLimitWaitMs('no hint at all')).toBe(30000);
    expect(clineRateLimitWaitMs('Please retry in 500s')).toBe(60000); // capped
    expect(clineRateLimitWaitMs('Please retry in 0s')).toBe(1000); // floored

    withEnv({ VITE_CLINE_RETRY_DELAY_MS: '45000' });
    expect(clineRateLimitWaitMs('Please retry in 32.5s')).toBe(45000);

    withEnv({ VITE_CLINE_RETRY_DELAY_MS: '0' });
    expect(clineRateLimitWaitMs('Please retry in 32.5s')).toBe(0);
  });
});
