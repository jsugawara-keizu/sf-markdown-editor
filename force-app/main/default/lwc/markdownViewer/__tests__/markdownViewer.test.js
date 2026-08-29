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

  describe("image zoom", () => {
    function markdownCoreMockWithImage() {
      return {
        renderAndSanitizeAsync: jest.fn(
          async () => '<p><img src="/foo.png" alt="a photo"></p>'
        )
      };
    }

    async function renderWithImage(el) {
      document.body.appendChild(el);
      await flushPromises();
      jest.advanceTimersByTime(100);
      await flushPromises();
      await flushPromises();
    }

    it("opens a zoom overlay showing the clicked image on click", async () => {
      global.MarkdownCore = markdownCoreMockWithImage();
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "![a photo](/foo.png)";
      await renderWithImage(el);

      expect(el.shadowRoot.querySelector(".md-image-zoom-overlay")).toBeNull();

      const img = el.shadowRoot.querySelector('[data-id="content"] img');
      expect(img).not.toBeNull();
      img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();

      const overlay = el.shadowRoot.querySelector(".md-image-zoom-overlay");
      expect(overlay).not.toBeNull();
      const zoomedImg = overlay.querySelector(".md-image-zoom-img");
      expect(zoomedImg.src).toContain("/foo.png");
      expect(zoomedImg.alt).toBe("a photo");
    });

    it("closes the overlay when the close button is clicked", async () => {
      global.MarkdownCore = markdownCoreMockWithImage();
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "![a photo](/foo.png)";
      await renderWithImage(el);

      const img = el.shadowRoot.querySelector('[data-id="content"] img');
      img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();

      const closeBtn = el.shadowRoot.querySelector(".md-image-zoom-close");
      closeBtn.click();
      await flushPromises();

      expect(el.shadowRoot.querySelector(".md-image-zoom-overlay")).toBeNull();
    });

    it("closes the overlay when the backdrop (not the image) is clicked", async () => {
      global.MarkdownCore = markdownCoreMockWithImage();
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "![a photo](/foo.png)";
      await renderWithImage(el);

      const img = el.shadowRoot.querySelector('[data-id="content"] img');
      img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();

      const overlay = el.shadowRoot.querySelector(".md-image-zoom-overlay");
      overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();

      expect(el.shadowRoot.querySelector(".md-image-zoom-overlay")).toBeNull();
    });

    it("does not close the overlay when the zoomed image itself is clicked", async () => {
      global.MarkdownCore = markdownCoreMockWithImage();
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "![a photo](/foo.png)";
      await renderWithImage(el);

      const img = el.shadowRoot.querySelector('[data-id="content"] img');
      img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();

      const zoomedImg = el.shadowRoot.querySelector(".md-image-zoom-img");
      zoomedImg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();

      expect(el.shadowRoot.querySelector(".md-image-zoom-overlay")).not.toBeNull();
    });

    it("closes the overlay on Escape key", async () => {
      global.MarkdownCore = markdownCoreMockWithImage();
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "![a photo](/foo.png)";
      await renderWithImage(el);

      const img = el.shadowRoot.querySelector('[data-id="content"] img');
      img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
      expect(el.shadowRoot.querySelector(".md-image-zoom-overlay")).not.toBeNull();

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flushPromises();

      expect(el.shadowRoot.querySelector(".md-image-zoom-overlay")).toBeNull();
    });

    function scaleFromStyle(imgEl) {
      const match = /scale\(([\d.]+)\)/.exec(imgEl.style.cssText);
      return match ? Number(match[1]) : null;
    }

    function translateFromStyle(imgEl) {
      const match = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(
        imgEl.style.cssText
      );
      return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
    }

    async function openZoom(el) {
      const img = el.shadowRoot.querySelector('[data-id="content"] img');
      img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
      return el.shadowRoot.querySelector(".md-image-zoom-img");
    }

    it("zooms in and out via the wheel event, clamped to [1, 5]", async () => {
      global.MarkdownCore = markdownCoreMockWithImage();
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "![a photo](/foo.png)";
      await renderWithImage(el);
      const zoomedImg = await openZoom(el);

      expect(scaleFromStyle(zoomedImg)).toBe(1);

      zoomedImg.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
      await flushPromises();
      expect(scaleFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))).toBe(
        1.5
      );

      for (let i = 0; i < 10; i += 1) {
        el.shadowRoot
          .querySelector(".md-image-zoom-img")
          .dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
        // eslint-disable-next-line no-await-in-loop
        await flushPromises();
      }
      expect(scaleFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))).toBe(
        5
      );

      el.shadowRoot
        .querySelector(".md-image-zoom-img")
        .dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true }));
      await flushPromises();
      expect(scaleFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))).toBe(
        4.5
      );
    });

    it("zooms via the toolbar buttons and resets with the reset button", async () => {
      global.MarkdownCore = markdownCoreMockWithImage();
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "![a photo](/foo.png)";
      await renderWithImage(el);
      await openZoom(el);

      const [zoomOutBtn, resetBtn, zoomInBtn] =
        el.shadowRoot.querySelectorAll(".md-image-zoom-btn");

      zoomInBtn.click();
      await flushPromises();
      expect(
        scaleFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))
      ).toBe(1.5);

      zoomOutBtn.click();
      await flushPromises();
      expect(
        scaleFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))
      ).toBe(1);

      zoomInBtn.click();
      zoomInBtn.click();
      resetBtn.click();
      await flushPromises();
      expect(
        scaleFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))
      ).toBe(1);
    });

    it("toggles zoom on double-click", async () => {
      global.MarkdownCore = markdownCoreMockWithImage();
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "![a photo](/foo.png)";
      await renderWithImage(el);
      const zoomedImg = await openZoom(el);

      zoomedImg.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      await flushPromises();
      expect(
        scaleFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))
      ).toBe(2);

      el.shadowRoot
        .querySelector(".md-image-zoom-img")
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      await flushPromises();
      expect(
        scaleFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))
      ).toBe(1);
    });

    it("supports keyboard zoom (+/-/0)", async () => {
      global.MarkdownCore = markdownCoreMockWithImage();
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "![a photo](/foo.png)";
      await renderWithImage(el);
      await openZoom(el);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "+" }));
      await flushPromises();
      expect(
        scaleFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))
      ).toBe(1.5);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "0" }));
      await flushPromises();
      expect(
        scaleFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))
      ).toBe(1);
    });

    it("pans the zoomed image by dragging, but not while at 1x", async () => {
      global.MarkdownCore = markdownCoreMockWithImage();
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "![a photo](/foo.png)";
      await renderWithImage(el);
      let zoomedImg = await openZoom(el);

      // Dragging at 1x should not pan (nothing to pan into view yet).
      zoomedImg.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: 0, clientY: 0 })
      );
      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 50, clientY: 30 })
      );
      await flushPromises();
      expect(
        translateFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))
      ).toEqual({ x: 0, y: 0 });

      zoomedImg.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      await flushPromises();
      zoomedImg = el.shadowRoot.querySelector(".md-image-zoom-img");
      expect(scaleFromStyle(zoomedImg)).toBe(2);

      zoomedImg.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: 0, clientY: 0 })
      );
      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 40, clientY: -20 })
      );
      await flushPromises();
      expect(
        translateFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))
      ).toEqual({ x: 40, y: -20 });

      window.dispatchEvent(new MouseEvent("mouseup"));
      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 100, clientY: 100 })
      );
      await flushPromises();
      // Movement after mouseup must not continue panning.
      expect(
        translateFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))
      ).toEqual({ x: 40, y: -20 });
    });

    it("resets zoom/pan state when the overlay is reopened for a new image", async () => {
      global.MarkdownCore = markdownCoreMockWithImage();
      window.MarkdownCore = global.MarkdownCore;
      const el = createElement("c-markdown-viewer", { is: MarkdownViewer });
      el.value = "![a photo](/foo.png)";
      await renderWithImage(el);
      let zoomedImg = await openZoom(el);

      zoomedImg.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      await flushPromises();
      expect(
        scaleFromStyle(el.shadowRoot.querySelector(".md-image-zoom-img"))
      ).toBe(2);

      const closeBtn = el.shadowRoot.querySelector(".md-image-zoom-close");
      closeBtn.click();
      await flushPromises();

      zoomedImg = await openZoom(el);
      expect(scaleFromStyle(zoomedImg)).toBe(1);
    });
  });
});
