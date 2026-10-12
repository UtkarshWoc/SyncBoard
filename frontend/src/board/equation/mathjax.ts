/**
 * LaTeX → standalone SVG using MathJax's lite DOM adaptor (no real DOM needed,
 * glyphs emitted as paths, so the SVG renders identically everywhere).
 * Loaded lazily — MathJax is large and only needed when inserting an equation.
 */
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { SVG } from 'mathjax-full/js/output/svg.js';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document('', {
  InputJax: new TeX({ packages: AllPackages.filter((p: string) => p !== 'bussproofs') }),
  OutputJax: new SVG({ fontCache: 'none' }),
});

/** Pixels per ex at the size we render equations. */
const EX_PX = 10;

export interface RenderedEquation {
  svg: string;
  width: number;
  height: number;
}

export function renderLatex(latex: string, color: string): RenderedEquation {
  const node = doc.convert(latex, { display: true });
  const html = adaptor.innerHTML(node);
  if (html.includes('data-mjx-error') || html.includes('<g data-mml-node="merror"')) {
    const message = /data-mjx-error="([^"]*)"/.exec(html)?.[1] ?? 'Invalid LaTeX';
    throw new Error(message);
  }
  const widthEx = parseFloat(/width="([\d.]+)ex"/.exec(html)?.[1] ?? '10');
  const heightEx = parseFloat(/height="([\d.]+)ex"/.exec(html)?.[1] ?? '3');
  const width = Math.max(8, Math.round(widthEx * EX_PX));
  const height = Math.max(8, Math.round(heightEx * EX_PX));
  const svg = html
    .replace(/width="[\d.]+ex"/, `width="${width}"`)
    .replace(/height="[\d.]+ex"/, `height="${height}"`)
    .replace(/style="vertical-align:[^"]*"/, '')
    .replace(/currentColor/g, color);
  // Standalone SVG files need the namespace; MathJax usually includes it, and a duplicate is invalid XML.
  return {
    svg: svg.includes('xmlns=') ? svg : svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '),
    width,
    height,
  };
}
