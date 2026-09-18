/**
 * `getToolId` feeds `anna.tools.invoke({ tool_id })`, and the host checks that
 * value against `manifest.ui.host_api.tools` — which `anna-app apps publish`
 * rewrites from `bundled:<handle>` to the server-minted id. So the publish-time
 * sidecar must win, and the literal handle must never be returned: it matches
 * nothing in the published ACL and the call dies with `permission_denied`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getToolId } from '@/anna-runtime';

const MINTED = 'tool-eddie091-earth-data-ghq33rnq';
const DECLARED = 'tool-dev-earth-data';

describe('getToolId', () => {
  beforeEach(() => {
    delete window.__ANNA_TOOL_IDS__;
  });

  it('prefers the sidecar written at publish time', () => {
    window.__ANNA_TOOL_IDS__ = { 'earth-data': MINTED };

    expect(getToolId('earth-data', DECLARED)).toBe(MINTED);
  });

  it('falls back to the declared tool id outside a published bundle', () => {
    expect(getToolId('earth-data', DECLARED)).toBe(DECLARED);
  });

  it('ignores an empty sidecar entry', () => {
    window.__ANNA_TOOL_IDS__ = { 'earth-data': '' };

    expect(getToolId('earth-data', DECLARED)).toBe(DECLARED);
  });

  it('never returns a bundled: handle the published ACL cannot match', () => {
    expect(getToolId('earth-data', DECLARED)).not.toContain('bundled:');
  });
});