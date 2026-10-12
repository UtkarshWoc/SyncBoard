import type { BinaryFileData, DataURL, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { FileId } from '@excalidraw/excalidraw/element/types';
import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui';
import { insertSkeletons } from '../templates/insert';
import type { RenderedEquation } from './mathjax';

const EXAMPLES = [
  ['Quadratic formula', 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'],
  ['Pythagoras', 'a^2 + b^2 = c^2'],
  ['Derivative', '\\frac{d}{dx}\\left(x^n\\right) = n x^{n-1}'],
  ['Integral', '\\int_0^1 x^2\\,dx = \\tfrac{1}{3}'],
  ['Sum', '\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}'],
  ['Matrix', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'],
] as const;

const COLORS = ['#1e1e1e', '#e03131', '#1971c2', '#2f9e44'];

type Renderer = (latex: string, color: string) => RenderedEquation;

async function sha1(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function svgToDataURL(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

export function EquationDialog({ api, onClose }: { api: ExcalidrawImperativeAPI; onClose: () => void }) {
  const [render, setRender] = useState<Renderer | null>(null);
  const [latex, setLatex] = useState<string>(EXAMPLES[0][1]);
  const [color, setColor] = useState(COLORS[0]!);
  const [preview, setPreview] = useState<{ dataURL: string; width: number; height: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    import('./mathjax')
      .then((m) => !cancelled && setRender(() => m.renderLatex))
      .catch(() => setError('Could not load the equation renderer'));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!render) return;
    const handle = setTimeout(() => {
      try {
        if (!latex.trim()) {
          setPreview(null);
          return;
        }
        const out = render(latex, color);
        setPreview({ dataURL: svgToDataURL(out.svg), width: out.width, height: out.height });
        setError('');
      } catch (err) {
        setPreview(null);
        setError(err instanceof Error ? err.message : 'Invalid LaTeX');
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [render, latex, color]);

  const insert = async () => {
    if (!preview) return;
    const fileId = (await sha1(preview.dataURL)) as FileId;
    const file: BinaryFileData = {
      id: fileId,
      mimeType: 'image/svg+xml',
      dataURL: preview.dataURL as DataURL,
      created: Date.now(),
    };
    // Display at a comfortable size on the board; the SVG is resolution-independent.
    const scale = 1.6;
    insertSkeletons(
      api,
      [
        {
          type: 'image',
          x: 0,
          y: 0,
          width: preview.width * scale,
          height: preview.height * scale,
          fileId,
          status: 'saved',
          customData: { latex },
        },
      ],
      { files: [file], select: true },
    );
    onClose();
  };

  return (
    <Modal
      title="Insert equation"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void insert()} disabled={!preview}>
            Insert
          </button>
        </>
      }
    >
      <div className="stack">
        <label className="label" htmlFor="latex-input">
          LaTeX
        </label>
        <textarea
          id="latex-input"
          className="input mono"
          rows={3}
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void insert();
          }}
        />
        <div className="chip-row">
          {EXAMPLES.map(([name, tex]) => (
            <button key={name} className="chip" onClick={() => setLatex(tex)}>
              {name}
            </button>
          ))}
        </div>
        <div className="row gap">
          <span className="label">Colour</span>
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${color === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
            />
          ))}
        </div>
        <div className="equation-preview">
          {!render && !error && <span className="muted">Loading renderer…</span>}
          {preview && <img src={preview.dataURL} alt="Equation preview" />}
          {error && <span className="error">{error}</span>}
        </div>
        <p className="hint">Tip: Ctrl/⌘ + Enter inserts. The equation is added as an image you can move and resize.</p>
      </div>
    </Modal>
  );
}
