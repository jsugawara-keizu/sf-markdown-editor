import { createElement } from "lwc";
import { fixMarkdownTables, toggleCheckboxAtLine } from "c/markdownEditor";
import MarkdownEditor from "c/markdownEditor";
import getTasksForField from "@salesforce/apex/MarkdownTaskSync.getTasksForField";
import saveMarkdownWithImages from "@salesforce/apex/MarkdownImageHandler.saveMarkdownWithImages";

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

jest.mock(
  "@salesforce/apex/MarkdownImageHandler.saveMarkdownWithImages",
  () => ({ default: jest.fn((args) => Promise.resolve(args.markdownContent)) }),
  { virtual: true }
);

jest.mock("@salesforce/user/Id", () => ({ default: "005000000000001AAA" }), {
  virtual: true
});

describe("c-markdown-editor", () => {
  beforeEach(() => {
    getTasksForField.mockClear();
    saveMarkdownWithImages.mockClear();
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

  it("shows the checklist panel for a Marp doc switched to normal preview", async () => {
    const el = createElement("c-markdown-editor", { is: MarkdownEditor });
    el.defaultMode = "preview";
    el.value = "---\nmarp: true\n---\n\n- [ ] task";
    document.body.appendChild(el);
    await Promise.resolve();

    // marpViewer defaults to slide mode on large form factors in this test
    // environment, so simulate the user switching it back to the normal
    // (non-slide) document preview via its slidemodechange event.
    const marpViewer = el.shadowRoot.querySelector("c-marp-viewer");
    marpViewer.dispatchEvent(
      new CustomEvent("slidemodechange", { detail: { isSlideMode: false } })
    );
    await Promise.resolve();

    expect(
      el.shadowRoot.querySelector("c-markdown-checklist-panel")
    ).not.toBeNull();
    // Exactly one c-markdown-viewer must exist here, not two: c-marp-viewer
    // already renders its own internal c-markdown-viewer for a Marp doc's
    // normal (non-slide) preview (found by this querySelectorAll since the
    // test environment's synthetic shadow DOM doesn't stop traversal at
    // component boundaries), so markdownEditor mounting a second, standalone
    // one alongside it would render the whole document twice.
    expect(el.shadowRoot.querySelectorAll("c-markdown-viewer")).toHaveLength(
      1
    );
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

  it("toggles the source line and persists immediately when the preview dispatches mdcheckboxtoggle", async () => {
    // Regression test: a checkbox click in the preview is a discrete,
    // deliberate action — like markdownChecklistPanel's "Create Task" — so
    // it must persist right away rather than only marking the editor dirty
    // and waiting on a manual Save. Otherwise the checkbox's corresponding
    // Task never gets its Status synced (MarkdownTaskSync only runs from
    // the actual save path) until the user remembers to click Save.
    const el = createElement("c-markdown-editor", { is: MarkdownEditor });
    el.recordId = "001000000000001AAA";
    el.objectApiName = "Account";
    el.fieldApiName = "Description";
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
    await Promise.resolve();
    await Promise.resolve();

    expect(saveMarkdownWithImages).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: "001000000000001AAA",
        objectApiName: "Account",
        fieldApiName: "Description",
        markdownContent: "- [ ] item one\n- [x] item two"
      })
    );

    el.shadowRoot.querySelector('[data-tab="edit"]').click();
    await Promise.resolve();

    expect(el.shadowRoot.querySelector("textarea").value).toBe(
      "- [ ] item one\n- [x] item two"
    );
    expect(el.shadowRoot.querySelector(".md-dirty-badge")).toBeNull();
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

  it("passes editableFieldsConfig through to the embedded checklist panel", async () => {
    const el = createElement("c-markdown-editor", { is: MarkdownEditor });
    el.editableFieldsConfig = "Priority,OwnerId";
    document.body.appendChild(el);

    el.shadowRoot.querySelector('[data-tab="preview"]').click();
    await Promise.resolve();

    const panel = el.shadowRoot.querySelector("c-markdown-checklist-panel");
    expect(panel.editableFieldsConfig).toBe("Priority,OwnerId");
  });
});
