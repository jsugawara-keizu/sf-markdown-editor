import { createElement } from "lwc";
import MarkdownViewer from "c/markdownViewer";

jest.mock(
  "lightning/platformResourceLoader",
  () => ({ loadScript: jest.fn() }),
  { virtual: true }
);

jest.mock("@salesforce/resourceUrl/markdownCore", () => "/markdownCore", {
  virtual: true
});

jest.mock("@salesforce/resourceUrl/mermaidJs", () => "/mermaidJs", {
  virtual: true
});

const { loadScript } = require("lightning/platformResourceLoader");

function makeMarkdownCoreMock() {
  return {
    renderAndSanitizeAsync: jest.fn(async (md) => `<p>${md}</p>`)
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("c-markdown-viewer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    loadScript.mockReset();
    loadScript.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    delete global.MarkdownCore;
    delete window.MarkdownCore;
    delete global.mermaid;
    delete window.mermaid;
  });

  it("shows spinner while loading", () => {
    loadScript.mockReturnValue(new Promise(() => {}));
    const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
    document.body.appendChild(el);
    const spinner = el.shadowRoot.querySelector("lightning-spinner");
    expect(spinner).not.toBeNull();
  });

  it("calls renderAndSanitizeAsync after library loads", async () => {
    global.MarkdownCore = makeMarkdownCoreMock();
    window.MarkdownCore = global.MarkdownCore;
    const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
    document.body.appendChild(el);

    await flushPromises();
    await flushPromises();

    el.value = "Hello";
    jest.advanceTimersByTime(100);
    await flushPromises();
    await flushPromises();
    expect(global.MarkdownCore.renderAndSanitizeAsync).toHaveBeenCalledWith(
      "Hello"
    );
  });

  it("re-renders when value changes after load", async () => {
    global.MarkdownCore = makeMarkdownCoreMock();
    window.MarkdownCore = global.MarkdownCore;
    const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
    el.value = "First";
    document.body.appendChild(el);
    await flushPromises();
    jest.advanceTimersByTime(100);
    await flushPromises();

    el.value = "Second";
    await flushPromises();
    jest.advanceTimersByTime(100);
    await flushPromises();

    expect(global.MarkdownCore.renderAndSanitizeAsync).toHaveBeenLastCalledWith(
      "Second"
    );
  });

  it("does not call renderAndSanitizeAsync for empty value", async () => {
    global.MarkdownCore = makeMarkdownCoreMock();
    window.MarkdownCore = global.MarkdownCore;
    const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
    el.value = "";
    document.body.appendChild(el);
    await flushPromises();
    jest.advanceTimersByTime(100);
    await flushPromises();
    expect(global.MarkdownCore.renderAndSanitizeAsync).not.toHaveBeenCalled();
  });

  it("renders correctly when given an empty direct value", async () => {
    global.MarkdownCore = makeMarkdownCoreMock();
    window.MarkdownCore = global.MarkdownCore;
    const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
    el.value = "";
    document.body.appendChild(el);

    await flushPromises();

    expect(el.shadowRoot.querySelector("lightning-spinner")).not.toBeNull();
  });

  it("keeps rendering when mermaid script load fails", async () => {
    global.MarkdownCore = makeMarkdownCoreMock();
    window.MarkdownCore = global.MarkdownCore;
    loadScript.mockReset();
    loadScript
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error("load failed"));

    const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
    el.value = "Hello";
    document.body.appendChild(el);

    await flushPromises();
    await flushPromises();
    jest.advanceTimersByTime(100);
    await flushPromises();

    expect(global.MarkdownCore.renderAndSanitizeAsync).toHaveBeenCalledWith(
      "Hello"
    );
    const errorEl = el.shadowRoot.querySelector(".md-error");
    expect(errorEl).toBeNull();
  });

  it("shows error state when markdown-core load fails", async () => {
    loadScript.mockReset();
    loadScript.mockRejectedValue(new Error("core load failed"));

    const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
    document.body.appendChild(el);

    await flushPromises();
    jest.runOnlyPendingTimers();
    await flushPromises();

    const errorEl = el.shadowRoot.querySelector(".md-error");
    expect(errorEl).not.toBeNull();
  });

  it("strips YAML frontmatter before rendering", async () => {
    global.MarkdownCore = makeMarkdownCoreMock();
    window.MarkdownCore = global.MarkdownCore;
    const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
    document.body.appendChild(el);
    await flushPromises();

    el.value = '---\nsf_id: "abc123"\nsources: []\n---\n\n# Hello';
    jest.runOnlyPendingTimers();
    await flushPromises();

    expect(global.MarkdownCore.renderAndSanitizeAsync).toHaveBeenLastCalledWith(
      "\n# Hello"
    );
  });
});
