/**
 * Anna host LLM primary path (`src/lib/llm.ts` → `runtime.llm.complete`).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAnnaRuntime, llmContentText, type AnnaRuntime } from '@/anna-runtime';
import { ANNA_MAX_TOKENS_CAP, completeWithFallback } from '@/lib/llm';

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
      invoke: async () => ({ success: false, error: 'Tools not used in these tests.' }),
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

afterEach(() => {
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
    const calls = stubAnnaRuntime({ content: { type: 'text', text: 'ok' } });

    await completeWithFallback({ messages: USER_MESSAGE, maxTokens: 8192 });

    expect(calls[0].maxTokens).toBe(ANNA_MAX_TOKENS_CAP);
  });

  it('keeps a smaller caller budget untouched and omits undefined temperature', async () => {
    const calls = stubAnnaRuntime({ content: { type: 'text', text: 'ok' } });

    await completeWithFallback({ messages: USER_MESSAGE, maxTokens: 512 });

    expect(calls[0].maxTokens).toBe(512);
    expect(calls[0]).not.toHaveProperty('temperature');
  });

  it('throws when Anna returns empty content', async () => {
    stubAnnaRuntime({
      content: { type: 'text', text: '' },
      stopReason: 'endTurn',
      usage: { outputTokens: 4097 },
    });

    await expect(completeWithFallback({ messages: USER_MESSAGE })).rejects.toThrow(
      'anna: Anna LLM returned no content: the model spent 4097',
    );
  });

  it('throws when Anna budget is exhausted', async () => {
    stubAnnaRuntime({ content: { type: 'text', text: '' }, usage: { outputTokens: 4096 } });

    await expect(completeWithFallback({ messages: USER_MESSAGE })).rejects.toThrow(
      'anna: Anna LLM returned no content: the model spent 4096',
    );
  });

  it('throws when no Anna host is present', async () => {
    mockedRuntime.mockResolvedValue(null);

    await expect(completeWithFallback({ messages: USER_MESSAGE })).rejects.toThrow(
      'anna: Anna runtime unavailable',
    );
  });
});