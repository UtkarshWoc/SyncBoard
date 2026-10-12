import { describe, expect, it } from 'vitest';
import { convertStroke } from '../scripts/migrate-legacy-rooms.js';

describe('legacy stroke conversion', () => {
  it('turns pencil strokes into freedraw elements with relative points', () => {
    const el = convertStroke({
      tool: 'pencil',
      color: '#FF2D2D',
      lineWidth: 4,
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 25 },
      ],
    });
    expect(el).toMatchObject({
      type: 'freedraw',
      x: 10,
      y: 20,
      width: 20,
      height: 5,
      strokeColor: '#FF2D2D',
      strokeWidth: 2,
    });
    expect(el?.points).toEqual([
      [0, 0],
      [20, 5],
    ]);
  });

  it('normalises rectangles drawn right-to-left', () => {
    const el = convertStroke({ tool: 'rectangle', startX: 100, startY: 80, endX: 40, endY: 20 });
    expect(el).toMatchObject({ type: 'rectangle', x: 40, y: 20, width: 60, height: 60 });
  });

  it('maps v1 white ink to the default ink so it shows in both themes', () => {
    expect(convertStroke({ tool: 'line', color: '#FFFFFF', startX: 0, startY: 0, endX: 5, endY: 5 })?.strokeColor).toBe(
      '#1e1e1e',
    );
  });

  it('skips eraser strokes and degenerate input', () => {
    expect(
      convertStroke({
        tool: 'eraser',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      }),
    ).toBeNull();
    expect(convertStroke({ tool: 'pencil', points: [{ x: 0, y: 0 }] })).toBeNull();
  });
});
