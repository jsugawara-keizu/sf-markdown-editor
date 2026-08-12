import { createElement } from "lwc";
import { fixMarkdownTables, toggleCheckboxAtLine } from "c/markdownEditor";
import MarkdownEditor from "c/markdownEditor";
import getTasksForField from "@salesforce/apex/MarkdownTaskSync.getTasksForField";

jest.mock(
  "@salesforce/apex/MarkdownTaskSync.getTasksForField",
  () => ({ default: jest.fn(() => Promise.resolve([])) }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/MarkdownTaskSync.createTaskForCheckbox",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock("@salesforce/user/Id", () => ({ default: "005000000000001AAA" }), {
  virtual: true
});

describe("c-markdown-editor", () => {
  beforeEach(() => {
    getTasksForField.mockClear();
  });


  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("renders textarea in edit mode by default", () => {
    const el = createElement("c-markdown-editor", { is: MarkdownEditor });
    document.body.appendChild(el);
    expect(el.shadowRoot.querySelector("textarea")).not.toBeNull();
  });

  it("marks as dirty on input", async () => {
    const el = createElement("c-markdown-editor", { is: MarkdownEditor });
    document.body.appendChild(el);

    const textarea = el.shadowRoot.querySelector("textarea");
    textarea.value = "# Hello";
    textarea.dispatchEvent(new CustomEvent("input"));
    await Promise.resolve();

    expect(el.shadowRoot.querySelector(".md-dirty-badge")).not.toBeNull();
  });

  it("switches to preview tab on click", async () => {
    const el = createElement("c-markdown-editor", { is: MarkdownEditor });
    document.body.appendChild(el);

    el.shadowRoot.querySelector('[data-tab="preview"]').click();
    await Promise.resolve();

    expect(el.shadowRoot.querySelector("c-markdown-viewer")).not.toBeNull();
  });

  it("displays character count as 0 initially", () => {
    const el = createElement("c-markdown-editor", { is: MarkdownEditor });
    document.body.appendChild(el);
    expect(el.shadowRoot.querySelector(".md-char-count").textContent).toContain(
      "0"
    );
  });

  it("inserts bold markup via toolbar button", async () => {
    const el = createElement("c-markdown-editor", { is: MarkdownEditor });
    document.body.appendChild(el);

    el.shadowRoot.querySelector('[data-action="bold"]').click();
    await Promise.resolve();

    expect(
      el.shadowRoot.querySelector(".md-char-count").textContent
    ).not.toContain("0 文字");
  });

  it("shows preview mode when defaultMode is preview", async () => {
    const el = createElement("c-markdown-editor", { is: MarkdownEditor });
    el.defaultMode = "preview";
    document.body.appendChild(el);
    await Promise.resolve();

    expect(el.shadowRoot.querySelector("c-markdown-viewer")).not.toBeNull();
    expect(el.shadowRoot.querySelector("textarea")).toBeNull();
  });

  it("does not merge fenced code block lines containing pipes", () => {
    const input = "```\n| foo |\n| bar |\n```\n\n| col1 |\n| --- |\n| val |";
    expect(fixMarkdownTables(input)).toBe(input);
  });

  describe("toggleCheckboxAtLine", () => {
    it("checks an unchecked box on the target line only", () => {
      const input = "- [ ] a\n- [ ] b\n- [ ] c";
      expect(toggleCheckboxAtLine(input, 2, true)).toBe(
        "- [ ] a\n- [x] b\n- [ ] c"
      );
    });

    it("unchecks a checked box", () => {
      expect(toggleCheckboxAtLine("- [x] only", 1, false)).toBe(
        "- [ ] only"
      );
    });

    it("returns the text unchanged when the line has no checkbox", () => {
      const input = "# Heading\nplain text";
      expect(toggleCheckboxAtLine(input, 1, true)).toBe(input);
    });

    it("returns the text unchanged when the line is out of range", () => {
      const input = "- [ ] only line";
      expect(toggleCheckboxAtLine(input, 5, true)).toBe(input);
    });
  });

  it("toggles the source line and marks dirty when the preview dispatches mdcheckboxtoggle", async () => {
    const el = createElement("c-markdown-editor", { is: MarkdownEditor });
    document.body.appendChild(el);

    const textarea = el.shadowRoot.querySelector("textarea");
    textarea.value = "- [ ] item one\n- [ ] item two";
    textarea.dispatchEvent(new CustomEvent("input"));
    await Promise.resolve();

    el.shadowRoot.querySelector('[data-tab="preview"]').click();
    await Promise.resolve();

    const viewer = el.shadowRoot.querySelector("c-markdown-viewer");
    viewer.dispatchEvent(
      new CustomEvent("mdcheckboxtoggle", {
        detail: { line: 2, checked: true }
      })
    );
    await Promise.resolve();

    el.shadowRoot.querySelector('[data-tab="edit"]').click();
    await Promise.resolve();

    expect(el.shadowRoot.querySelector("textarea").value).toBe(
      "- [ ] item one\n- [x] item two"
    );
    expect(el.shadowRoot.querySelector(".md-dirty-badge")).not.toBeNull();
  });

  it("adopts the checklist panel's already-saved markdown without marking dirty", async () => {
    // markdownChecklistPanel persists the marker-inserted markdown itself
    // (via saveMarkdownWithImages) before dispatching checklisttaskcreated,
    // so the editor must treat this as an already-saved update — like
    // wiredRecord's own refresh — rather than a pending edit that would
    // depend on a further manual Save.
    const el = createElement("c-markdown-editor", { is: MarkdownEditor });
    document.body.appendChild(el);

    el.shadowRoot.querySelector('[data-tab="preview"]').click();
    await Promise.resolve();

    const panel = el.shadowRoot.querySelector("c-markdown-checklist-panel");
    panel.dispatchEvent(
      new CustomEvent("checklisttaskcreated", {
        detail: {
          updatedMarkdown: "- [ ] first item ^[todo:aaaaaa]",
          task: { id: "00T000000000001AAA" }
        }
      })
    );
    await Promise.resolve();

    el.shadowRoot.querySelector('[data-tab="edit"]').click();
    await Promise.resolve();

    expect(el.shadowRoot.querySelector("textarea").value).toBe(
      "- [ ] first item ^[todo:aaaaaa]"
    );
    expect(el.shadowRoot.querySelector(".md-dirty-badge")).toBeNull();
  });
});
