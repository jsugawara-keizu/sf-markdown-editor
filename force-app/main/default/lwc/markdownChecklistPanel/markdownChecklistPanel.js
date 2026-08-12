import { LightningElement, api, track, wire } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { getRecord, getRecordNotifyChange } from "lightning/uiRecordApi";
import { loadScript } from "lightning/platformResourceLoader";
import MARKDOWN_CORE from "@salesforce/resourceUrl/markdownCore";
import USER_ID from "@salesforce/user/Id";
import getTasksForField from "@salesforce/apex/MarkdownTaskSync.getTasksForField";
import createTaskForCheckbox from "@salesforce/apex/MarkdownTaskSync.createTaskForCheckbox";
import saveMarkdownWithImages from "@salesforce/apex/MarkdownImageHandler.saveMarkdownWithImages";
import PANEL_TITLE from "@salesforce/label/c.MarkdownChecklistPanelTitle";
import UNTODO_LABEL from "@salesforce/label/c.MarkdownChecklistUntodoLabel";
import DONE_LABEL from "@salesforce/label/c.MarkdownChecklistDoneLabel";
import OPEN_LABEL from "@salesforce/label/c.MarkdownChecklistOpenLabel";
import ORPHAN_LABEL from "@salesforce/label/c.MarkdownChecklistOrphanLabel";
import CREATE_TASK_BUTTON_LABEL from "@salesforce/label/c.MarkdownChecklistCreateTaskButtonLabel";
import ASSIGNEE_LABEL from "@salesforce/label/c.MarkdownChecklistAssigneeLabel";
import EMPTY_STATE_LABEL from "@salesforce/label/c.MarkdownChecklistEmptyStateLabel";
import CREATE_ERROR_TITLE from "@salesforce/label/c.MarkdownChecklistCreateErrorTitle";
import CREATE_SUCCESS_TITLE from "@salesforce/label/c.MarkdownChecklistCreateSuccessTitle";
import LOAD_ERROR_LABEL from "@salesforce/label/c.MarkdownChecklistLoadErrorLabel";

const LABELS = {
  panelTitle: PANEL_TITLE,
  untodo: UNTODO_LABEL,
  done: DONE_LABEL,
  open: OPEN_LABEL,
  orphan: ORPHAN_LABEL,
  createTaskButton: CREATE_TASK_BUTTON_LABEL,
  assignee: ASSIGNEE_LABEL,
  emptyState: EMPTY_STATE_LABEL,
  createErrorTitle: CREATE_ERROR_TITLE,
  createSuccessTitle: CREATE_SUCCESS_TITLE,
  loadErrorLabel: LOAD_ERROR_LABEL
};

