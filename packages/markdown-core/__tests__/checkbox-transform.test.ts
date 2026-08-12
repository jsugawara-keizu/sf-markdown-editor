import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/renderer';

describe('rehypeMakeCheckboxesInteractive', () => {
  it('removes disabled and attaches the source line to task list checkboxes', () => {
    const html = renderMarkdown('- [ ] first item\n- [x] second item\n');
    expect(html).not.toContain('disabled');
    expect(html).toContain('<input type="checkbox" data-md-line="1">');
    expect(html).toContain('<input type="checkbox" checked data-md-line="2">');
  });

  it('assigns line numbers independently across separate lists', () => {
    const html = renderMarkdown(
      '- [ ] a\n- [ ] b\n\nSome paragraph in between.\n\n- [ ] c\n- [ ] d\n'
    );
    expect(html).toContain('data-md-line="1"');
    expect(html).toContain('data-md-line="2"');
    expect(html).toContain('data-md-line="6"');
    expect(html).toContain('data-md-line="7"');
  });

  it('leaves non-task-list checkboxes/inputs untouched (github schema still forces type=checkbox)', () => {
    const html = renderMarkdown('- plain list item, no checkbox\n');
    expect(html).not.toContain('data-md-line');
    expect(html).not.toContain('<input');
  });

  it('does not add data-md-line to unrelated inputs sneaked in via raw HTML', () => {
    const html = renderMarkdown('<input type="text" value="x">\n');
    expect(html).not.toContain('data-md-line');
  });

  it('hides the ^[todo:xxxx] marker from the rendered text', () => {
    const html = renderMarkdown('- [x] review docs ^[todo:8f1a2b]\n');
    expect(html).not.toContain('todo:8f1a2b');
    expect(html).toContain('review docs');
  });
});
