/** Singleton Anna runtime — connects once and shares across the app. */

export type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | { type: 'text'; text: string };
};

/**
 * MCP-shaped `llm.complete` content (Host API reference `llm.*`). The host
 * answers `content: {type:'text', text}`; a bare string (older host, test
 * double) and a content-block array are also accepted.
 *
 * An empty `text` on a *successful* RPC is a legitimate reply, not an error:
 * a reasoning-capable model can burn the entire output budget on hidden
 * reasoning and return `{type:'text', text:''}` with
 * `stopReason: 'endTurn'`. Callers MUST treat that as a failure.
 */
export type AnnaLlmContent =
  | string
  | { type?: string; text?: unknown }
  | Array<{ type?: string; text?: unknown }>;

export type AnnaLlmCompletion = {
  content?: AnnaLlmContent;
  model?: string;
  stopReason?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  _meta?: Record<string, unknown>;
};

export type AnnaRuntime = {
  window: { ready(o: Record<string, unknown>): Promise<void> };
  tools: {
    invoke(
      toolId: string,
      method: string,
      args: Record<string, unknown>,
    ): Promise<unknown>;
  };
  llm: {
    /**
     * Stateless single-shot completion against the user's provider. The field
     * is `maxTokens` (NOT the OpenAI `max_tokens` spelling) and the dispatcher
     * silently clamps it to the install grant's `max_tokens_per_call`.
     */
    complete(params: {
      messages: LLMMessage[];
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      modelPreferences?: Record<string, unknown>;
    }): Promise<AnnaLlmCompletion>;
  };
};

type AnnaModule = { AnnaAppRuntime: { connect(): Promise<AnnaRuntime> } };

let _promise: Promise<AnnaRuntime | null> | null = null;

/**
 * Text out of a host completion. Tolerant on purpose: the documented shape is
 * `content: {type:'text', text}`, but a bare string and a content-block array
 * are accepted too. Trimmed — an empty result means "no visible answer".
 */
export function llmContentText(response: unknown): string {
  const content = (response as { content?: unknown } | null | undefined)?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        const text = (block as { text?: unknown } | null)?.text;
        return typeof text === 'string' ? text : '';
      })
      .join('')
      .trim();
  }
  if (content && typeof content === 'object') {
    const text = (content as { text?: unknown }).text;
    if (typeof text === 'string') return text.trim();
  }
  return '';
}

/** Drops the cached connection so the next caller retries the host handshake. */
export function resetAnnaRuntime(): void {
  _promise = null;
}

export function getAnnaRuntime(): Promise<AnnaRuntime | null> {
  if (!_promise) {
    _promise = (async (): Promise<AnnaRuntime | null> => {
      try {
        // Function() escapes both TS module resolution and Vite bundling.
        const load = new Function("u", "return import(u)") as (
          u: string,
        ) => Promise<AnnaModule>;
        const { AnnaAppRuntime } = await load(
          "/static/anna-apps/_sdk/latest/index.js",
        );
        const runtime = await AnnaAppRuntime.connect();
        // Registration is best-effort: a host that rejects `window.ready` still
        // serves `llm.*` and `tools.*`, so never fail the connection over it.
        try {
          await runtime.window?.ready({});
        } catch {
          /* non-fatal */
        }
        return runtime;
      } catch {
        // Standalone (plain `vite` dev server), or the host handshake was not
        // available yet. Never cached: `main.tsx` fires one connect attempt at
        // startup, and a container that mounts the iframe before its `wid`/`t`
        // parameters exist would otherwise disable the LLM and tool channels
        // for the rest of the session.
        resetAnnaRuntime();
        return null;
      }
    })();
  }
  return _promise;
}

/** Tool ID resolved from the Anna-generated sidecar, with a dev fallback. */
declare global {
  interface Window {
    __ANNA_TOOL_IDS__?: Record<string, string>;
  }
}

export function getToolId(handle: string, devFallback: string): string {
  // Prefer the Anna-generated sidecar produced at publish/push time.
  const sidecar = window.__ANNA_TOOL_IDS__?.[handle];
  if (typeof sidecar === 'string' && sidecar.length > 0) return sidecar;
  // The dispatcher also resolves bundled handles directly, which is what
  // `useEarthData` already passes. Returning the canonical handle keeps both
  // data fetch and LLM proxy on the same resolution path.
  if (handle === 'earth-data') return 'bundled:earth-data';
  return devFallback;
}
