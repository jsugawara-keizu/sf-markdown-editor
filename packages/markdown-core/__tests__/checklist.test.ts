import { describe, it, expect } from 'vitest';
import { extractCheckboxItems, insertCheckboxMarker } from '../src/checklist';

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
    expect(result).toBe('- [ ] a\n- [ ] b ^[todo:deadbe]\n');
  });

  it('preserves trailing newlines/blank lines', () => {
    const result = insertCheckboxMarker('- [ ] only\n\n', 1, 'cafe01');
    expect(result).toBe('- [ ] only ^[todo:cafe01]\n\n');
  });

  it('returns the text unchanged when the line is out of range', () => {
    const md = '- [ ] only\n';
    expect(insertCheckboxMarker(md, 9, 'cafe01')).toBe(md);
  });
});
