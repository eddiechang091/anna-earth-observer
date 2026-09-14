/** Singleton Anna runtime — connects once and shares across the app. */

type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | { type: 'text'; text: string };
};

type AnnaRuntime = {
  window: { ready(o: Record<string, unknown>): Promise<void> };
  tools: {
    invoke(args: {
      tool_id: string;
      method?: string;
      args?: Record<string, unknown>;
      timeoutMs?: number;
    }): Promise<unknown>;
  };
  llm: {
    complete(params: {
      messages: LLMMessage[];
      maxTokens?: number;
      temperature?: number;
    }): Promise<{
      role: 'assistant';
      content: string | { type: 'text'; text: string };
      model?: string;
      stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
      usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
    }>;
  };
};

type AnnaModule = { AnnaAppRuntime: { connect(): Promise<AnnaRuntime> } };

let _promise: Promise<AnnaRuntime | null> | null = null;

export function getAnnaRuntime(): Promise<AnnaRuntime | null> {
  if (!_promise) {
    _promise = (async (): Promise<AnnaRuntime | null> => {
      try {
        // Variable indirection prevents TS module-resolution and avoids unsafe-eval.
        const sdkUrl: string = "/static/anna-apps/_sdk/latest/index.js";
        console.log('[Anna SDK] Attempting to load:', sdkUrl);
        const { AnnaAppRuntime } = (await import(/* @vite-ignore */ sdkUrl)) as AnnaModule;
        console.log('[Anna SDK] Loaded successfully, connecting...');
        const runtime = await AnnaAppRuntime.connect();
        console.log('[Anna SDK] Connected, calling window.ready()...');
        await runtime.window.ready({});
        console.log('[Anna SDK] Ready complete — runtime initialized');
        return runtime;
      } catch (error) {
        console.error('[Anna SDK] Failed to initialize:', error instanceof Error ? error.message : String(error));
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
  return window.__ANNA_TOOL_IDS__?.[handle] ?? devFallback;
}
