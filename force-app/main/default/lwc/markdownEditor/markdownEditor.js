import { LightningElement, api, track, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { getRecord, getRecordNotifyChange } from "lightning/uiRecordApi";
import { getObjectInfo } from "lightning/uiObjectInfoApi";
import saveMarkdownWithImages from "@salesforce/apex/MarkdownImageHandler.saveMarkdownWithImages";
import MARKDOWN_TOOLBAR_ARIA_LABEL from "@salesforce/label/c.MarkdownToolbarAriaLabel";
import MARKDOWN_BOLD_TITLE from "@salesforce/label/c.MarkdownBoldTitle";
import MARKDOWN_BOLD_LABEL from "@salesforce/label/c.MarkdownBoldLabel";
import MARKDOWN_ITALIC_TITLE from "@salesforce/label/c.MarkdownItalicTitle";
import MARKDOWN_ITALIC_LABEL from "@salesforce/label/c.MarkdownItalicLabel";
import MARKDOWN_HEADING_TITLE from "@salesforce/label/c.MarkdownHeadingTitle";
import MARKDOWN_HEADING_LABEL from "@salesforce/label/c.MarkdownHeadingLabel";
import MARKDOWN_CODE_TITLE from "@salesforce/label/c.MarkdownCodeTitle";
import MARKDOWN_CODE_LABEL from "@salesforce/label/c.MarkdownCodeLabel";
import MARKDOWN_UL_TITLE from "@salesforce/label/c.MarkdownUnorderedListTitle";
import MARKDOWN_UL_LABEL from "@salesforce/label/c.MarkdownUnorderedListLabel";
import MARKDOWN_OL_TITLE from "@salesforce/label/c.MarkdownOrderedListTitle";
import MARKDOWN_OL_LABEL from "@salesforce/label/c.MarkdownOrderedListLabel";
import MARKDOWN_LINK_TITLE from "@salesforce/label/c.MarkdownLinkTitle";
import MARKDOWN_LINK_LABEL from "@salesforce/label/c.MarkdownLinkLabel";
import MARKDOWN_TABLE_TITLE from "@salesforce/label/c.MarkdownTableTitle";
import MARKDOWN_TABLE_LABEL from "@salesforce/label/c.MarkdownTableLabel";
import MARKDOWN_STRIKETHROUGH_TITLE from "@salesforce/label/c.MarkdownStrikethroughTitle";
import MARKDOWN_STRIKETHROUGH_LABEL from "@salesforce/label/c.MarkdownStrikethroughLabel";
import MARKDOWN_BLOCKQUOTE_TITLE from "@salesforce/label/c.MarkdownBlockquoteTitle";
import MARKDOWN_BLOCKQUOTE_LABEL from "@salesforce/label/c.MarkdownBlockquoteLabel";
import MARKDOWN_IMAGE_TITLE from "@salesforce/label/c.MarkdownImageTitle";
import MARKDOWN_IMAGE_LABEL from "@salesforce/label/c.MarkdownImageLabel";
import MARKDOWN_HR_TITLE from "@salesforce/label/c.MarkdownHorizontalRuleTitle";
import MARKDOWN_HR_LABEL from "@salesforce/label/c.MarkdownHorizontalRuleLabel";
import MARKDOWN_EDIT_TAB_LABEL from "@salesforce/label/c.MarkdownEditTabLabel";
import MARKDOWN_PREVIEW_TAB_LABEL from "@salesforce/label/c.MarkdownPreviewTabLabel";
import MARKDOWN_SAVE_LABEL from "@salesforce/label/c.MarkdownSaveLabel";
import MARKDOWN_SAVED_LABEL from "@salesforce/label/c.MarkdownSavedLabel";
import MARKDOWN_EDITOR_PLACEHOLDER from "@salesforce/label/c.MarkdownEditorPlaceholder";
import MARKDOWN_EDITOR_ARIA_LABEL from "@salesforce/label/c.MarkdownEditorAriaLabel";
import MARKDOWN_PREVIEW_ARIA_LABEL from "@salesforce/label/c.MarkdownPreviewAriaLabel";
import MARKDOWN_TABS_ARIA_LABEL from "@salesforce/label/c.MarkdownTabsAriaLabel";
import MARKDOWN_CHAR_COUNT_SUFFIX from "@salesforce/label/c.MarkdownCharacterCountSuffix";
import MARKDOWN_UNSAVED_BADGE from "@salesforce/label/c.MarkdownUnsavedBadge";
import MARKDOWN_BOLD_PLACEHOLDER from "@salesforce/label/c.MarkdownBoldPlaceholder";
import MARKDOWN_ITALIC_PLACEHOLDER from "@salesforce/label/c.MarkdownItalicPlaceholder";
import MARKDOWN_HEADING_PLACEHOLDER from "@salesforce/label/c.MarkdownHeadingPlaceholder";
import MARKDOWN_LIST_PLACEHOLDER from "@salesforce/label/c.MarkdownListPlaceholder";
import MARKDOWN_LINK_PLACEHOLDER from "@salesforce/label/c.MarkdownLinkPlaceholder";
import MARKDOWN_TABLE_TEMPLATE from "@salesforce/label/c.MarkdownTableTemplate";
import MARKDOWN_TABLE_CELL_PLACEHOLDER from "@salesforce/label/c.MarkdownTableCellPlaceholder";
import MARKDOWN_TEXT_PLACEHOLDER from "@salesforce/label/c.MarkdownTextPlaceholder";
import MARKDOWN_BLOCKQUOTE_PLACEHOLDER from "@salesforce/label/c.MarkdownBlockquotePlaceholder";
import MARKDOWN_IMAGE_DESCRIPTION_PLACEHOLDER from "@salesforce/label/c.MarkdownImageDescriptionPlaceholder";
import MARKDOWN_SAVE_SUCCESS_TITLE from "@salesforce/label/c.MarkdownSaveSuccessTitle";
import MARKDOWN_SAVE_ERROR_TITLE from "@salesforce/label/c.MarkdownSaveErrorTitle";
import MARKDOWN_SAVE_SUCCESS_MESSAGE from "@salesforce/label/c.MarkdownSaveSuccessMessage";
import MARKDOWN_SAVE_ERROR_MESSAGE from "@salesforce/label/c.MarkdownSaveErrorMessage";
import MARKDOWN_UNDO_TITLE from "@salesforce/label/c.MarkdownUndoTitle";
import MARKDOWN_UNDO_LABEL from "@salesforce/label/c.MarkdownUndoLabel";
import MARKDOWN_REDO_TITLE from "@salesforce/label/c.MarkdownRedoTitle";
import MARKDOWN_REDO_LABEL from "@salesforce/label/c.MarkdownRedoLabel";
import MARKDOWN_CANCEL_TITLE from "@salesforce/label/c.MarkdownCancelTitle";
import MARKDOWN_CANCEL_LABEL from "@salesforce/label/c.MarkdownCancelLabel";
import MARKDOWN_SAVING_STATUS from "@salesforce/label/c.MarkdownSavingStatus";
import MARKDOWN_RECORD_ID_MISSING_ERROR from "@salesforce/label/c.MarkdownRecordIdMissingError";
import MARKDOWN_OBJECT_API_NAME_MISSING_ERROR from "@salesforce/label/c.MarkdownObjectApiNameMissingError";
import MARKDOWN_FIELD_API_NAME_MISSING_ERROR from "@salesforce/label/c.MarkdownFieldApiNameMissingError";
import MARKDOWN_FIELD_ACCESS_SUMMARY from "@salesforce/label/c.MarkdownFieldAccessSummary";

const LABELS = {
  toolbarAria: MARKDOWN_TOOLBAR_ARIA_LABEL,
  boldTitle: MARKDOWN_BOLD_TITLE,
  boldLabel: MARKDOWN_BOLD_LABEL,
  italicTitle: MARKDOWN_ITALIC_TITLE,
  italicLabel: MARKDOWN_ITALIC_LABEL,
  headingTitle: MARKDOWN_HEADING_TITLE,
  headingLabel: MARKDOWN_HEADING_LABEL,
  codeTitle: MARKDOWN_CODE_TITLE,
  codeLabel: MARKDOWN_CODE_LABEL,
  ulTitle: MARKDOWN_UL_TITLE,
  ulLabel: MARKDOWN_UL_LABEL,
  olTitle: MARKDOWN_OL_TITLE,
  olLabel: MARKDOWN_OL_LABEL,
  linkTitle: MARKDOWN_LINK_TITLE,
  linkLabel: MARKDOWN_LINK_LABEL,
  tableTitle: MARKDOWN_TABLE_TITLE,
  tableLabel: MARKDOWN_TABLE_LABEL,
  strikethroughTitle: MARKDOWN_STRIKETHROUGH_TITLE,
  strikethroughLabel: MARKDOWN_STRIKETHROUGH_LABEL,
  blockquoteTitle: MARKDOWN_BLOCKQUOTE_TITLE,
  blockquoteLabel: MARKDOWN_BLOCKQUOTE_LABEL,
  imageTitle: MARKDOWN_IMAGE_TITLE,
  imageLabel: MARKDOWN_IMAGE_LABEL,
  hrTitle: MARKDOWN_HR_TITLE,
  hrLabel: MARKDOWN_HR_LABEL,
  editTab: MARKDOWN_EDIT_TAB_LABEL,
  previewTab: MARKDOWN_PREVIEW_TAB_LABEL,
  saveLabel: MARKDOWN_SAVE_LABEL,
  savedLabel: MARKDOWN_SAVED_LABEL,
  editorPlaceholder: MARKDOWN_EDITOR_PLACEHOLDER,
  editorAria: MARKDOWN_EDITOR_ARIA_LABEL,
  previewAria: MARKDOWN_PREVIEW_ARIA_LABEL,
  tabsAria: MARKDOWN_TABS_ARIA_LABEL,
  charCountSuffix: MARKDOWN_CHAR_COUNT_SUFFIX,
  unsavedBadge: MARKDOWN_UNSAVED_BADGE,
  boldPlaceholder: MARKDOWN_BOLD_PLACEHOLDER,
  italicPlaceholder: MARKDOWN_ITALIC_PLACEHOLDER,
  headingPlaceholder: MARKDOWN_HEADING_PLACEHOLDER,
  listPlaceholder: MARKDOWN_LIST_PLACEHOLDER,
  linkPlaceholder: MARKDOWN_LINK_PLACEHOLDER,
  tableTemplate: MARKDOWN_TABLE_TEMPLATE,
  tableCellPlaceholder: MARKDOWN_TABLE_CELL_PLACEHOLDER,
  textPlaceholder: MARKDOWN_TEXT_PLACEHOLDER,
  blockquotePlaceholder: MARKDOWN_BLOCKQUOTE_PLACEHOLDER,
  imageDescriptionPlaceholder: MARKDOWN_IMAGE_DESCRIPTION_PLACEHOLDER,
  saveSuccessTitle: MARKDOWN_SAVE_SUCCESS_TITLE,
  saveSuccessMessage: MARKDOWN_SAVE_SUCCESS_MESSAGE,
  saveErrorTitle: MARKDOWN_SAVE_ERROR_TITLE,
  saveErrorMessage: MARKDOWN_SAVE_ERROR_MESSAGE,
  undoTitle: MARKDOWN_UNDO_TITLE,
  undoLabel: MARKDOWN_UNDO_LABEL,
  redoTitle: MARKDOWN_REDO_TITLE,
  redoLabel: MARKDOWN_REDO_LABEL,
  cancelTitle: MARKDOWN_CANCEL_TITLE,
  cancelLabel: MARKDOWN_CANCEL_LABEL,
  savingStatus: MARKDOWN_SAVING_STATUS,
  recordIdMissingError: MARKDOWN_RECORD_ID_MISSING_ERROR,
  objectApiNameMissingError: MARKDOWN_OBJECT_API_NAME_MISSING_ERROR,
  fieldApiNameMissingError: MARKDOWN_FIELD_API_NAME_MISSING_ERROR,
  fieldAccessSummary: MARKDOWN_FIELD_ACCESS_SUMMARY
};

// ---------------------------------------------------------------------------
// GFM テーブル自動修正
// ---------------------------------------------------------------------------

const RE_BARE_PIPE = /^\|\s*$/u;
const RE_SEP_CELL = /^[-:\s]*$/u;
const RE_TRAIL_NL = /\r?\n$/u;
const RE_FENCE_DELIM = /^\s*(```|~~~)/u;
const DEFAULT_MODE_EDIT = "edit";
const DEFAULT_MODE_PREVIEW = "preview";

const normalizeDefaultMode = (mode) => {
  if (typeof mode !== "string") {
    return DEFAULT_MODE_EDIT;
  }
  const normalized = mode.trim().toLowerCase();
  if (normalized === DEFAULT_MODE_PREVIEW) {
    return DEFAULT_MODE_PREVIEW;
  }
  return DEFAULT_MODE_EDIT;
};

const isBarePipe = (line) => RE_BARE_PIPE.test(line);

const isCompleteRow = (line) => {
  const trimmed = line.trimEnd();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && !isBarePipe(line);
};

const isFenceDelimiter = (line) => RE_FENCE_DELIM.test(line);

const isSeparatorRow = (line) => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return false;
  }
  return trimmed
    .replace(/^\||\|$/gu, "")
    .split("|")
    .every((cell) => RE_SEP_CELL.test(cell));
};

const fixMarkdownTables = (text) => {
  const lines = text.split("\n");
  const merged = [];
  let idx = 0;
  let inFence = false;

  // Pass 1: 分断された行を結合
  while (idx < lines.length) {
    const line = lines[idx];
    if (isFenceDelimiter(line)) {
      inFence = !inFence;
      merged.push(line);
      idx += 1;
      continue;
    }

    if (inFence) {
      merged.push(line);
      idx += 1;
      continue;
    }

    if (line.startsWith("|")) {
      let current = line;
      while (!isCompleteRow(current)) {
        if (idx + 1 >= lines.length) {
          break;
        }
        const next = lines[idx + 1];
        if (isFenceDelimiter(next)) {
          break;
        }
        if (next.startsWith("|") && !isBarePipe(next)) {
          break;
        }
        idx += 1;
        current =
          current.replace(RE_TRAIL_NL, "") + (next.trim() === "" ? " " : next);
      }
      merged.push(current);
    } else {
      merged.push(line);
    }
    idx += 1;
  }

  // Pass 2: テーブル内の余分なセパレータ行を除去
  const result = [];
  let pos = 0;
  inFence = false;
  while (pos < merged.length) {
    const line = merged[pos];
    if (isFenceDelimiter(line)) {
      inFence = !inFence;
      result.push(line);
      pos += 1;
      continue;
    }

    if (inFence || !line.startsWith("|")) {
      result.push(line);
      pos += 1;
      continue;
    }

    const block = [];
    while (
      pos < merged.length &&
      merged[pos].startsWith("|") &&
      !isFenceDelimiter(merged[pos])
    ) {
      block.push(merged[pos]);
      pos += 1;
    }
    let sepCount = 0;
    for (const bline of block) {
      if (isSeparatorRow(bline)) {
        if (sepCount === 0) {
          result.push(bline);
        }
        sepCount += 1;
      } else {
        result.push(bline);
      }
    }
  }

  return result.join("\n");
};

export { fixMarkdownTables };
export default class MarkdownEditor extends LightningElement {
  /** レコードページから自動注入 */
  @api recordId;
  @api objectApiName;

  /** App Builder で設定（例: Markdown__c） */
  @api fieldApiName;

  /** App Builder で設定する初期モード（edit / preview） */
  @api defaultMode = DEFAULT_MODE_EDIT;

  @track internalValue = "";
  @track activeTab = DEFAULT_MODE_EDIT;
  @track isSaving = false;
  @track fieldMaxLength = null;
  @track fieldIsUpdateable = true;
  @track fieldIsReadable = true;
  @track history = [];
  @track historyIndex = -1;
  labels = LABELS;
  isDirty = false;
  editStartValue = null;

  connectedCallback() {
    this.activeTab = normalizeDefaultMode(this.defaultMode);
  }

  get normalizedFieldApiName() {
    return typeof this.fieldApiName === "string"
      ? this.fieldApiName.trim()
      : this.fieldApiName;
  }

  get qualifiedFields() {
    if (!this.objectApiName || !this.normalizedFieldApiName) {
      return [];
    }
    return [`${this.objectApiName}.${this.normalizedFieldApiName}`];
  }

  @wire(getRecord, { recordId: "$recordId", fields: "$qualifiedFields" })
  wiredRecord({ data, error }) {
    if (error || !data) {
      return;
    }
    if (!this.isDirty) {
      const fieldData = data.fields[this.normalizedFieldApiName];
      this.internalValue = fieldData ? fieldData.value || "" : "";
      this.editStartValue = this.internalValue;
      this.recordHistory(this.internalValue, 0, 0);
    }
  }

  @wire(getObjectInfo, { objectApiName: "$objectApiName" })
  wiredObjectInfo({ data, error }) {
    if (data && this.normalizedFieldApiName) {
      const fieldInfo = data.fields[this.normalizedFieldApiName];
      if (fieldInfo) {
        this.fieldIsUpdateable = fieldInfo.updateable || false;
        this.fieldIsReadable = fieldInfo.isAccessible || false;
        this.fieldMaxLength = fieldInfo.length || null;
      } else {
        this.fieldIsUpdateable = false;
        this.fieldIsReadable = false;
        this.fieldMaxLength = null;
      }
    } else if (error) {
      this.fieldIsUpdateable = false;
      this.fieldIsReadable = false;
      this.fieldMaxLength = null;
    }

    if (!this.fieldIsUpdateable) {
      this.activeTab = DEFAULT_MODE_PREVIEW;
    }
  }

  get isEditMode() {
    return this.activeTab === "edit" && this.fieldIsUpdateable;
  }

  get isPreviewMode() {
    return this.activeTab === "preview";
  }

  get fieldHasAccess() {
    return this.fieldIsReadable || this.fieldIsUpdateable;
  }

  get isEditTabDisabled() {
    return !this.fieldIsUpdateable;
  }

  get textareaDisabled() {
    return this.isSaving || !this.fieldIsUpdateable;
  }

  get rootClass() {
    if (this.isPreviewMode) {
      return "md-editor-root md-editor-root--preview";
    }
    return "md-editor-root";
  }

  get editTabClass() {
    if (!this.fieldIsUpdateable) {
      return "md-tab md-tab--disabled";
    }
    if (this.activeTab === "edit") {
      return "md-tab md-tab--active";
    }
    return "md-tab";
  }

  get previewTabClass() {
    if (this.activeTab === "preview") {
      return "md-tab md-tab--active";
    }
    return "md-tab";
  }

  get charCount() {
    return this.internalValue.length;
  }

  get charCountDisplay() {
    return this.fieldMaxLength
      ? `${this.internalValue.length}/${this.fieldMaxLength}`
      : String(this.internalValue.length);
  }

  get canUndo() {
    return this.historyIndex > 0;
  }

  get canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  get isUndoDisabled() {
    return !this.canUndo || this.isSaving;
  }

  get isRedoDisabled() {
    return !this.canRedo || this.isSaving;
  }

  get isCancelDisabled() {
    return !this.isDirty || this.isSaving;
  }

  get isSaveDisabled() {
    return !this.isDirty || this.isSaving || !this.fieldIsUpdateable;
  }

  renderedCallback() {
    if (this.isEditMode) {
      const ta = this.template.querySelector('[data-id="textarea"]');
      if (ta && (!this.isDirty || ta.value !== this.internalValue)) {
        ta.value = this.internalValue;
      }
    }
  }

  handleTabClick(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab === "edit" && !this.fieldIsUpdateable) {
      return;
    }
    if (tab === "edit" && this.activeTab !== "edit") {
      this.editStartValue = this.internalValue;
      this.recordHistory(this.internalValue, 0, 0);
    }
    this.activeTab = tab;
  }

  handleInput(event) {
    this.internalValue = event.target.value;
    this.isDirty = true;
    this.recordHistory(
      this.internalValue,
      event.target.selectionStart,
      event.target.selectionEnd
    );
  }

  handleKeydown(event) {
    const { key, metaKey, ctrlKey } = event;
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const modKey = isMac ? metaKey : ctrlKey;
    if (!modKey) {
      return;
    }
    if (key === "b") {
      event.preventDefault();
      this.insertWrap("**", "**", this.labels.boldPlaceholder);
    } else if (key === "i") {
      event.preventDefault();
      this.insertWrap("*", "*", this.labels.italicPlaceholder);
    }
  }

  handleToolbarClick(event) {
    const { action } = event.currentTarget.dataset;
    if (action === "undo") {
      this.handleUndo();
    } else if (action === "redo") {
      this.handleRedo();
    } else if (action === "cancel") {
      this.handleCancel();
    } else if (action === "bold") {
      this.insertWrap("**", "**", this.labels.boldPlaceholder);
    } else if (action === "italic") {
      this.insertWrap("*", "*", this.labels.italicPlaceholder);
    } else if (action === "heading") {
      this.insertLinePrefix("## ", this.labels.headingPlaceholder);
    } else if (action === "code") {
      this.insertBlock("```\n", "\n```", this.labels.textPlaceholder);
    } else if (action === "ul") {
      this.insertLinePrefix("- ", this.labels.listPlaceholder);
    } else if (action === "ol") {
      this.insertLinePrefix("1. ", this.labels.listPlaceholder);
    } else if (action === "link") {
      this.insertWrap("[", "](https://)", this.labels.linkPlaceholder);
    } else if (action === "table") {
      this.insertBlock(
        this.labels.tableTemplate,
        " |  |  |",
        this.labels.tableCellPlaceholder
      );
    } else if (action === "strikethrough") {
      this.insertWrap("~~", "~~", this.labels.textPlaceholder);
    } else if (action === "blockquote") {
      this.insertLinePrefix("> ", this.labels.blockquotePlaceholder);
    } else if (action === "image") {
      this.insertWrap(
        "![",
        "](https://)",
        this.labels.imageDescriptionPlaceholder
      );
    } else if (action === "hr") {
      const ta = this.template.querySelector('[data-id="textarea"]');
      if (ta) {
        const scrollState = this.captureScrollState(ta);
        const pos = ta.selectionStart;
        this.spliceValue(ta, pos, pos, "\n\n---\n\n", pos + 7, pos + 7);
        this.restoreFocus(ta, pos + 7, pos + 7, scrollState);
      }
    }
  }

  handleSave() {
    if (this.isSaving || !this.recordId || !this.normalizedFieldApiName) {
      return;
    }
    this.isSaving = true;
    saveMarkdownWithImages({
      recordId: this.recordId,
      objectApiName: this.objectApiName,
      fieldApiName: this.normalizedFieldApiName,
      markdownContent: fixMarkdownTables(this.internalValue)
    })
      .then((saved) => {
        this.internalValue = saved;
        this.isDirty = false;
        this.isSaving = false;
        this.editStartValue = saved;
        this.recordHistory(saved, 0, 0);
        getRecordNotifyChange([{ recordId: this.recordId }]);
        this.dispatchEvent(
          new ShowToastEvent({
            title: this.labels.saveSuccessTitle,
            message: this.labels.saveSuccessMessage,
            variant: "success"
          })
        );
      })
      .catch((err) => {
        this.isSaving = false;
        this.dispatchEvent(
          new ShowToastEvent({
            title: this.labels.saveErrorTitle,
            message: err.body ? err.body.message : this.labels.saveErrorMessage,
            variant: "error"
          })
        );
      });
  }

  insertWrap(prefix, suffix, placeholder) {
    const ta = this.template.querySelector('[data-id="textarea"]');
    if (!ta) {
      return;
    }
    const scrollState = this.captureScrollState(ta);
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = this.internalValue.slice(start, end) || placeholder;
    const insert = `${prefix}${text}${suffix}`;
    this.spliceValue(ta, start, end, insert);
    this.restoreFocus(
      ta,
      start + insert.length,
      start + insert.length,
      scrollState
    );
  }

  insertLinePrefix(prefix, placeholder) {
    const ta = this.template.querySelector('[data-id="textarea"]');
    if (!ta) {
      return;
    }
    const scrollState = this.captureScrollState(ta);
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = this.internalValue.slice(start, end) || placeholder;
    const insert = `\n${prefix}${text}\n`;
    this.spliceValue(ta, start, end, insert);
    this.restoreFocus(
      ta,
      start + insert.length,
      start + insert.length,
      scrollState
    );
  }

  insertBlock(open, close, placeholder) {
    const ta = this.template.querySelector('[data-id="textarea"]');
    if (!ta) {
      return;
    }
    const scrollState = this.captureScrollState(ta);
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = this.internalValue.slice(start, end) || placeholder;
    const insert = `\n${open}${text}${close}\n`;
    this.spliceValue(ta, start, end, insert);
    this.restoreFocus(
      ta,
      start + insert.length,
      start + insert.length,
      scrollState
    );
  }

  spliceValue(ta, start, end, insert, selStart = null, selEnd = null) {
    const scrollState = this.captureScrollState(ta);
    const before = this.internalValue.slice(0, start);
    const after = this.internalValue.slice(end);
    this.internalValue = before + insert + after;
    ta.value = this.internalValue;
    this.applyScrollState(ta, scrollState);
    this.isDirty = true;
    this.recordHistory(
      this.internalValue,
      selStart !== null ? selStart : start + insert.length,
      selEnd !== null ? selEnd : start + insert.length
    );
  }

  restoreFocus(ta, selStart, selEnd, scrollState) {
    Promise.resolve().then(() => {
      ta.focus();
      ta.setSelectionRange(selStart, selEnd);
      this.applyScrollState(ta, scrollState);
    });
  }

  handleUndo() {
    const ta = this.template.querySelector('[data-id="textarea"]');
    if (!this.canUndo) {
      return;
    }
    const scrollState = ta ? this.captureScrollState(ta) : null;
    this.historyIndex -= 1;
    const state = this.history[this.historyIndex];
    this.internalValue = state.value;
    this.isDirty = true;
    if (ta) {
      ta.value = state.value;
      this.restoreFocus(
        ta,
        state.selectionStart,
        state.selectionEnd,
        scrollState
      );
    }
  }

  handleRedo() {
    const ta = this.template.querySelector('[data-id="textarea"]');
    if (!this.canRedo) {
      return;
    }
    const scrollState = ta ? this.captureScrollState(ta) : null;
    this.historyIndex += 1;
    const state = this.history[this.historyIndex];
    this.internalValue = state.value;
    this.isDirty = true;
    if (ta) {
      ta.value = state.value;
      this.restoreFocus(
        ta,
        state.selectionStart,
        state.selectionEnd,
        scrollState
      );
    }
  }

  handleCancel() {
    if (this.editStartValue === null) {
      return;
    }
    this.internalValue = this.editStartValue;
    this.isDirty = false;
    this.activeTab = DEFAULT_MODE_PREVIEW;
    this.recordHistory(this.internalValue, 0, 0);
  }

  recordHistory(value, selectionStart, selectionEnd) {
    const current = this.history[this.historyIndex];
    if (
      current &&
      current.value === value &&
      current.selectionStart === selectionStart &&
      current.selectionEnd === selectionEnd
    ) {
      return;
    }
    this.history.splice(this.historyIndex + 1);
    this.history.push({ value, selectionStart, selectionEnd });
    if (this.history.length > 50) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  }

  captureScrollState(ta) {
    return {
      top: ta.scrollTop,
      left: ta.scrollLeft
    };
  }

  applyScrollState(ta, scrollState) {
    if (!scrollState) {
      return;
    }
    ta.scrollTop = scrollState.top;
    ta.scrollLeft = scrollState.left;
  }
}
