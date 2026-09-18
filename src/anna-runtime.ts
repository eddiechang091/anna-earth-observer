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
  /**
   * `tools.*` is a single-object RPC surface generated from the SDK's
   * `Proxy`, so the host schema is `{ tool_id (required), method?, args?,
   * timeoutMs? }` with `additionalProperties: false`. A positional
   * `(toolId, method, args)` call sends the tool id as the whole argument
   * object and is rejected with `invalid_arg`.
   */
  tools: {
    invoke(params: {
      tool_id: string;
      method?: string | null;
      args?: Record<string, unknown>;
      timeoutMs?: number;
    }): Promise<unknown>;
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

/**
 * The host serves the runtime SDK as a native ES module at this path, and the
 * bundle CSP already allow-lists its origin for `script-src`.
 *
 * It must be reached with a genuine `import()`. The bundle CSP carries no
 * `'unsafe-eval'`, so the `Function("u", "return import(u)")` indirection this
 * replaced threw `EvalError` before the `window.hello` handshake ever left the
 * iframe — and, because the failure was swallowed, it presented as "running in
 * standalone mode" *inside* the Anna host with no failed request to inspect.
 */
const ANNA_SDK_URL = '/static/anna-apps/_sdk/latest/index.js';

/**
 * `<bundle>/anna-tool-ids.js` — written into the bundle by
 * `anna-app apps publish` / `push`, not by the Vite build. It maps the
 * `app.json` `bundled_executas` handles onto the server-minted tool_ids that
 * `manifest.ui.host_api.tools` is keyed on (publish rewrites `bundled:<handle>`
 * to the minted id), so it has to be in scope before the first `tools.invoke`.
 * Standalone dev has no such file and must not fail the connection over it.
 */
const TOOL_ID_SIDECAR = 'anna-tool-ids.js';

let _promise: Promise<AnnaRuntime | null> | null = null;

/** Reason the last connection attempt failed; `null` once one succeeds. */
let _lastError: string | null = null;

/**
 * Why the host handshake failed, when it did. The UI degrades to "standalone
 * mode" on a null runtime, so keeping the cause around is the difference
 * between a diagnosable failure and an invisible one.
 */
export function getAnnaRuntimeError(): string | null {
  return _lastError;
}

/**
 * Load the CLI-generated sidecar of minted tool ids as a classic same-origin
 * script. A `<script>` tag is used rather than a build-time import because the
 * file is produced after `vite build`; failures are ignored so standalone dev
 * (where the file does not exist) still connects to nothing rather than
 * crashing.
 */
function loadToolIdSidecar(): Promise<void> {
  if (window.__ANNA_TOOL_IDS__) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = new URL(TOOL_ID_SIDECAR, document.baseURI).href;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

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
        // `@vite-ignore` keeps the URL literal in the emitted bundle: the SDK is
        // fetched from the host at runtime and must never be resolved, inlined
        // or preloaded by the bundler.
        const mod = (await import(/* @vite-ignore */ ANNA_SDK_URL)) as AnnaModule;
        const runtime = await mod.AnnaAppRuntime.connect();
        // Best-effort, and deliberately after `connect()`: the sidecar only
        // exists in a published bundle, and `getToolId` is only reached once a
        // runtime is in hand.
        await loadToolIdSidecar();
        // Registration is best-effort: a host that rejects `window.ready` still
        // serves `llm.*` and `tools.*`, so never fail the connection over it.
        try {
          await runtime.window?.ready({});
        } catch {
          /* non-fatal */
        }
        _lastError = null;
        return runtime;
      } catch (error) {
        // Standalone (plain `vite` dev server), or the host handshake was not
        // available yet. Never cached: `main.tsx` fires one connect attempt at
        // startup, and a container that mounts the iframe before its `wid`/`t`
        // parameters exist would otherwise disable the LLM and tool channels
        // for the rest of the session.
        _lastError = error instanceof Error ? error.message : String(error);
        // A CSP-blocked loader, a missing `wid`/`t` pair and a genuine
        // "no host" all end up here, so name the cause instead of hiding it.
        console.warn('[anna-runtime] host connection failed:', _lastError);
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

/**
 * The tool id to hand to `tools.invoke`.
 *
 * `apps publish` rewrites every `bundled:<handle>` reference in the manifest to
 * the server-minted id, and the two-layer `tools.*` ACL matches the invoked
 * `tool_id` against `manifest.ui.host_api.tools`. The minted id is only
 * knowable at publish time, so the literal handle is never a valid runtime
 * value — the sidecar is the only correct source. Outside a published bundle
 * (the `anna-app dev` harness, plain `vite`) the declared
 * `executa.json` tool id is what the local registration answers to.
 */
export function getToolId(handle: string, devFallback: string): string {
  const sidecar = window.__ANNA_TOOL_IDS__?.[handle];
  if (typeof sidecar === 'string' && sidecar.length > 0) return sidecar;
  return devFallback;
}
