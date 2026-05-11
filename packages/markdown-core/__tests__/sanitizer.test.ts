import { describe, it, expect } from 'vitest';
import { createSanitizer, sanitizeSvg } from '../src/sanitize';

const sanitizer = createSanitizer();

describe('createSanitizer', () => {
  it('passes safe HTML unchanged', () => {
    const input = '<h1>Title</h1><p>Hello <strong>world</strong></p>';
    expect(sanitizer.sanitize(input)).toContain('<h1>Title</h1>');
  });

  it('strips <script> tags', () => {
    const result = sanitizer.sanitize('<script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('strips inline event handlers', () => {
    const result = sanitizer.sanitize('<p onclick="evil()">text</p>');
    expect(result).not.toContain('onclick');
  });

  it('strips javascript: hrefs', () => {
    const result = sanitizer.sanitize('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain('javascript:');
  });

  it('allows safe anchor links', () => {
    const input = '<a href="https://example.com" target="_blank" rel="noopener">link</a>';
    const result = sanitizer.sanitize(input);
    expect(result).toContain('href="https://example.com"');
  });

  it('allows GFM table elements', () => {
    const input = '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>';
    const result = sanitizer.sanitize(input);
    expect(result).toContain('<table>');
    expect(result).toContain('<th>A</th>');
  });

  it('strips iframe', () => {
    const result = sanitizer.sanitize('<iframe src="https://evil.com"></iframe>');
    expect(result).not.toContain('iframe');
  });

  it('sanitizes mermaid-like svg', () => {
    const safe = sanitizeSvg('<svg><script>alert(1)</script><g><text>x</text></g></svg>');
    expect(safe).toContain('<svg');
    expect(safe).not.toContain('<script>');
  });

  it('preserves mermaid marker attributes', () => {
    const svg = '<svg><defs><marker id="arrow" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" refX="5" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" /></marker></defs><path d="M0,0 L100,100" marker-end="url(#arrow)" /></svg>';
    const safe = sanitizeSvg(svg);
    expect(safe).toContain('marker-end="url(#arrow)"');
    expect(safe).toContain('markerWidth="10"');
    expect(safe).toContain('markerUnits="userSpaceOnUse"');
    expect(safe).toContain('refX="5"');
    expect(safe).toContain('refY="5"');
    expect(safe).toContain('id="arrow"');
  });

  it('preserves SVG text layout attributes', () => {
    const svg = '<svg><text textLength="120" lengthAdjust="spacingAndGlyphs" alignment-baseline="middle" text-rendering="geometricPrecision">Salesforce</text></svg>';
    const safe = sanitizeSvg(svg);
    expect(safe).toContain('textLength="120"');
    expect(safe).toContain('lengthAdjust="spacingAndGlyphs"');
    expect(safe).toContain('alignment-baseline="middle"');
    expect(safe).toContain('text-rendering="geometricPrecision"');
    expect(safe).toContain('Salesforce');
  });
});
