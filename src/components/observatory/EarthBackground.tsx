import React, { useCallback, useEffect, useState } from 'react';
import earthLoopSrc from '@/assets/earth-loop.mp4';

interface EarthBackgroundProps {
  scale: number;
  y: number;
}

const EARTH_VIDEO_TYPE = 'video/mp4';

/**
 * Parallax Earth layer: the rotating globe anchored behind the hero band.
 *
 * The clip is **bundled**, never remote. Two host-side rules shape how it is
 * loaded, and both fail silently against a plain `<video src="…">`:
 *
 * 1. `media-src 'self' blob:` — an off-origin `<video>` (the CloudFront URL
 *    this component used to point at) is blocked by the document CSP before the
 *    request leaves the iframe, so the hero simply loses the globe. `vite dev`
 *    and the local harness send no CSP at all, which is why the earth only went
 *    missing once the app ran inside the store build.
 * 2. The publish pipeline's MIME table has no `mp4` entry (`CONTENT_TYPES` in
 *    `@anna-ai/cli`), so a bundled `.mp4` is stored — and served — as
 *    `application/octet-stream`. Chromium refuses to demux a media resource
 *    with an unknown type, and the `type` attribute on a `<source>` is only a
 *    candidate hint, so it cannot rescue that load.
 *
 * The load therefore walks a small ladder: try the bundled asset directly (it
 * streams progressively and is correct whenever the host reports a real video
 * MIME), and on `error` re-read the same bytes over `fetch` and hand the media
 * element a `Blob` wrapped in `video/mp4`, which `media-src blob:` allows. Only
 * if both routes fail is the decoration dropped, so the hero degrades to its
 * copy instead of an empty box.
 *
 * See README → "Anna Runtime Integration" for the CSP contract.
 */
export const EarthBackground: React.FC<EarthBackgroundProps> = ({ scale, y }) => {
  const [mode, setMode] = useState<'direct' | 'blob' | 'unavailable'>('direct');
  const [blobSrc, setBlobSrc] = useState<string | null>(null);

  const handleError = useCallback(() => {
    if (mode === 'direct') {
      // Not fatal: the bytes may be fine and merely mislabelled by the host.
      setMode('blob');
      return;
    }
    console.warn('[earth] background clip could not be decoded; hero renders without the globe layer');
    setMode('unavailable');
  }, [mode]);

  useEffect(() => {
    if (mode !== 'blob') return;

    let cancelled = false;
    let objectUrl: string | null = null;

    void (async () => {
      try {
        const res = await fetch(earthLoopSrc);
        if (!res.ok) throw new Error(`GET ${earthLoopSrc} → ${res.status}`);
        const raw = await res.blob();
        // Re-label the bytes when the host did not report a video type.
        const typed = raw.type === EARTH_VIDEO_TYPE ? raw : raw.slice(0, raw.size, EARTH_VIDEO_TYPE);
        objectUrl = URL.createObjectURL(typed);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setBlobSrc(objectUrl);
      } catch (err) {
        if (cancelled) return;
        console.warn('[earth] background clip could not be read; hero renders without the globe layer', err);
        setMode('unavailable');
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mode]);

  if (mode === 'unavailable') return null;

  // In blob mode the element is withheld until the bytes are in hand, so the
  // hero never flashes an undecodable frame.
  const src = mode === 'blob' ? blobSrc : earthLoopSrc;
  if (!src) return null;

  return (
    <>
      <video
        className="page-background-video"
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        onError={handleError}
        style={
          {
            '--earth-scale': scale,
            '--earth-y': `${y}px`,
          } as React.CSSProperties
        }
      />
      <div className="earth-side-mask" aria-hidden="true" />
    </>
  );
};

