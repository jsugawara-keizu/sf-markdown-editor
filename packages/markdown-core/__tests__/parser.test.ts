import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/renderer';
import { extractHeadings, buildToc } from '../src/parser';

describe('renderMarkdown', () => {
  it('converts basic Markdown to HTML', () => {
    const html = renderMarkdown('# Hello\n\nWorld');
    expect(html).toContain('<h1 id="hello">Hello</h1>');
    expect(html).toContain('<p>World</p>');
  });

  it('renders GFM tables', () => {
    const md = `| A | B |\n|---|---|\n| 1 | 2 |`;
    const html = renderMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>A</th>');
  });

  it('renders GFM strikethrough', () => {
    const html = renderMarkdown('~~strike~~');
    expect(html).toContain('<del>strike</del>');
  });

  it('renders fenced code blocks', () => {
    const html = renderMarkdown('```js\nconsole.log(1);\n```');
    expect(html).toContain('<code');
    expect(html).toContain('hljs-title function_');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown('   ')).toBe('');
  });

  it('does not output raw script tags after sanitize', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });
});

describe('extractHeadings', () => {
  it('returns all headings in order', () => {
    const md = `# H1\n## H2\n### H3\n## Another H2`;
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(4);
    expect(headings[0]).toEqual({ level: 1, text: 'H1', id: 'h1' });
    expect(headings[1]).toEqual({ level: 2, text: 'H2', id: 'h2' });
    expect(headings[3]).toEqual({ level: 2, text: 'Another H2', id: 'another-h2' });
  });

  it('returns empty array for documents with no headings', () => {
    expect(extractHeadings('just a paragraph')).toEqual([]);
    expect(extractHeadings('')).toEqual([]);
  });

  it('slugifies heading text', () => {
    const headings = extractHeadings('## Hello World!');
    expect(headings[0].id).toBe('hello-world');
  });
});

describe('buildToc', () => {
  it('builds a nested TOC', () => {
    const md = `# Title\n## Section\n### Sub\n## Another`;
    const toc = buildToc(md);
    expect(toc).toContain('- [Title](#title)');
    expect(toc).toContain('  - [Section](#section)');
    expect(toc).toContain('    - [Sub](#sub)');
    expect(toc).toContain('  - [Another](#another)');
  });

  it('returns empty string for document with no headings', () => {
    expect(buildToc('no headings here')).toBe('');
  });
});
