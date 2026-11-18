import { describe, expect, it } from 'vitest';
import { LIMITS } from '@syncboard/shared';
import { applyElements, loadElements } from '../src/services/sceneService.js';
import { element } from './helpers.js';

describe('applyElements', () => {
  it('accepts new elements and newer versions', async () => {
    const res = await applyElements('SCENE001', [element('a', 1), element('b', 1)]);
    expect(res.accepted.map((e) => e.id)).toEqual(['a', 'b']);
    const next = await applyElements('SCENE001', [element('a', 2)]);
    expect(next.accepted).toHaveLength(1);
    expect((await loadElements('SCENE001')).find((e) => e.id === 'a')?.version).toBe(2);
  });

  it('rejects stale versions and returns the current copy', async () => {
    await applyElements('SCENE002', [element('a', 5)]);
    const res = await applyElements('SCENE002', [element('a', 3)]);
    expect(res.accepted).toHaveLength(0);
    expect(res.current).toHaveLength(1);
    expect(res.current[0]!.version).toBe(5);
  });

  it('breaks version ties with the lower nonce, matching the client rule', async () => {
    await applyElements('SCENE003', [element('a', 2, { versionNonce: 50 })]);
    const higher = await applyElements('SCENE003', [element('a', 2, { versionNonce: 90 })]);
    expect(higher.accepted).toHaveLength(0);
    const lower = await applyElements('SCENE003', [element('a', 2, { versionNonce: 10 })]);
    expect(lower.accepted).toHaveLength(1);
  });

  it('drops oversized elements without failing the batch', async () => {
    const huge = element('big', 1, { points: 'x'.repeat(LIMITS.ELEMENT_BYTES_MAX) });
    const res = await applyElements('SCENE004', [huge, element('ok', 1)]);
    expect(res.dropped).toBe(1);
    expect(res.accepted.map((e) => e.id)).toEqual(['ok']);
  });

  it('keeps concurrent writers consistent', async () => {
    const writers = Array.from({ length: 10 }, (_, i) => applyElements('SCENE005', [element('x', i + 1)]));
    await Promise.all(writers);
    expect((await loadElements('SCENE005'))[0]!.version).toBe(10);
  });
});
