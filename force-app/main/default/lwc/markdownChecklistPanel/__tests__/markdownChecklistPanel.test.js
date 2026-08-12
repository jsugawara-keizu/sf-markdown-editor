import { createElement } from "lwc";
import MarkdownChecklistPanel from "c/markdownChecklistPanel";
import { getRecordNotifyChange } from "lightning/uiRecordApi";
import getTasksForField from "@salesforce/apex/MarkdownTaskSync.getTasksForField";
import createTaskForCheckbox from "@salesforce/apex/MarkdownTaskSync.createTaskForCheckbox";
import saveMarkdownWithImages from "@salesforce/apex/MarkdownImageHandler.saveMarkdownWithImages";

jest.mock("lightning/uiRecordApi", () => {
  const actual = jest.requireActual("lightning/uiRecordApi");
  return { ...actual, getRecordNotifyChange: jest.fn() };
});

jest.mock(
  "@salesforce/apex/MarkdownTaskSync.getTasksForField",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/MarkdownTaskSync.createTaskForCheckbox",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/MarkdownImageHandler.saveMarkdownWithImages",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

jest.mock(
  "lightning/platformResourceLoader",
  () => ({ loadScript: jest.fn(() => Promise.resolve()) }),
  { virtual: true }
);

jest.mock("@salesforce/resourceUrl/markdownCore", () => "/markdownCore", {
  virtual: true
});

jest.mock("@salesforce/user/Id", () => ({ default: "005000000000001AAA" }), {
  virtual: true
});

function markdownCoreStub() {
  return {
    extractCheckboxItems: jest.fn((markdown) => {
      // Minimal stand-in for the real markdown-core implementation, just
      // enough for this component's own logic to be exercised in isolation.
      const lines = markdown.split("\n");
      const items = [];
      lines.forEach((line, idx) => {
        const match = /^-\s+\[([ xX])\]\s*(.*)$/.exec(line);
        if (!match) {
          return;
        }
        const markerMatch = /\s*\^\[todo:([0-9a-f]+)\]\s*$/.exec(match[2]);
        items.push({
          line: idx + 1,
          checked: match[1].toLowerCase() === "x",
          text: markerMatch ? match[2].slice(0, markerMatch.index) : match[2],
          markerId: markerMatch ? markerMatch[1] : null
        });
      });
      return items;
    }),
    insertCheckboxMarker: jest.fn((markdown, line, markerId) => {
      const lines = markdown.split("\n");
      lines[line - 1] = `${lines[line - 1]} ^[todo:${markerId}]`;
      return lines.join("\n");
    })
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("c-markdown-checklist-panel", () => {
  beforeEach(() => {
    window.MarkdownCore = markdownCoreStub();
    getTasksForField.mockReset();
    createTaskForCheckbox.mockReset();
    saveMarkdownWithImages.mockReset();
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    delete window.MarkdownCore;
  });

  it("recovers via polling when window.MarkdownCore becomes ready after mount (sibling-load race)", async () => {
    // Regression test: this panel is normally a sibling of markdownViewer,
    // which also loads markdown-core. If markdown-core isn't ready yet at
    // connectedCallback time, this panel must keep checking rather than
    // giving up after a single unresolved load attempt — otherwise it gets
    // permanently stuck on the empty state even after the sibling's load
    // finishes and window.MarkdownCore becomes available.
    delete window.MarkdownCore;
    getTasksForField.mockResolvedValue([]);

    const el = createElement("c-markdown-checklist-panel", {
      is: MarkdownChecklistPanel
    });
    el.recordId = "001000000000001AAA";
    el.objectApiName = "Account";
    el.fieldApiName = "Description";
    el.markdownText = "- [ ] first item";
    document.body.appendChild(el);

    // Nothing has set window.MarkdownCore yet — this panel should not be
    // showing the row (core not ready), but should also not have crashed.
    expect(
      el.shadowRoot.querySelector('lightning-button[data-line="1"]')
    ).toBeNull();

    // A sibling component's script tag finishes loading and populates the
    // shared global — this panel only finds out via its own poll (real
    // timers here since faking them alongside the platformResourceLoader
    // mock's Promise made the mock resolve to `undefined` in this jest
    // version — not worth fighting; the poll interval is short).
    window.MarkdownCore = markdownCoreStub();
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(
      el.shadowRoot.querySelector('lightning-button[data-line="1"]')
    ).not.toBeNull();
  });

  it("shows an untodo row with a create-task button for an unmarked checkbox", async () => {
    getTasksForField.mockResolvedValue([]);
    const el = createElement("c-markdown-checklist-panel", {
      is: MarkdownChecklistPanel
    });
    el.recordId = "001000000000001AAA";
    el.objectApiName = "Account";
    el.fieldApiName = "Description";
    el.markdownText = "- [ ] first item";
    document.body.appendChild(el);
    await flushPromises();

    expect(
      el.shadowRoot.querySelector('lightning-button[data-line="1"]')
    ).not.toBeNull();
    expect(el.shadowRoot.textContent).toContain("first item");
  });

  it("shows a linked row with the task's status badge and owner", async () => {
    getTasksForField.mockResolvedValue([
      {
        id: "00T000000000001AAA",
        subject: "done item",
        status: "Completed",
        isClosed: true,
        ownerId: "005000000000001AAA",
        ownerName: "Jane Doe",
        markdownMarkerId: "abc123"
      }
    ]);
    const el = createElement("c-markdown-checklist-panel", {
      is: MarkdownChecklistPanel
    });
    el.recordId = "001000000000001AAA";
    el.objectApiName = "Account";
    el.fieldApiName = "Description";
    el.markdownText = "- [x] done item ^[todo:abc123]";
    document.body.appendChild(el);
    await flushPromises();

    expect(el.shadowRoot.textContent).toContain("done item");
    expect(el.shadowRoot.textContent).toContain("Jane Doe");
    expect(
      el.shadowRoot.querySelector(".md-checklist-badge--done")
    ).not.toBeNull();
  });

  it("shows an orphan row for a task whose checkbox line was removed", async () => {
    getTasksForField.mockResolvedValue([
      {
        id: "00T000000000002AAA",
        subject: "orphaned task",
        status: "Not Started",
        isClosed: false,
        ownerId: "005000000000001AAA",
        ownerName: "Jane Doe",
        markdownMarkerId: "zzz999"
      }
    ]);
    const el = createElement("c-markdown-checklist-panel", {
      is: MarkdownChecklistPanel
    });
    el.recordId = "001000000000001AAA";
    el.objectApiName = "Account";
    el.fieldApiName = "Description";
    el.markdownText = "no checkboxes here";
    document.body.appendChild(el);
    await flushPromises();

    expect(
      el.shadowRoot.querySelector(".md-checklist-badge--orphan")
    ).not.toBeNull();
    expect(el.shadowRoot.textContent).toContain("orphaned task");
  });

  it("persists immediately via saveMarkdownWithImages and dispatches checklisttaskcreated in embedded mode", async () => {
    // Regression test: creating a Task must persist the marker-inserted
    // markdown right away even when embedded in markdownEditor, not just
    // update the host's unsaved internalValue — otherwise a page reload
    // before the next manual Save silently loses the marker while the Task
    // itself remains, stranding it as an orphan row.
    getTasksForField.mockResolvedValue([]);
    createTaskForCheckbox.mockResolvedValue({
      id: "00T000000000003AAA",
      subject: "first item",
      status: "Not Started",
      isClosed: false,
      ownerId: "005000000000001AAA",
      ownerName: "Jane Doe",
      markdownMarkerId: "aaaaaa"
    });
    saveMarkdownWithImages.mockImplementation(({ markdownContent }) =>
      Promise.resolve(markdownContent)
    );

    const el = createElement("c-markdown-checklist-panel", {
      is: MarkdownChecklistPanel
    });
    el.recordId = "001000000000001AAA";
    el.objectApiName = "Account";
    el.fieldApiName = "Description";
    el.markdownText = "- [ ] first item";
    const handler = jest.fn();
    el.addEventListener("checklisttaskcreated", handler);
    document.body.appendChild(el);
    await flushPromises();

    el.shadowRoot.querySelector('lightning-button[data-line="1"]').click();
    await flushPromises();

    expect(createTaskForCheckbox).toHaveBeenCalledWith(
      expect.objectContaining({
        whatId: "001000000000001AAA",
        fieldApiName: "Description",
        subject: "first item",
        checked: false,
        ownerId: "005000000000001AAA"
      })
    );
    expect(saveMarkdownWithImages).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: "001000000000001AAA",
        objectApiName: "Account",
        fieldApiName: "Description",
        markdownContent: expect.stringMatching(
          /^- \[ \] first item \^\[todo:[0-9a-f]{6}\]$/
        )
      })
    );
    expect(getRecordNotifyChange).toHaveBeenCalledWith([
      { recordId: "001000000000001AAA" }
    ]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.updatedMarkdown).toMatch(
      /^- \[ \] first item \^\[todo:[0-9a-f]{6}\]$/
    );
  });

  it("persists via saveMarkdownWithImages instead of dispatching in standalone mode", async () => {
    const { getRecord } = jest.requireMock("lightning/uiRecordApi");
    getTasksForField.mockResolvedValue([]);
    createTaskForCheckbox.mockResolvedValue({
      id: "00T000000000004AAA",
      subject: "first item",
      status: "Not Started",
      isClosed: false,
      ownerId: "005000000000001AAA",
      ownerName: "Jane Doe",
      markdownMarkerId: "bbbbbb"
    });
    saveMarkdownWithImages.mockResolvedValue(
      "- [ ] first item ^[todo:bbbbbb]"
    );

    const el = createElement("c-markdown-checklist-panel", {
      is: MarkdownChecklistPanel
    });
    el.recordId = "001000000000001AAA";
    el.objectApiName = "Account";
    el.fieldApiName = "Description";
    // No markdownText set: standalone mode, sourced from the record wire.
    const handler = jest.fn();
    el.addEventListener("checklisttaskcreated", handler);
    document.body.appendChild(el);
    getRecord.emit({ fields: { Description: { value: "- [ ] first item" } } });
    await flushPromises();

    el.shadowRoot.querySelector('lightning-button[data-line="1"]').click();
    await flushPromises();

    expect(createTaskForCheckbox).toHaveBeenCalledWith(
      expect.objectContaining({
        whatId: "001000000000001AAA",
        fieldApiName: "Description",
        subject: "first item"
      })
    );
    expect(saveMarkdownWithImages).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: "001000000000001AAA",
        objectApiName: "Account",
        fieldApiName: "Description",
        markdownContent: expect.stringMatching(/\^\[todo:[0-9a-f]{6}\]$/)
      })
    );
    expect(getRecordNotifyChange).toHaveBeenCalledWith([
      { recordId: "001000000000001AAA" }
    ]);
    expect(handler).not.toHaveBeenCalled();
  });
});
