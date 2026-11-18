import { describe, expect, it } from 'vitest';
import { getTemplate, TEMPLATES } from './templates';

describe('lesson templates', () => {
  it('have unique ids', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s builds valid skeletons', (_id, template) => {
    const skeletons = template.build();
    expect(skeletons.length).toBeGreaterThan(0);
    for (const s of skeletons) {
      expect(typeof s.type).toBe('string');
      expect(Number.isFinite(s.x)).toBe(true);
      expect(Number.isFinite(s.y)).toBe(true);
    }
  });

  it('builds a fresh copy each time', () => {
    const t = getTemplate('coordinate-plane')!;
    expect(t.build()).not.toBe(t.build());
  });

  it('returns null for unknown ids', () => {
    expect(getTemplate('nope')).toBeNull();
  });
});
