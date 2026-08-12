import type { Root, Element, Text } from 'hast';
import { visit } from 'unist-util-visit';
import { TODO_MARKER_RE } from './checklist';

function hasTaskListItemClass(node: Element): boolean {
  const className = node.properties?.className;
  const classes = Array.isArray(className) ? className : [];
  return classes.includes('task-list-item');
}

// remark-gfm/remark-rehype render a checked task-list item as
// `<li class="task-list-item"><input type="checkbox" checked disabled>...`.
// The `<li>` keeps the source line via mdast `listItem.position`, but the
// `<input>` itself has no position of its own, so the line is read off the
// parent `<li>` and copied onto the checkbox as `data-md-line`. Consumers
// (markdownViewer.js) use that to identify which source line to toggle.
export function rehypeMakeCheckboxesInteractive() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'li' || !hasTaskListItemClass(node)) {
        return;
      }
      const line = node.position?.start?.line;
      if (typeof line !== 'number') {
        return;
      }
      visit(node, 'element', (child: Element) => {
        if (child.tagName !== 'input' || child.properties?.type !== 'checkbox') {
          return;
        }
        delete child.properties.disabled;
        child.properties.dataMdLine = line;
      });

      // The `^[todo:xxxx]` marker (see checklist.ts) is plain trailing text
      // in the source line, so it survives as-is into the rendered text
      // node. Strip it here so the marker never shows up in the preview.
      visit(node, 'text', (textNode: Text) => {
        if (TODO_MARKER_RE.test(textNode.value)) {
          textNode.value = textNode.value.replace(TODO_MARKER_RE, '');
        }
      });
    });
  };
}
