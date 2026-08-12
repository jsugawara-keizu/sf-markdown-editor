// Ported from sf-gantt-lwc's ganttTaskPreview (private hover/focus preview
// subcomponent for its own kanban-style record cards).
import { LightningElement, api } from "lwc";
import { NavigationMixin } from "lightning/navigation";

const HOVER_HIDE_DELAY_MS = 200;
const PREVIEW_MARGIN = 8;
const PREVIEW_WIDTH = 360;
const PREVIEW_HEIGHT = 200;

export default class MarkdownTaskPreview extends NavigationMixin(
  LightningElement
) {
  @api previewFields = [];
  @api editableFieldApiNames = [];
  @api label = {};

  _hoverTaskId = undefined;
  _previewStyle = "";
  _hoverHideTimeoutId = null;
  _isPointerInside = false;
  _hasFocusWithin = false;

  disconnectedCallback() {
    window.clearTimeout(this._hoverHideTimeoutId);
  }

  get showPreview() {
    return !!this._hoverTaskId;
  }

  get previewStyle() {
    return this._previewStyle;
  }

  get hoveredTaskId() {
    return this._hoverTaskId;
  }

  @api
  showPreviewFor(taskId, rect, viewportWidth, viewportHeight) {
    window.clearTimeout(this._hoverHideTimeoutId);
    this._hoverTaskId = taskId;
    this._previewStyle = this._computePreviewStyle(
      rect,
      viewportWidth,
      viewportHeight
    );
  }

  @api
  hidePreview() {
    window.clearTimeout(this._hoverHideTimeoutId);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._hoverHideTimeoutId = setTimeout(() => {
      if (this._isPointerInside || this._hasFocusWithin) return;
      this._hoverTaskId = undefined;
    }, HOVER_HIDE_DELAY_MS);
  }

  handleMouseEnter() {
    this._isPointerInside = true;
    window.clearTimeout(this._hoverHideTimeoutId);
  }

  handleMouseLeave() {
    this._isPointerInside = false;
    this._scheduleHideIfIdle();
  }

  handleFocusIn() {
    this._hasFocusWithin = true;
    window.clearTimeout(this._hoverHideTimeoutId);
  }

  handleFocusOut() {
    this._hasFocusWithin = false;
    // focusout fires before the next element receives focus (e.g. tabbing
    // between fields), so defer the check until the new active element settles.
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    setTimeout(() => {
      if (this.template.activeElement) {
        this._hasFocusWithin = true;
        return;
      }
      this._scheduleHideIfIdle();
    }, 0);
  }

  _scheduleHideIfIdle() {
    if (this._isPointerInside || this._hasFocusWithin) return;
    this.hidePreview();
  }

  handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      this._closeAndRestoreFocus();
    }
  }

  // Touch devices never fire mouseleave, so hidePreview()'s hover-based
  // auto-close (and the Escape key) are both unreachable there — this is
  // the only way a touch user can dismiss the popover.
  handleCloseClick() {
    this._closeAndRestoreFocus();
  }

  _closeAndRestoreFocus() {
    window.clearTimeout(this._hoverHideTimeoutId);
    const taskId = this._hoverTaskId;
    this._hoverTaskId = undefined;
    this.dispatchEvent(
      new CustomEvent("restorefocus", { detail: { taskId } })
    );
  }

  handleOpenRecord() {
    if (!this._hoverTaskId) return;
    this[NavigationMixin.GenerateUrl]({
      type: "standard__recordPage",
      attributes: { recordId: this._hoverTaskId, actionName: "view" }
    }).then((url) => {
      window.open(url, "_blank");
    });
  }

  handleEditSuccess(event) {
    // Closed immediately (rather than left open) so a successful save has a
    // visible effect even without a toast — same convention as
    // sf-kanban-lwc's kanbanBoard.handleRecordEditSuccess. The parent shows
    // the toast itself (see markdownChecklistPanel.handlePreviewEditSuccess).
    window.clearTimeout(this._hoverHideTimeoutId);
    this._hoverTaskId = undefined;
    this.dispatchEvent(
      new CustomEvent("previeweditsuccess", {
        detail: event.detail
      })
    );
  }

  _computePreviewStyle(rect, viewportWidth, viewportHeight) {
    let left = rect.right + PREVIEW_MARGIN;
    if (viewportWidth - rect.right < PREVIEW_WIDTH + PREVIEW_MARGIN * 2) {
      left = rect.left - PREVIEW_WIDTH - PREVIEW_MARGIN;
    }
    let top = rect.top;
    if (viewportHeight - rect.top < PREVIEW_HEIGHT + PREVIEW_MARGIN * 2) {
      top = Math.max(PREVIEW_MARGIN, rect.bottom - PREVIEW_HEIGHT);
    }
    const clamped = this._clampToViewport(
      left,
      top,
      PREVIEW_WIDTH,
      PREVIEW_HEIGHT,
      viewportWidth,
      viewportHeight
    );
    return `left:${clamped.left}px; top:${clamped.top}px; width:${PREVIEW_WIDTH}px;`;
  }

  _clampToViewport(left, top, width, height, viewportWidth, viewportHeight) {
    const maxX = Math.max(0, viewportWidth - width);
    const maxY = Math.max(0, viewportHeight - height);
    return {
      left: Math.max(0, Math.min(left, maxX)),
      top: Math.max(0, Math.min(top, maxY))
    };
  }
}
