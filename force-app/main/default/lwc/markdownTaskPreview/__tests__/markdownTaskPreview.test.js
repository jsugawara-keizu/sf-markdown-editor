import { createElement } from "lwc";
import MarkdownTaskPreview from "c/markdownTaskPreview";

describe("c-markdown-task-preview", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("renders preview container when showPreview is true", () => {
    const element = createElement("c-markdown-task-preview", {
      is: MarkdownTaskPreview
    });
    document.body.appendChild(element);

    element.showPreviewFor(
      "task-1",
      { top: 100, left: 100, right: 200, bottom: 120 },
      1024,
      768
    );

    return Promise.resolve().then(() => {
      const preview = element.shadowRoot.querySelector(".md-task-preview");
      expect(preview).not.toBeNull();
    });
  });

  describe("timer disposal", () => {
    it("clears the pending hover-hide timeout on disconnect", () => {
      const clearTimeoutSpy = jest.spyOn(window, "clearTimeout");
      const setTimeoutSpy = jest.spyOn(window, "setTimeout");

      const element = createElement("c-markdown-task-preview", {
        is: MarkdownTaskPreview
      });
      document.body.appendChild(element);

      element.showPreviewFor(
        "task-1",
        { top: 100, left: 100, right: 200, bottom: 120 },
        1024,
        768
      );
      element.hidePreview();

      const scheduledId =
        setTimeoutSpy.mock.results[setTimeoutSpy.mock.results.length - 1]
          .value;
      clearTimeoutSpy.mockClear();

      document.body.removeChild(element);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(scheduledId);

      clearTimeoutSpy.mockRestore();
      setTimeoutSpy.mockRestore();
    });

    it("does not hide the preview after disconnect once the hover-hide delay would have elapsed", () => {
      jest.useFakeTimers();
      try {
        const element = createElement("c-markdown-task-preview", {
          is: MarkdownTaskPreview
        });
        document.body.appendChild(element);

        element.showPreviewFor(
          "task-1",
          { top: 100, left: 100, right: 200, bottom: 120 },
          1024,
          768
        );
        element.hidePreview();
        document.body.removeChild(element);

        // If disconnectedCallback had NOT cleared the timer, this would
        // throw/mutate a disposed component's internals.
        expect(() => jest.advanceTimersByTime(500)).not.toThrow();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // Moving the mouse between input fields inside the popover (e.g. onto a
  // date-picker overlay) can trigger a transient mouseleave on the popover
  // container. The popover must not close while a field inside it still
  // has focus.
  describe("stays open while an inner field has focus", () => {
    it("does not close on mouseleave while focus is within the popover", async () => {
      jest.useFakeTimers();
      try {
        const element = createElement("c-markdown-task-preview", {
          is: MarkdownTaskPreview
        });
        document.body.appendChild(element);

        element.showPreviewFor(
          "task-1",
          { top: 100, left: 100, right: 200, bottom: 120 },
          1024,
          768
        );

        await Promise.resolve();
        const preview = element.shadowRoot.querySelector(".md-task-preview");
        preview.dispatchEvent(
          new CustomEvent("focusin", { bubbles: true, composed: true })
        );
        preview.dispatchEvent(
          new CustomEvent("mouseleave", { bubbles: true, composed: true })
        );

        jest.advanceTimersByTime(500);

        expect(
          element.shadowRoot.querySelector(".md-task-preview")
        ).not.toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it("closes once focus truly leaves the popover", async () => {
      jest.useFakeTimers();
      try {
        const element = createElement("c-markdown-task-preview", {
          is: MarkdownTaskPreview
        });
        document.body.appendChild(element);

        element.showPreviewFor(
          "task-1",
          { top: 100, left: 100, right: 200, bottom: 120 },
          1024,
          768
        );

        await Promise.resolve();
        const preview = element.shadowRoot.querySelector(".md-task-preview");
        preview.dispatchEvent(
          new CustomEvent("focusin", { bubbles: true, composed: true })
        );
        preview.dispatchEvent(
          new CustomEvent("focusout", { bubbles: true, composed: true })
        );

        jest.advanceTimersByTime(500);
        await Promise.resolve();

        expect(
          element.shadowRoot.querySelector(".md-task-preview")
        ).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  it("dispatches restorefocus with the task id on Escape", async () => {
    const element = createElement("c-markdown-task-preview", {
      is: MarkdownTaskPreview
    });
    const handler = jest.fn();
    element.addEventListener("restorefocus", handler);
    document.body.appendChild(element);

    element.showPreviewFor(
      "task-1",
      { top: 100, left: 100, right: 200, bottom: 120 },
      1024,
      768
    );
    await Promise.resolve();

    const preview = element.shadowRoot.querySelector(".md-task-preview");
    preview.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    await Promise.resolve();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ taskId: "task-1" });
    expect(
      element.shadowRoot.querySelector(".md-task-preview")
    ).toBeNull();
  });

  it("re-dispatches lightning-record-edit-form success as previeweditsuccess", async () => {
    const element = createElement("c-markdown-task-preview", {
      is: MarkdownTaskPreview
    });
    const handler = jest.fn();
    element.addEventListener("previeweditsuccess", handler);
    document.body.appendChild(element);

    element.showPreviewFor(
      "task-1",
      { top: 100, left: 100, right: 200, bottom: 120 },
      1024,
      768
    );
    await Promise.resolve();

    const form = element.shadowRoot.querySelector(
      "lightning-record-edit-form"
    );
    form.dispatchEvent(
      new CustomEvent("success", { detail: { id: "task-1" } })
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ id: "task-1" });
  });

  it("closes the popover on successful save, so a save has a visible effect even without a toast", async () => {
    const element = createElement("c-markdown-task-preview", {
      is: MarkdownTaskPreview
    });
    document.body.appendChild(element);

    element.showPreviewFor(
      "task-1",
      { top: 100, left: 100, right: 200, bottom: 120 },
      1024,
      768
    );
    await Promise.resolve();

    const form = element.shadowRoot.querySelector(
      "lightning-record-edit-form"
    );
    form.dispatchEvent(new CustomEvent("success", { detail: {} }));
    await Promise.resolve();

    expect(
      element.shadowRoot.querySelector(".md-task-preview")
    ).toBeNull();
  });

  describe("Edit tab (editableFieldApiNames)", () => {
    // Details and Edit tabs share a single lightning-record-edit-form (not
    // one each) — two forms bound to the same recordId broke submission
    // entirely (silently: no error, no network call, nothing persisted).
    // Confirmed live against hk.issue: Details-tab saves stopped working too
    // as soon as the second per-tab form was added, and reverting to one
    // shared form fixed both.
    it("renders both tabs' fields inside the same lightning-record-edit-form", async () => {
      const element = createElement("c-markdown-task-preview", {
        is: MarkdownTaskPreview
      });
      element.previewFields = [{ apiName: "Status" }];
      element.editableFieldApiNames = ["Priority", "OwnerId"];
      document.body.appendChild(element);

      element.showPreviewFor(
        "task-1",
        { top: 100, left: 100, right: 200, bottom: 120 },
        1024,
        768
      );
      await Promise.resolve();

      const forms = element.shadowRoot.querySelectorAll(
        "lightning-record-edit-form"
      );
      expect(forms).toHaveLength(1);

      const fields = forms[0].querySelectorAll("lightning-input-field");
      expect(Array.from(fields).map((f) => f.fieldName)).toEqual([
        "Status",
        "Priority",
        "OwnerId"
      ]);
    });

    it("submits both tabs' fields via a single Save button", async () => {
      const element = createElement("c-markdown-task-preview", {
        is: MarkdownTaskPreview
      });
      element.editableFieldApiNames = ["Priority"];
      document.body.appendChild(element);

      element.showPreviewFor(
        "task-1",
        { top: 100, left: 100, right: 200, bottom: 120 },
        1024,
        768
      );
      await Promise.resolve();

      expect(
        element.shadowRoot.querySelectorAll("lightning-button")
      ).toHaveLength(1);
    });
  });
});
