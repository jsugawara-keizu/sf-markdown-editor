import { createElement } from "lwc";
import { fixMarkdownTables } from "c/markdownEditor";
import MarkdownEditor from "c/markdownEditor";

describe("c-markdown-editor", () => {
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
});
