import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';

/**
 * Lesson templates for tutoring. Each builds Excalidraw element skeletons
 * around (0, 0); they are converted and centred on the viewport on insert.
 */

const INK = '#1e1e1e';
const MUTED = '#adb5bd';
const ACCENT = '#e03131';
const BLUE = '#1971c2';
const GREEN = '#2f9e44';

type Skeleton = ExcalidrawElementSkeleton;

const text = (x: number, y: number, value: string, extra: Partial<Record<string, unknown>> = {}): Skeleton =>
  ({ type: 'text', x, y, text: value, fontSize: 20, strokeColor: INK, ...extra }) as Skeleton;

const line = (x1: number, y1: number, x2: number, y2: number, extra: Partial<Record<string, unknown>> = {}): Skeleton =>
  ({
    type: 'line',
    x: x1,
    y: y1,
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    strokeColor: INK,
    strokeWidth: 1,
    roughness: 0,
    ...extra,
  }) as Skeleton;

const arrow = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  extra: Partial<Record<string, unknown>> = {},
): Skeleton =>
  ({
    type: 'arrow',
    x: x1,
    y: y1,
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    strokeColor: INK,
    strokeWidth: 2,
    roughness: 0,
    startArrowhead: null,
    endArrowhead: 'arrow',
    ...extra,
  }) as Skeleton;

const box = (
  x: number,
  y: number,
  width: number,
  height: number,
  label?: string,
  extra: Partial<Record<string, unknown>> = {},
): Skeleton =>
  ({
    type: 'rectangle',
    x,
    y,
    width,
    height,
    strokeColor: INK,
    roughness: 0,
    roundness: { type: 3 },
    ...(label ? { label: { text: label, fontSize: 20, verticalAlign: 'top' } } : {}),
    ...extra,
  }) as Skeleton;

const heading = (x: number, y: number, value: string) => text(x, y, value, { fontSize: 32, strokeColor: ACCENT });

function coordinatePlane(): Skeleton[] {
  const step = 40;
  const n = 10;
  const extent = step * n;
  const out: Skeleton[] = [];
  for (let i = -n; i <= n; i++) {
    if (i === 0) continue;
    out.push(line(i * step, -extent, i * step, extent, { strokeColor: MUTED, opacity: 60 }));
    out.push(line(-extent, i * step, extent, i * step, { strokeColor: MUTED, opacity: 60 }));
    if (i % 2 === 0) {
      out.push(text(i * step - 8, 8, String(i), { fontSize: 14, strokeColor: '#495057' }));
      out.push(text(10, -i * step - 9, String(i), { fontSize: 14, strokeColor: '#495057' }));
    }
  }
  out.push(arrow(-extent - 20, 0, extent + 30, 0), arrow(0, extent + 20, 0, -extent - 30));
  out.push(text(extent + 36, -12, 'x', { fontSize: 24 }), text(10, -extent - 60, 'y', { fontSize: 24 }));
  return out;
}

function numberLine(): Skeleton[] {
  const step = 60;
  const n = 10;
  const out: Skeleton[] = [arrow(-n * step - 40, 0, n * step + 40, 0, { startArrowhead: 'arrow' })];
  for (let i = -n; i <= n; i++) {
    const major = i % 5 === 0;
    out.push(line(i * step, major ? -16 : -10, i * step, major ? 16 : 10, { strokeWidth: major ? 2 : 1 }));
    out.push(text(i * step - String(i).length * 5, 24, String(i), { fontSize: major ? 20 : 16 }));
  }
  return out;
}

function lessonPlan(): Skeleton[] {
  const w = 520;
  const sections: [string, number][] = [
    ['🎯 Learning objective', 110],
    ['🔥 Warm-up (5 min)', 140],
    ['📖 Explain & model', 220],
    ['✏️ Guided practice', 220],
    ['🚪 Exit ticket', 140],
  ];
  const out: Skeleton[] = [heading(-w, -470, 'Lesson plan')];
  let y = -400;
  sections.forEach(([title, h], i) => {
    const x = i < 3 ? -w - 20 : 20;
    if (i === 3) y = -400;
    out.push(box(x, y, w, h, title));
    y += h + 24;
  });
  out.push(box(20, y, w, 140, '📝 Notes for next session', { strokeColor: BLUE }));
  return out;
}

function cornellNotes(): Skeleton[] {
  return [
    heading(-400, -470, 'Topic:'),
    text(80, -455, 'Date:', { fontSize: 20, strokeColor: '#495057' }),
    box(-400, -400, 240, 560, 'Questions / cues', { strokeColor: BLUE }),
    box(-140, -400, 540, 560, 'Notes'),
    box(-400, 180, 800, 180, 'Summary — in your own words', { strokeColor: GREEN }),
  ];
}

