/**
 * Earth parallax layer.
 *
 * The rotating earth is the app's only heavy decoration, and it disappeared
 * silently in the store build: the clip lived on a CloudFront bucket and the
 * host's document CSP (`media-src 'self' blob:`) blocked it before the request
 * left the iframe, while the local dev server — which sends no CSP — showed it
 * happily. These tests pin the load ladder that replaced it (bundled asset
 * first, then the same bytes re-wrapped as a typed blob) and the
 * drop-to-nothing behaviour when neither route works.
 */

import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EarthBackground } from '@/components/observatory/EarthBackground';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function renderLayer() {
  const view = render(<EarthBackground scale={0.5} y={12} />);
  return { ...view, video: () => view.container.querySelector('video') };
}

function stubObjectUrls() {
  const created: Blob[] = [];
  const createObjectURL = vi.fn((blob: Blob) => {
    created.push(blob);
    return 'blob:earth-layer';
  });
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
  return { created, createObjectURL };
}

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.restoreAllMocks();
});

describe('EarthBackground', () => {
  it('plays the bundled clip from the app origin', () => {
    const { container, video } = renderLayer();
    const el = video()!;

    expect(el).toBeTruthy();
    // CSP is `media-src 'self' blob:` — a remote URL is blocked inside the host.
    expect(el.getAttribute('src')).toMatch(/earth-loop.*\.mp4$/);
    expect(el.getAttribute('src')).not.toMatch(/^https?:/);
    expect(el.autoplay).toBe(true);
    expect(el.muted).toBe(true);
    expect(el.loop).toBe(true);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.style.getPropertyValue('--earth-y')).toBe('12px');
    expect(el.style.getPropertyValue('--earth-scale')).toContain('0.5');
    expect(container.querySelector('.earth-side-mask')).toBeTruthy();
  });

  it('reserves its own layer so hero content keeps stacking above it', () => {
    const { container } = renderLayer();
    expect(container.querySelector('.page-background-video')).toBeTruthy();
  });

  it('re-reads a mislabelled clip as a typed blob', async () => {
    const { created, createObjectURL } = stubObjectUrls();
    // The publish pipeline has no MIME entry for mp4, so the host serves it as
    // application/octet-stream — the exact case that needs re-labelling.
    const raw = new Blob(['fake-mp4-bytes'], { type: 'application/octet-stream' });
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, blob: async () => raw }));
    vi.stubGlobal('fetch', fetchMock);

    const { video } = renderLayer();
    const directSrc = video()!.getAttribute('src')!;

    fireEvent.error(video()!);

    await waitFor(() => expect(video()!.getAttribute('src')).toBe('blob:earth-layer'));
    expect(fetchMock).toHaveBeenCalledWith(directSrc);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(created[0].type).toBe('video/mp4');
  });

  it('keeps a correctly typed clip as-is', async () => {
    const { created } = stubObjectUrls();
    const raw = new Blob(['fake-mp4-bytes'], { type: 'video/mp4' });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, blob: async () => raw })));

    const { video } = renderLayer();
    fireEvent.error(video()!);

    await waitFor(() => expect(video()!.getAttribute('src')).toBe('blob:earth-layer'));
    expect(created[0]).toBe(raw);
  });

  it('drops the layer when neither route yields a decodable clip', async () => {
    stubObjectUrls();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, blob: async () => new Blob([]) })));

    const { container, video } = renderLayer();
    fireEvent.error(video()!);

    await waitFor(() => expect(container.querySelector('video')).toBeNull());
    // The mask is only meaningful under the globe, so it goes with it.
    expect(container.querySelector('.earth-side-mask')).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
