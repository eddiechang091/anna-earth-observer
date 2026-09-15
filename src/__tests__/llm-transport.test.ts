/**
 * Cline backup transport selection (`src/lib/llm.ts`).
 *
 * Three transports, tried in order: the Anna/Executa proxy (default on, but
 * only usable inside the Anna host), the local dev-server relay, and a
 * key-bearing browser call. These tests pin the env-driven selection so a
 * local setup keeps working after refactors.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  clineBrowserTransport,
  clineConfigured,
  DEFAULT_CLINE_MODEL,
} from '@/lib/llm';

const ENV_KEYS = [
  'VITE_CLINE_PROXY',
  'VITE_CLINE_RELAY',
  'VITE_CLINE_DIRECT',
  'VITE_CLINE_API_KEY',
  'VITE_CLINE_BASE_URL',
  'VITE_CLINE_MODEL',
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
});

function withEnv(overrides: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    saved.set(key, (import.meta.env as unknown as Record<string, string | undefined>)[key]);
    setEnv(key, undefined);
  }
  for (const [key, value] of Object.entries(overrides)) setEnv(key, value);
}

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