function vennDiagram(): Skeleton[] {
  return [
    heading(-150, -330, 'Compare & contrast'),
    {
      type: 'ellipse',
      x: -380,
      y: -240,
      width: 460,
      height: 460,
      strokeColor: BLUE,
      backgroundColor: '#a5d8ff',
      fillStyle: 'solid',
      opacity: 45,
      roughness: 0,
    } as Skeleton,
    {
      type: 'ellipse',
      x: -80,
      y: -240,
      width: 460,
      height: 460,
      strokeColor: ACCENT,
      backgroundColor: '#ffc9c9',
      fillStyle: 'solid',
      opacity: 45,
      roughness: 0,
    } as Skeleton,
    text(-300, -200, 'A only', { fontSize: 24, strokeColor: BLUE }),
    text(-35, -200, 'Both', { fontSize: 24 }),
    text(200, -200, 'B only', { fontSize: 24, strokeColor: ACCENT }),
  ];
}

function homeworkBoard(): Skeleton[] {
  const cols: [string, string][] = [
    ['To do', '#ffec99'],
    ['Working on it', '#a5d8ff'],
    ['Done ✅', '#b2f2bb'],
  ];
  const out: Skeleton[] = [heading(-520, -420, 'Homework tracker')];
  cols.forEach(([title, color], i) => {
    const x = -520 + i * 360;
    out.push(box(x, -350, 330, 620, title, { strokeColor: '#495057' }));
    if (i === 0) {
      out.push(
        box(x + 20, -290, 290, 90, 'Worksheet p. 12 Q1–8', {
          backgroundColor: color,
          fillStyle: 'solid',
          strokeColor: color,
        }),
        box(x + 20, -180, 290, 90, 'Read chapter 4', {
          backgroundColor: color,
          fillStyle: 'solid',
          strokeColor: color,
        }),
      );
    }
  });
  return out;
}

function problemSet(): Skeleton[] {
  const out: Skeleton[] = [heading(-520, -470, 'Practice problems')];
  for (let i = 0; i < 4; i++) {
    const x = i % 2 === 0 ? -520 : 20;
    const y = i < 2 ? -400 : 0;
    out.push(box(x, y, 500, 370, `Problem ${i + 1}`));
    out.push(text(x + 16, y + 300, 'Answer: ______', { fontSize: 18, strokeColor: '#495057' }));
  }
  return out;
}

function fractionBars(): Skeleton[] {
  const width = 720;
  const height = 56;
  const colors = ['#ffc9c9', '#ffd8a8', '#ffec99', '#b2f2bb', '#a5d8ff', '#d0bfff'];
  const out: Skeleton[] = [heading(-width / 2, -280, 'Fraction bars')];
  [1, 2, 3, 4, 6, 8].forEach((parts, row) => {
    const y = -210 + row * (height + 14);
    const w = width / parts;
    for (let p = 0; p < parts; p++) {
      out.push(
        box(-width / 2 + p * w, y, w, height, undefined, {
          backgroundColor: colors[row],
          fillStyle: 'solid',
          roundness: null,
          label: { text: parts === 1 ? '1' : `1/${parts}`, fontSize: 18 },
        }),
      );
    }
  });
  return out;
}

export const TEMPLATES = [
  {
    id: 'coordinate-plane',
    name: 'Coordinate plane',
    emoji: '📈',
    description: 'x/y axes from −10 to 10 with gridlines',
    build: coordinatePlane,
  },
  { id: 'number-line', name: 'Number line', emoji: '↔️', description: 'Integers from −10 to 10', build: numberLine },
  {
    id: 'fraction-bars',
    name: 'Fraction bars',
    emoji: '🍫',
    description: 'Wholes, halves, thirds, quarters, sixths, eighths',
    build: fractionBars,
  },
  {
    id: 'problem-set',
    name: 'Practice problems',
    emoji: '✏️',
    description: 'Four work areas with answer lines',
    build: problemSet,
  },
  {
    id: 'lesson-plan',
    name: 'Lesson plan',
    emoji: '🗂️',
    description: 'Objective, warm-up, explain, practice, exit ticket',
    build: lessonPlan,
  },
  {
    id: 'cornell-notes',
    name: 'Cornell notes',
    emoji: '📓',
    description: 'Cues, notes and summary sections',
    build: cornellNotes,
  },
  { id: 'venn', name: 'Venn diagram', emoji: '⭕', description: 'Two overlapping sets to compare', build: vennDiagram },
  {
    id: 'homework',
    name: 'Homework tracker',
    emoji: '📋',
    description: 'To do / working on it / done columns',
    build: homeworkBoard,
  },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]['id'];

export function getTemplate(id: string) {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}
