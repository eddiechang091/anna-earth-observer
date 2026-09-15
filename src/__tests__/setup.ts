/**
 * jsdom lacks a few browser APIs that the observatory UI touches.
 * Keep stubs minimal and only for what the component tests actually need.
 */

import { beforeEach, vi } from 'vitest';

// `anna-runtime` imports the Anna host SDK via an absolute URL — stub the
// module before any component under test pulls it in.
vi.mock('@/anna-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/anna-runtime')>();
  return {
    ...actual,
    getAnnaRuntime: vi.fn(async () => null),
  };
});

// Each test starts with a clean module registry so one test's proxy/on-off
// flags cannot leak into the next via the cached `@/lib/llm` module.
beforeEach(() => {
  vi.resetModules();
});

// Leaflet and layout code observe element resizes.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