function randomMarkerId() {
  // Short enough to stay unobtrusive as trailing text on a checkbox line,
  // long enough that two markers colliding is not a practical concern.
  return Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

export default class MarkdownChecklistPanel extends NavigationMixin(
  LightningElement
) {
  @api recordId;
  @api objectApiName;
  @api fieldApiName;

  labels = LABELS;

  _providedMarkdownText = null;
  _wiredMarkdownText = "";
  @track tasks = [];
  @track tasksError = null;
  @track isCreating = false;
  // Toggled purely to force a re-render once window.MarkdownCore becomes
  // available; the `rows` getter itself re-reads window.MarkdownCore fresh
  // every time regardless of this value.
  @track _coreReady = false;
  _selectedOwnerByLine = new Map();
  _corePollTimer = null;

  connectedCallback() {
    // This component reads window.MarkdownCore directly (see `rows` below)
    // instead of taking a markdown-core dependency of its own, so it stays
    // in sync with whatever build markdownViewer/markdownEditor already
    // loaded on the page. When this panel is the only markdown-core
    // consumer present (standalone on a record page, no sibling viewer),
    // nothing else would ever load the script — so load it here too;
    // loadScript de-dupes by URL, so this is a no-op when a viewer already
    // triggered the load.
    //
    // The load is polled rather than trusted to this component's own
    // loadScript().then() alone: this panel is normally a sibling of
    // markdownViewer/markdownEditor, and either side's script tag can win
    // the race to actually populate window.MarkdownCore first. A one-shot
    // "my own promise resolved" flag misses the case where the *other*
    // component's load is what actually finishes first — the global goes
    // ready, but nothing here ever re-renders to notice. Polling checks the
    // actual shared global instead of any single load promise.
    if (typeof window !== "undefined" && window.MarkdownCore) {
      this._coreReady = true;
    } else {
      loadScript(this, `${MARKDOWN_CORE}/markdown-core.iife.js`).catch(
        (err) => {
          console.error(
            "[markdownChecklistPanel] markdown-core load failed:",
            err
          );
        }
      );
      /* eslint-disable-next-line @lwc/lwc/no-async-operation */
      this._corePollTimer = setInterval(() => {
        if (typeof window === "undefined" || !window.MarkdownCore) {
          return;
        }
        clearInterval(this._corePollTimer);
        this._corePollTimer = null;
        this._coreReady = true;
      }, 150);
    }

    this.loadTasks();
  }

  disconnectedCallback() {
    if (this._corePollTimer) {
      clearInterval(this._corePollTimer);
      this._corePollTimer = null;
    }
  }

  // Fetched imperatively (rather than via @wire) so task-list refreshes
  // stay a plain, easily-testable promise chain — the same pattern already
  // used for the create-task round trip below.
  loadTasks() {
    if (!this.recordId || !this.normalizedFieldApiName) {
      return;
    }
    getTasksForField({
      whatId: this.recordId,
      fieldApiName: this.normalizedFieldApiName
    })
      .then((data) => {
        this.tasks = data;
        this.tasksError = null;
      })
      .catch((err) => {
        this.tasksError = err;
      });
  }

  @api
  get markdownText() {
    return this.effectiveMarkdownText;
  }
  set markdownText(value) {
    this._providedMarkdownText = typeof value === "string" ? value : "";
  }

  // Embedded usage (markdownEditor) pushes the current source text down via
  // this prop on every keystroke; standalone usage (dropped directly on a
  // record page) never sets it, so this component fetches its own copy via
  // the field wire below instead.
  get isEmbedded() {
    return this._providedMarkdownText !== null;
  }

  get effectiveMarkdownText() {
    return this.isEmbedded ? this._providedMarkdownText : this._wiredMarkdownText;
  }

  get normalizedFieldApiName() {
    return typeof this.fieldApiName === "string"
      ? this.fieldApiName.trim()
      : this.fieldApiName;
  }

  get qualifiedFields() {
    if (this.isEmbedded || !this.objectApiName || !this.normalizedFieldApiName) {
      return [];
    }
    return [`${this.objectApiName}.${this.normalizedFieldApiName}`];
  }

  @wire(getRecord, { recordId: "$recordId", fields: "$qualifiedFields" })
  wiredRecord({ data }) {
    if (this.isEmbedded || !data) {
      return;
    }
    const fieldData = data.fields[this.normalizedFieldApiName];
    this._wiredMarkdownText = fieldData ? fieldData.value || "" : "";
  }

  get hasLoadError() {
    return !!this.tasksError;
  }

  get rows() {
    // `this._coreReady` is read here (not just checked via the module-level
    // window.MarkdownCore global) so LWC's reactive dependency tracking
    // actually associates this getter with that field. Without reading it,
    // flipping _coreReady from the poll in connectedCallback is a mutation
    // nothing is known to depend on, so it never triggers a re-render — the
    // getter silently keeps returning its first (empty) answer forever.
    if (!this._coreReady || typeof window === "undefined") {
      return [];
    }
    const markdownCore = window.MarkdownCore;
    if (!markdownCore) {
      return [];
    }
    const items = markdownCore.extractCheckboxItems(
      this.effectiveMarkdownText || ""
    );
    const tasksByMarker = new Map(
      this.tasks
        .filter((t) => t.markdownMarkerId)
        .map((t) => [t.markdownMarkerId, t])
    );
    const usedMarkers = new Set();
    const rows = [];

    items.forEach((item) => {
      const task = item.markerId ? tasksByMarker.get(item.markerId) : null;
      if (item.markerId) {
        usedMarkers.add(item.markerId);
      }
      if (task) {
        rows.push({
          kind: "linked",
          key: `linked-${item.markerId}`,
          text: item.text,
          task,
          statusLabel: task.isClosed ? LABELS.done : LABELS.open,
          statusClass: task.isClosed
            ? "md-checklist-badge md-checklist-badge--done"
            : "md-checklist-badge md-checklist-badge--open"
        });
      } else {
        rows.push({
          kind: "untodo",
          key: `untodo-${item.line}`,
          line: item.line,
          text: item.text,
          checked: item.checked,
          ownerId: this._selectedOwnerByLine.get(item.line) || USER_ID
        });
      }
    });

    this.tasks.forEach((task) => {
      if (task.markdownMarkerId && !usedMarkers.has(task.markdownMarkerId)) {
        rows.push({
          kind: "orphan",
          key: `orphan-${task.id}`,
          text: task.subject,
          task,
          statusLabel: LABELS.orphan,
          statusClass: "md-checklist-badge md-checklist-badge--orphan"
        });
      }
    });

    return rows;
  }

  get untodoCount() {
    return this.rows.filter((r) => r.kind === "untodo").length;
  }

  get doneCount() {
    return this.rows.filter((r) => r.kind === "linked" && r.task.isClosed)
      .length;
  }

  get openCount() {
    return this.rows.filter((r) => r.kind === "linked" && !r.task.isClosed)
      .length;
  }

  get orphanCount() {
    return this.rows.filter((r) => r.kind === "orphan").length;
  }

  get hasRows() {
    return this.rows.length > 0;
  }

  handleOwnerChange(event) {
    const line = Number(event.currentTarget.dataset.line);
    const ownerId = event.detail.recordId;
    if (ownerId) {
      this._selectedOwnerByLine.set(line, ownerId);
    } else {
      this._selectedOwnerByLine.delete(line);
    }
  }

  handleTaskClick(event) {
    const taskId = event.currentTarget.dataset.taskId;
    if (!taskId) {
      return;
    }
    this[NavigationMixin.Navigate]({
      type: "standard__recordPage",
      attributes: { recordId: taskId, objectApiName: "Task", actionName: "view" }
    });
  }

  handleCreateTask(event) {
    if (this.isCreating) {
      return;
    }
    const line = Number(event.currentTarget.dataset.line);
    const row = this.rows.find((r) => r.kind === "untodo" && r.line === line);
    if (!row) {
      return;
    }

    const markerId = randomMarkerId();
    const markdownCore =
      typeof window !== "undefined" ? window.MarkdownCore : null;
    if (!markdownCore) {
      return;
    }
    const updatedMarkdown = markdownCore.insertCheckboxMarker(
      this.effectiveMarkdownText || "",
      line,
      markerId
    );

    this.isCreating = true;
    let createdTask;
    createTaskForCheckbox({
      whatId: this.recordId,
      fieldApiName: this.normalizedFieldApiName,
      markerId,
      subject: row.text,
      checked: row.checked,
      ownerId: row.ownerId
    })
      .then((task) => {
        createdTask = task;
        this.tasks = [...this.tasks, task];
        // Persisted immediately in both modes — "Create Task" is a
        // deliberate, discrete action, not part of freeform editing, so it
        // must not depend on the embedded MarkdownEditor's separate Save
        // button. Leaving the marker only in an embedded host's unsaved
        // internalValue meant a page reload before the next Save silently
        // stranded the just-created Task with no matching checkbox line.
        return saveMarkdownWithImages({
          recordId: this.recordId,
          objectApiName: this.objectApiName,
          fieldApiName: this.normalizedFieldApiName,
          markdownContent: updatedMarkdown
        });
      })
      .then((saved) => {
        this._wiredMarkdownText = saved;
        getRecordNotifyChange([{ recordId: this.recordId }]);
        if (this.isEmbedded) {
          this.dispatchEvent(
            new CustomEvent("checklisttaskcreated", {
              detail: { updatedMarkdown: saved, task: createdTask }
            })
          );
        }
      })
      .then(() => {
        this.dispatchEvent(
          new ShowToastEvent({
            title: this.labels.createSuccessTitle,
            message: row.text,
            variant: "success"
          })
        );
      })
      .catch((err) => {
        this.dispatchEvent(
          new ShowToastEvent({
            title: this.labels.createErrorTitle,
            message: err.body ? err.body.message : err.message,
            variant: "error"
          })
        );
      })
      .finally(() => {
        this.isCreating = false;
      });
  }
}
