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

jest.mock(
  "@salesforce/apex/MarkdownImageHandler.toggleCheckboxLine",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock("lightning/uiRecordApi", () => {
  const actual = jest.requireActual("lightning/uiRecordApi");
  return { ...actual, getRecordNotifyChange: jest.fn() };
});

const { loadScript } = require("lightning/platformResourceLoader");
const toggleCheckboxLine = require("@salesforce/apex/MarkdownImageHandler.toggleCheckboxLine").default;
const { getRecord, getRecordNotifyChange } = require("lightning/uiRecordApi");
const { getObjectInfo } = require("lightning/uiObjectInfoApi");

function emitFieldUpdateable(fieldApiName, updateable) {
  getObjectInfo.emit({
    fields: { [fieldApiName]: { isAccessible: true, updateable } }
  });
}

function emitRecordFieldValue(fieldApiName, value) {
  getRecord.emit({ fields: { [fieldApiName]: { value } } });
}

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

  describe("checkbox toggle", () => {
    function markdownCoreMockWithCheckbox() {
      return {
        renderAndSanitizeAsync: jest.fn(
          async () =>
            '<ul><li><input type="checkbox" data-md-line="1"></li></ul>'
        )
      };
    }

    async function renderWithCheckbox(el) {
      document.body.appendChild(el);
      await flushPromises();
      jest.advanceTimersByTime(100);
      await flushPromises();
      await flushPromises();
    }

    it("dispatches mdcheckboxtoggle with line and checked state on click", async () => {
      global.MarkdownCore = markdownCoreMockWithCheckbox();
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "- [ ] item";
      const handler = jest.fn();
      el.addEventListener("mdcheckboxtoggle", handler);
      await renderWithCheckbox(el);

      const checkbox = el.shadowRoot.querySelector(
        'input[type="checkbox"][data-md-line]'
      );
      expect(checkbox).not.toBeNull();
      // .click() (not a synthetic dispatchEvent) so jsdom runs the checkbox's
      // native toggle-on-click activation behavior once, the same as a real
      // user click — starts unchecked, ends checked.
      checkbox.click();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail).toEqual({
        line: 1,
        checked: true
      });
    });

    it("translates the dispatched line number back through stripped YAML frontmatter", async () => {
      // Regression test: frontmatter is stripped from the string handed to
      // markdown-core purely for display, so data-md-line comes back
      // relative to that *stripped* text. Every consumer of the dispatched
      // event (markdownEditor.js's toggleCheckboxAtLine, this component's
      // own standalone toggleCheckboxLine call) operates on the raw stored
      // field value, which still has the frontmatter — so the emitted line
      // must be translated back, or every write silently targets the wrong
      // line (finds no checkbox there, no-ops) while the browser's own
      // untouched checkbox visually toggles anyway, masking the failure.
      global.MarkdownCore = {
        renderAndSanitizeAsync: jest.fn(
          async () =>
            '<ul><li><input type="checkbox" data-md-line="1"></li></ul>'
        )
      };
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = '---\nsf_id: "x"\nsources: []\n---\n- [ ] item';
      const handler = jest.fn();
      el.addEventListener("mdcheckboxtoggle", handler);
      await renderWithCheckbox(el);

      expect(
        global.MarkdownCore.renderAndSanitizeAsync
      ).toHaveBeenLastCalledWith("- [ ] item");

      const checkbox = el.shadowRoot.querySelector(
        'input[type="checkbox"][data-md-line]'
      );
      checkbox.click();

      expect(handler.mock.calls[0][0].detail.line).toBe(5);
    });

    it("calls toggleCheckboxLine and re-renders when used standalone with recordId/fieldApiName", async () => {
      global.MarkdownCore = markdownCoreMockWithCheckbox();
      window.MarkdownCore = global.MarkdownCore;
      toggleCheckboxLine.mockReset();
      toggleCheckboxLine.mockResolvedValue("- [x] item");

      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.recordId = "001000000000001AAA";
      el.objectApiName = "Account";
      el.fieldApiName = "Description";
      document.body.appendChild(el);
      emitRecordFieldValue("Description", "- [ ] item");
      emitFieldUpdateable("Description", true);
      await flushPromises();
      jest.advanceTimersByTime(100);
      await flushPromises();
      await flushPromises();

      const checkbox = el.shadowRoot.querySelector(
        'input[type="checkbox"][data-md-line]'
      );
      expect(checkbox).not.toBeNull();
      checkbox.click();
      await flushPromises();

      expect(toggleCheckboxLine).toHaveBeenCalledWith({
        recordId: "001000000000001AAA",
        objectApiName: "Account",
        fieldApiName: "Description",
        line: 1,
        checked: true
      });
      await flushPromises();
      expect(getRecordNotifyChange).toHaveBeenCalledWith([
        { recordId: "001000000000001AAA" }
      ]);
    });

    it("does not dispatch or persist when readOnly is true", async () => {
      global.MarkdownCore = markdownCoreMockWithCheckbox();
      window.MarkdownCore = global.MarkdownCore;
      toggleCheckboxLine.mockReset();

      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "- [ ] item";
      el.readOnly = true;
      const handler = jest.fn();
      el.addEventListener("mdcheckboxtoggle", handler);
      await renderWithCheckbox(el);

      const checkbox = el.shadowRoot.querySelector(
        'input[type="checkbox"][data-md-line]'
      );
      checkbox.click();

      expect(handler).not.toHaveBeenCalled();
      expect(toggleCheckboxLine).not.toHaveBeenCalled();
      expect(checkbox.checked).toBe(false);
    });

    it("reverts the checkbox and logs an error when the server toggle fails", async () => {
      global.MarkdownCore = markdownCoreMockWithCheckbox();
      window.MarkdownCore = global.MarkdownCore;
      toggleCheckboxLine.mockReset();
      toggleCheckboxLine.mockRejectedValue(new Error("boom"));
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.recordId = "001000000000001AAA";
      el.objectApiName = "Account";
      el.fieldApiName = "Description";
      document.body.appendChild(el);
      emitRecordFieldValue("Description", "- [ ] item");
      emitFieldUpdateable("Description", true);
      await flushPromises();
      jest.advanceTimersByTime(100);
      await flushPromises();
      await flushPromises();

      const checkbox = el.shadowRoot.querySelector(
        'input[type="checkbox"][data-md-line]'
      );
      expect(checkbox).not.toBeNull();
      checkbox.click();
      await flushPromises();
      await flushPromises();

      expect(checkbox.checked).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
