/** Singleton Anna runtime — connects once and shares across the app. */

export type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | { type: 'text'; text: string };
};

type AnnaRuntime = {
  window: { ready(o: Record<string, unknown>): Promise<void> };
  tools: {
    invoke(
      toolId: string,
      method: string,
      args: Record<string, unknown>,
    ): Promise<unknown>;
  };
  llm: {
    complete(params: {
      messages: LLMMessage[];
      max_tokens?: number;
      temperature?: number;
    }): Promise<{ content: string }>;
  };
};

type AnnaModule = { AnnaAppRuntime: { connect(): Promise<AnnaRuntime> } };

let _promise: Promise<AnnaRuntime | null> | null = null;

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
        await runtime.window.ready({});
        return runtime;
      } catch {
        return null; // running standalone outside the Anna host
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
