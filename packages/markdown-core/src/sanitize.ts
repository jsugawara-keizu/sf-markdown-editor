import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import type { Schema } from 'hast-util-sanitize';
import type { Root, Element, Text } from 'hast';
import { visit } from 'unist-util-visit';

// style タグのテキストコンテンツから url() / @import / expression() を除去する
export function rehypeSanitizeStyleContent() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'style') return;
      node.children = node.children.map((child) => {
        if (child.type !== 'text') return child;
        const safe = (child as Text).value
          .replace(/url\s*\([^)]*\)/gi, 'url()')
          .replace(/@import\b[^;]*/gi, '')
          .replace(/expression\s*\([^)]*\)/gi, '');
        return { ...child, value: safe } as Text;
      });
    });
  };
}

function mergeAttributes(
  base: Schema['attributes'],
  extra: NonNullable<Schema['attributes']>
): NonNullable<Schema['attributes']> {
  const out: NonNullable<Schema['attributes']> = { ...(base || {}) };
  for (const [tag, attrs] of Object.entries(extra)) {
    const current = out[tag] || [];
    out[tag] = [...current, ...(attrs || [])];
  }
  return out;
}

const SVG_TAGS = [
  'svg', 'g', 'path', 'defs', 'marker', 'style', 'line', 'rect', 'polygon',
  'polyline', 'circle', 'ellipse', 'text', 'tspan', 'title',
  'desc', 'linearGradient', 'radialGradient', 'stop', 'pattern', 'clipPath',
  'mask', 'symbol', 'use', 'image', 'filter', 'feGaussianBlur', 'feOffset',
  'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feFuncA', 'feFuncB',
  'feFuncG', 'feFuncR', 'feFlood', 'feComposite', 'feMerge', 'feMergeNode',
  'feMorphology', 'feTurbulence', 'feDisplacementMap', 'feDropShadow'
] as const;

const SVG_ATTRS = [
  'id', 'className', 'style', 'role', 'ariaLabel', 'ariaHidden', 'transform',
  'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy',
  'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke', 'strokeWidth',
  'strokeLinecap', 'strokeLinejoin', 'strokeDasharray', 'opacity',
  'markerStart', 'markerEnd', 'markerMid', 'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'orient', 'preserveAspectRatio', 'xmlns',
  'xmlnsXlink', 'xlinkHref', 'href', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariant', 'letterSpacing', 'wordSpacing', 'textAnchor',
  'dominantBaseline', 'offset', 'stopColor', 'stopOpacity', 'gradientUnits',
  'gradientTransform', 'pathLength', 'maskUnits', 'maskContentUnits',
  'textLength', 'lengthAdjust', 'textRendering', 'alignmentBaseline',
  'clipPathUnits', 'filterUnits', 'in', 'result', 'stdDeviation', 'dx', 'dy',
  'floodColor', 'floodOpacity'
] as const;

const SVG_DASHED_ATTRS = [
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'marker-start',
  'marker-end',
  'marker-mid',
  'marker-width',
  'marker-height',
  'markerunits',
  'stroke-width',
  'font-size',
  'font-family',
  'font-weight',
  'font-style',
  'font-stretch',
  'font-variant',
  'text-anchor',
  'dominant-baseline',
  'stop-color',
  'stop-opacity',
  'gradient-units',
  'gradient-transform',
  'pathLength',
  'mask-units',
  'flood-color',
  'flood-opacity',
  'refx',
  'refy',
  'letter-spacing',
  'word-spacing',
  'text-length',
  'length-adjust',
  'text-rendering',
  'alignment-baseline',
  'orient'
] as const;

export const markdownSanitizeSchema: Schema = {
  ...defaultSchema,
  // Keep original ids so Mermaid's internal CSS selectors and url(#id) links
  // remain consistent after sanitize.
  clobberPrefix: '',
  tagNames: [...(defaultSchema.tagNames || []), ...SVG_TAGS, 'div', 'span'],
  attributes: mergeAttributes(defaultSchema.attributes, {
    '*': [
      ['className'],
      ['id'],
      ['title'],
      ['role'],
      ['ariaLabel'],
      ['ariaHidden']
    ],
    code: [['className']],
    a: [['href'], ['target'], ['rel']],
    img: [['src'], ['alt'], ['title']],
    th: [['align']],
    td: [['align']],
    div: [['className']],
    span: [['className']],
    svg: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    g: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    path: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    marker: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    defs: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    style: [['type']],
    line: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    rect: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    polygon: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    polyline: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    circle: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    ellipse: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    text: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    tspan: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    title: [],
    desc: [],
    linearGradient: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    radialGradient: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    stop: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    use: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    symbol: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    image: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    filter: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feGaussianBlur: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feOffset: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feBlend: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feColorMatrix: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feComponentTransfer: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feFuncA: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feFuncB: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feFuncG: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feFuncR: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feFlood: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feComposite: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feMerge: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feMergeNode: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feMorphology: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feTurbulence: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feDisplacementMap: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    feDropShadow: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    clipPath: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    mask: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
    pattern: [...SVG_ATTRS.map((a) => [a]), ...SVG_DASHED_ATTRS.map((a) => [a])],
  }),
};

const htmlSanitizer = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeSanitize, markdownSanitizeSchema)
  .use(rehypeSanitizeStyleContent)
  .use(rehypeStringify)
  .freeze();

export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string' || html.trim() === '') return '';
  try {
    return String(htmlSanitizer.processSync(html));
  } catch {
    return '';
  }
}

export function sanitizeSvg(svg: string): string {
  return sanitizeHtml(svg);
}

export interface Sanitizer {
  sanitize(html: string): string;
}

export interface SanitizerOptions {
  allowSvg?: boolean;
}

export function createSanitizer(_win?: Window, _options?: SanitizerOptions): Sanitizer {
  return {
    sanitize(html: string): string {
      return sanitizeHtml(html);
    },
  };
}
