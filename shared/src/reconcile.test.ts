import { describe, expect, it } from 'vitest';
import { changedSince, chunkBySize, isNewer, mergeElements } from './reconcile.js';

const el = (id: string, version: number, versionNonce = 0) => ({ id, version, versionNonce });

describe('isNewer', () => {
  it('accepts anything when there is no existing element', () => {
    expect(isNewer(el('a', 1), undefined)).toBe(true);
  });

  it('prefers the higher version', () => {
    expect(isNewer(el('a', 3), el('a', 2))).toBe(true);
    expect(isNewer(el('a', 2), el('a', 3))).toBe(false);
  });

  it('breaks version ties with the lower nonce', () => {
    expect(isNewer(el('a', 2, 5), el('a', 2, 9))).toBe(true);
    expect(isNewer(el('a', 2, 9), el('a', 2, 5))).toBe(false);
    expect(isNewer(el('a', 2, 5), el('a', 2, 5))).toBe(false);
  });
});

describe('mergeElements', () => {
  it('converges regardless of arrival order', () => {
    const base = [el('a', 1), el('b', 1)];
    const u1 = [el('a', 2, 10)];
    const u2 = [el('a', 2, 3), el('c', 1)];

    const order1 = mergeElements(mergeElements(base, u1).merged, u2).merged;
    const order2 = mergeElements(mergeElements(base, u2).merged, u1).merged;

    const norm = (xs: typeof base) => [...xs].sort((x, y) => x.id.localeCompare(y.id));
    expect(norm(order1)).toEqual(norm(order2));
    expect(order1.find((x) => x.id === 'a')).toEqual(el('a', 2, 3));
  });

  it('reports accepted and rejected elements', () => {
    const { accepted, rejected } = mergeElements([el('a', 5)], [el('a', 4), el('b', 1)]);
    expect(accepted.map((x) => x.id)).toEqual(['b']);
    expect(rejected.map((x) => x.id)).toEqual(['a']);
  });
});

describe('changedSince', () => {
  it('returns elements that are new or moved past the synced version', () => {
    const synced = new Map([
      ['a', 2],
      ['b', 4],
    ]);
    const result = changedSince([el('a', 3), el('b', 4), el('c', 1)], synced);
    expect(result.map((x) => x.id)).toEqual(['a', 'c']);
  });
});

describe('chunkBySize', () => {
  it('respects the count limit', () => {
    const chunks = chunkBySize([1, 2, 3, 4, 5], 2, 1_000_000);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('respects the byte limit but never produces empty chunks', () => {
    const big = 'x'.repeat(100);
    const chunks = chunkBySize([big, big, big], 100, 150);
    expect(chunks).toHaveLength(3);
  });
});
