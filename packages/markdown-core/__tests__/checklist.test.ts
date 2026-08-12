import { describe, it, expect } from 'vitest';
import {
  extractCheckboxItems,
  insertCheckboxMarker,
  PRESERVE_MARKER_NOTICE_TEXT,
} from '../src/checklist';
import { renderMarkdown } from '../src/renderer';

describe('extractCheckboxItems', () => {
  it('returns an empty list for blank input', () => {
    expect(extractCheckboxItems('')).toEqual([]);
    expect(extractCheckboxItems('   ')).toEqual([]);
  });

  it('extracts unmarked checkbox lines with markerId null', () => {
    const items = extractCheckboxItems('- [ ] first\n- [x] second\n');
    expect(items).toEqual([
      { line: 1, text: 'first', checked: false, markerId: null },
      { line: 2, text: 'second', checked: true, markerId: null },
    ]);
  });

  it('parses an existing marker and strips it from the text', () => {
    const items = extractCheckboxItems('- [x] review docs ^[todo:8f1a2b]\n');
    expect(items).toEqual([
      { line: 1, text: 'review docs', checked: true, markerId: '8f1a2b' },
    ]);
  });

  it('ignores non-task-list items', () => {
    expect(extractCheckboxItems('- plain item\n- [ ] task item\n')).toEqual([
      { line: 2, text: 'task item', checked: false, markerId: null },
    ]);
  });

  it('assigns line numbers correctly across surrounding content', () => {
    const items = extractCheckboxItems(
      '# Title\n\n- [ ] a\n- [x] b ^[todo:aaaaaa]\n\nSome paragraph.\n'
    );
    expect(items).toEqual([
      { line: 3, text: 'a', checked: false, markerId: null },
      { line: 4, text: 'b', checked: true, markerId: 'aaaaaa' },
    ]);
  });
});

describe('insertCheckboxMarker', () => {
  it('appends the marker to the target line', () => {
    const result = insertCheckboxMarker('- [ ] a\n- [ ] b\n', 2, 'deadbe');
    expect(result).toBe(
      `<!-- ${PRESERVE_MARKER_NOTICE_TEXT} -->\n\n- [ ] a\n- [ ] b ^[todo:deadbe]\n`
    );
  });

  it('preserves trailing newlines/blank lines', () => {
    const result = insertCheckboxMarker('- [ ] only\n\n', 1, 'cafe01');
    expect(result).toBe(
      `<!-- ${PRESERVE_MARKER_NOTICE_TEXT} -->\n\n- [ ] only ^[todo:cafe01]\n\n`
    );
  });

  it('returns the text unchanged when the line is out of range', () => {
    const md = '- [ ] only\n';
    expect(insertCheckboxMarker(md, 9, 'cafe01')).toBe(md);
  });

  describe('preserve-marker notice', () => {
    it('inserts the notice as a YAML comment inside existing frontmatter', () => {
      const md =
        '---\nsf_id: "abc"\nsources: []\n---\n# Title\n\n- [ ] only\n';
      const result = insertCheckboxMarker(md, 7, 'cafe01');
      expect(result).toBe(
        '---\nsf_id: "abc"\nsources: []\n' +
          `# ${PRESERVE_MARKER_NOTICE_TEXT}\n` +
          '---\n# Title\n\n- [ ] only ^[todo:cafe01]\n'
      );
    });

    it('falls back to a standalone HTML comment when there is no frontmatter', () => {
      const md = '- [ ] only\n';
      const result = insertCheckboxMarker(md, 1, 'cafe01');
      expect(result).toBe(
        `<!-- ${PRESERVE_MARKER_NOTICE_TEXT} -->\n\n- [ ] only ^[todo:cafe01]\n`
      );
    });

    it('is only inserted once across repeated marker insertions', () => {
      const md = '- [ ] a\n- [ ] b\n';
      const afterFirst = insertCheckboxMarker(md, 1, 'aaaaaa');
      const afterSecond = insertCheckboxMarker(afterFirst, 2, 'bbbbbb');
      expect(
        afterSecond.split(PRESERVE_MARKER_NOTICE_TEXT).length - 1
      ).toBe(1);
    });

    it('the standalone HTML comment fallback renders to nothing even without frontmatter-stripping', () => {
      const withoutFrontmatter = insertCheckboxMarker(
        '- [ ] only\n',
        1,
        'cafe02'
      );
      expect(renderMarkdown(withoutFrontmatter)).not.toContain(
        'checklist_marker_notice'
      );
    });

    it('the in-frontmatter YAML comment only stays invisible because the frontmatter block itself is stripped before rendering — the notice is NOT hidden by markdown-core alone', () => {
      // This mirrors markdownViewer.js's own frontmatter-stripping step
      // (see doRenderAsync): rendering the *stripped* markdown, not the
      // raw markdown-with-frontmatter, is what actually keeps the notice
      // (and the frontmatter itself) out of the visible preview. A `#`
      // at the start of a line is an ATX heading in plain CommonMark, so
      // rendering the frontmatter block as-is would surface the notice as
      // a literal <h1>.
      const withFrontmatter = insertCheckboxMarker(
        '---\nsf_id: "abc"\nsources: []\n---\n- [ ] only\n',
        5,
        'cafe01'
      );
      const stripped = withFrontmatter.replace(/^---\n[\s\S]*?\n---\n?/, '');
      expect(renderMarkdown(stripped)).not.toContain(
        'checklist_marker_notice'
      );
      expect(renderMarkdown(withFrontmatter)).toContain(
        'checklist_marker_notice'
      );
    });
  });
});
