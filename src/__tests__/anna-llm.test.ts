/**
 * Anna host LLM primary path (`src/lib/llm.ts` → `runtime.llm.complete`).
 *
 * The host answers MCP-shaped (`content: {type:'text', text}`) and clamps
 * `maxTokens` to the install grant's per-call cap (4096 for this app). Two
 * host-only failure modes are pinned here because neither reproduces on the
 * plain Vite dev server:
 *
 *   1. the request field is `maxTokens` — sending the OpenAI spelling
 *      `max_tokens` makes the dispatcher fall back to its own 4096 default;
 *   2. an empty `content.text` arrives on a *successful* RPC when a reasoning
 *      model burns the whole budget, and must throw so the Cline backup runs.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAnnaRuntime, llmContentText, type AnnaRuntime } from '@/anna-runtime';
import { ANNA_MAX_TOKENS_CAP, completeWithFallback } from '@/lib/llm';

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

function withEnv(overrides: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    saved.set(key, (import.meta.env as unknown as Record<string, string | undefined>)[key]);
    setEnv(key, undefined);
  }
  for (const [key, value] of Object.entries(overrides)) setEnv(key, value);
}

const USER_MESSAGE = [
  { role: 'user' as const, content: { type: 'text' as const, text: 'Summarize the anomalies.' } },
];

const mockedRuntime = vi.mocked(getAnnaRuntime);

/** Runtime stub whose `llm.complete` answers with `reply` and records requests. */
function stubAnnaRuntime(reply: unknown) {
  const calls: Array<Record<string, unknown>> = [];
  const runtime = {
    window: { ready: async () => {} },
    tools: {
      invoke: async () => ({ success: false, error: 'Executa proxy disabled in this test.' }),
    },
    llm: {
      complete: async (params: Record<string, unknown>) => {
        calls.push(params);
        return reply;
      },
    },
  } as unknown as AnnaRuntime;
  mockedRuntime.mockResolvedValue(runtime);
  return calls;
}

/** Minimal OpenAI-shaped Cline reply, so the backup transport can answer. */
function stubClineFetch(text = 'backup answer') {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  for (const [key, value] of saved) setEnv(key, value);
  saved.clear();
  mockedRuntime.mockResolvedValue(null);
  vi.unstubAllGlobals();
});

describe('llmContentText', () => {
  it('reads the documented MCP-shaped text block', () => {
    expect(llmContentText({ content: { type: 'text', text: '  hello  ' } })).toBe('hello');
  });

  it('accepts a bare string content (older host shape)', () => {
    expect(llmContentText({ content: 'hello' })).toBe('hello');
  });

  it('joins content-block arrays', () => {
    expect(llmContentText({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }))
      .toBe('ab');
  });

  it('returns empty string for an empty or malformed reply', () => {
    expect(llmContentText({ content: { type: 'text', text: '' } })).toBe('');
    expect(llmContentText({})).toBe('');
    expect(llmContentText(null)).toBe('');
  });
});

describe('Anna host LLM (primary provider)', () => {
  it('sends maxTokens (not max_tokens) and returns the MCP-shaped answer', async () => {
    withEnv({});
    const calls = stubAnnaRuntime({
      content: { type: 'text', text: 'Grounding is nominal.' },
      model: 'qwen3.7-plus',
      stopReason: 'endTurn',
      usage: { outputTokens: 42 },
    });

    const result = await completeWithFallback({ messages: USER_MESSAGE, temperature: 0.2 });

    expect(result.text).toBe('Grounding is nominal.');
    expect(result.provider).toBe('anna');
    expect(result.via).toBe('host');
    expect(result.model).toBe('qwen3.7-plus');
    expect(result.attempts).toEqual([]);

    expect(calls).toHaveLength(1);
    expect(calls[0].maxTokens).toBe(ANNA_MAX_TOKENS_CAP);
    expect(calls[0]).not.toHaveProperty('max_tokens');
    expect(calls[0].temperature).toBe(0.2);
  });

  it('clamps the backup-sized budget down to the grant cap', async () => {
    withEnv({ VITE_CLINE_MAX_TOKENS: '8192' });
    const calls = stubAnnaRuntime({ content: { type: 'text', text: 'ok' } });

    await completeWithFallback({ messages: USER_MESSAGE, maxTokens: 8192 });

    expect(calls[0].maxTokens).toBe(ANNA_MAX_TOKENS_CAP);
  });

  it('keeps a smaller caller budget untouched and omits undefined temperature', async () => {
    withEnv({});
    const calls = stubAnnaRuntime({ content: { type: 'text', text: 'ok' } });

    await completeWithFallback({ messages: USER_MESSAGE, maxTokens: 512 });

    expect(calls[0].maxTokens).toBe(512);
    expect(calls[0]).not.toHaveProperty('temperature');
  });

  it('treats an empty content.text as a failure and falls back to the Cline backup', async () => {
    withEnv({ VITE_CLINE_PROXY: 'false', VITE_CLINE_DIRECT: 'true', VITE_CLINE_API_KEY: 'test-key' });
    stubAnnaRuntime({
      content: { type: 'text', text: '' },
      stopReason: 'endTurn',
      usage: { outputTokens: 4097 },
    });
    stubClineFetch('backup answer');

    const result = await completeWithFallback({ messages: USER_MESSAGE });

    expect(result.text).toBe('backup answer');
    expect(result.provider).toBe('cline');
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].provider).toBe('anna');
    expect(result.attempts[0].error).toContain('spent 4097');
  });

  it('reports both provider failures when the budget was exhausted and no backup is configured', async () => {
    withEnv({ VITE_CLINE_PROXY: 'false' });
    stubAnnaRuntime({ content: { type: 'text', text: '' }, usage: { outputTokens: 4096 } });

    await expect(completeWithFallback({ messages: USER_MESSAGE })).rejects.toThrow(
      'anna: Anna LLM returned no content: the model spent 4096',
    );
  });

  it('still reports the runtime as unavailable when no host is present', async () => {
    withEnv({ VITE_CLINE_PROXY: 'false' });
    mockedRuntime.mockResolvedValue(null);

    await expect(completeWithFallback({ messages: USER_MESSAGE })).rejects.toThrow(
      'anna: Anna runtime unavailable',
    );
  });
});