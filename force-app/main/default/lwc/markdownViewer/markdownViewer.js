import { loadScript } from "lightning/platformResourceLoader";
import { getRecord, getRecordNotifyChange } from "lightning/uiRecordApi";
import { LightningElement, api, track, wire } from "lwc";
import { getObjectInfo } from "lightning/uiObjectInfoApi";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import toggleCheckboxLine from "@salesforce/apex/MarkdownImageHandler.toggleCheckboxLine";
import MARKDOWN_CORE from "@salesforce/resourceUrl/markdownCore";
import MERMAID_JS from "@salesforce/resourceUrl/mermaidJs";
import MARKDOWN_PREVIEW_ARIA_LABEL from "@salesforce/label/c.MarkdownPreviewAriaLabel";
import MARKDOWN_LOADING_ALT_TEXT from "@salesforce/label/c.MarkdownLoadingAltText";
import MARKDOWN_VIEWER_ERROR_TEXT from "@salesforce/label/c.MarkdownViewerErrorText";
import MARKDOWN_SAVE_ERROR_TITLE from "@salesforce/label/c.MarkdownSaveErrorTitle";
import MARKDOWN_SAVE_ERROR_MESSAGE from "@salesforce/label/c.MarkdownSaveErrorMessage";

const LABELS = {
  previewAria: MARKDOWN_PREVIEW_ARIA_LABEL,
  loadingAltText: MARKDOWN_LOADING_ALT_TEXT,
  viewerErrorText: MARKDOWN_VIEWER_ERROR_TEXT,
  saveErrorTitle: MARKDOWN_SAVE_ERROR_TITLE,
  saveErrorMessage: MARKDOWN_SAVE_ERROR_MESSAGE
};

function clearChildren(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function appendHtml(container, html) {
  const range = document.createRange();
  range.selectNode(container);
  container.appendChild(range.createContextualFragment(html));
}

const MD_CONTENT_STYLES = `
.md-content h1{font-size:1.75em;font-weight:700;margin:.75rem 0 .5rem;padding-bottom:.25rem;border-bottom:1px solid #dddbda}
.md-content h2{font-size:1.375em;font-weight:700;margin:.75rem 0 .375rem}
.md-content h3{font-size:1.125em;font-weight:700;margin:.625rem 0 .25rem}
.md-content h4,.md-content h5,.md-content h6{font-size:1em;font-weight:700;margin:.5rem 0 .25rem}
.md-content p{margin:0 0 .75rem;line-height:1.6}
.md-content ul{margin:0 0 .75rem;padding-left:2rem;list-style:disc}
.md-content ol{margin:0 0 .75rem;padding-left:2rem;list-style:decimal}
.md-content li{margin-bottom:.25rem;line-height:1.5}
.md-content ul ul,.md-content ol ol,.md-content ul ol,.md-content ol ul{margin-bottom:0}
.md-content code{background:#f4f6f9;padding:.1em .3em;border-radius:3px;font-family:monospace;font-size:.875em}
.md-content pre{background:#f4f6f9;padding:1rem;border-radius:4px;overflow-x:auto;margin:0 0 .75rem}
.md-content pre code{background:none;padding:0;font-size:.875em}
.md-content blockquote{border-left:4px solid #dddbda;margin:0 0 .75rem;padding:.25rem 0 .25rem 1rem;color:#706e6b}
.md-content table{border-collapse:collapse;width:100%;margin:0 0 .75rem}
.md-content th,.md-content td{border:1px solid #dddbda;padding:.4rem .75rem;text-align:left;vertical-align:top}
.md-content th{background:#f4f6f9;font-weight:700}
.md-content tr:nth-child(even){background:#fafafa}
.md-content a{color:#0176d3;text-decoration:none}
.md-content a:hover{text-decoration:underline}
.md-content hr{border:none;border-top:1px solid #dddbda;margin:1rem 0}
.md-content img{max-width:100%;height:auto}
.md-content strong{font-weight:700}
.md-content em{font-style:italic}
.md-content del{text-decoration:line-through}
.md-content .footnotes{border-top:1px solid #dddbda;margin-top:1.5rem;padding-top:.75rem;font-size:.875em;color:#706e6b}
.md-content sup a{color:#0176d3;text-decoration:none}
.md-content .contains-task-list{list-style:none;padding-left:.5rem}
.md-content .task-list-item{display:flex;align-items:flex-start;gap:.4rem;margin-bottom:.25rem}
.md-content .task-list-item input[type="checkbox"]{margin-top:.2rem;flex-shrink:0}
.md-content .task-list-item input[type="checkbox"]:not(:disabled){cursor:pointer}
.md-content .mermaid-wrapper{background:#f4f6f9;border-radius:4px;padding:1rem;margin:0 0 .75rem;text-align:center;overflow-x:auto}
.md-content .mermaid-wrapper svg{display:block;margin:0 auto;max-width:100%;height:auto}
.md-content .mermaid-error{color:#c23934;background:#fef1f1;border:1px solid #f6acaa;border-radius:4px;padding:.5rem .75rem;font-size:.875em}
.hljs{background:#f6f8fa;color:#24292e;border-radius:4px}
.hljs-comment,.hljs-quote{color:#6a737d;font-style:italic}
.hljs-keyword,.hljs-selector-tag,.hljs-subst{color:#d73a49;font-weight:700}
.hljs-number,.hljs-literal,.hljs-variable,.hljs-template-variable,.hljs-tag .hljs-attr{color:#005cc5}
.hljs-string,.hljs-doctag{color:#032f62}
.hljs-title,.hljs-section,.hljs-selector-id{color:#6f42c1;font-weight:700}
.hljs-type,.hljs-class .hljs-title{color:#6f42c1}
.hljs-tag,.hljs-name,.hljs-attribute{color:#22863a}
.hljs-regexp,.hljs-link{color:#032f62}
.hljs-symbol,.hljs-bullet{color:#e36209}
.hljs-built_in,.hljs-builtin-name{color:#005cc5}
.hljs-deletion{background:#ffeef0}
.hljs-addition{background:#e6ffed}
`;

export default class MarkdownViewer extends LightningElement {
  @api recordId;
  @api objectApiName;
  @api fieldApiName;

  // Preview checkboxes are clickable by default (that's the point of this
  // property). Hosts that know better than the wired field-level permission
  // check below — e.g. markdownEditor, which already gates its own Save
  // button on field updateability — pass this explicitly.
  @api readOnly = false;

  _markdownText = "";
  @track fieldIsReadable = true;
  @track fieldIsUpdateable = false;
  get normalizedFieldApiName() {
    return typeof this.fieldApiName === "string"
      ? this.fieldApiName.trim()
      : this.fieldApiName;
  }

  get normalizedFieldKey() {
    if (!this.normalizedFieldApiName) {
      return this.normalizedFieldApiName;
    }
    const parts = this.normalizedFieldApiName.split(".");
    return parts[parts.length - 1];
  }

  @api
  get markdownText() {
    return this._markdownText;
  }
  set markdownText(value) {
    this._markdownText = typeof value === "string" ? value : "";
    if (this._markdownText) {
      this.markdownValue = this._markdownText;
      this.scheduleRender();
    } else if (this._directValue) {
      this.markdownValue = this._directValue;
      this.scheduleRender();
    }
  }

  @api
  get value() {
    return this._directValue;
  }
  set value(v) {
    this._directValue = typeof v === "string" ? v : "";
    if (!this._markdownText) {
      this.markdownValue = this._directValue;
      this.scheduleRender();
    }
  }

  @track state = "loading";
  libraryLoaded = false;
  markdownValue = "";
  _directValue = "";
  _lastRenderedMarkdown = null;
  _renderVersion = 0;
  _checkboxLineOffset = 0;
  _debounceTimer = null;
  labels = LABELS;

  get qualifiedFields() {
    if (!this.normalizedFieldApiName) {
      return [];
    }
    if (this.objectApiName && !this.normalizedFieldApiName.includes(".")) {
      return [`${this.objectApiName}.${this.normalizedFieldApiName}`];
    }
    return [this.normalizedFieldApiName];
  }

  get isFlowMode() {
    return !!this._markdownText;
  }

  // Standalone record-page usage is the only mode where this component has
  // its own FLS signal (fieldIsUpdateable, from wiredObjectInfo). In the
  // direct-value modes (markdownEditor's `value` prop, Flow's `markdownText`
  // prop) that wire is short-circuited to fieldIsUpdateable=false regardless
  // of real access, so defer entirely to the host via `readOnly`.
  get checkboxesReadOnly() {
    if (this.readOnly) {
      return true;
    }
    if (this.isFlowMode || this._directValue !== "") {
      return false;
    }
    return !this.fieldIsUpdateable;
  }

  @wire(getRecord, { recordId: "$recordId", fields: "$qualifiedFields" })
  wiredRecord({ data, error }) {
    if (this.isFlowMode || this._directValue !== "" || error || !data) {
      return;
    }
    const fieldData = data.fields[this.normalizedFieldKey];
    this.markdownValue = fieldData ? fieldData.value || "" : "";
    this.scheduleRender();
  }

  @wire(getObjectInfo, { objectApiName: "$objectApiName" })
  wiredObjectInfo({ data, error }) {
    if (this.isFlowMode || this._directValue !== "") {
      this.fieldIsReadable = true;
      this.fieldIsUpdateable = false;
      return;
    }

    if (data && this.normalizedFieldApiName) {
      const fieldInfo = data.fields[this.normalizedFieldKey];
      if (fieldInfo) {
        this.fieldIsReadable = fieldInfo.isAccessible || false;
        this.fieldIsUpdateable = fieldInfo.updateable || false;
      } else {
        this.fieldIsReadable = false;
        this.fieldIsUpdateable = false;
      }
    } else if (error) {
      this.fieldIsReadable = false;
      this.fieldIsUpdateable = false;
    }
  }

  get isLoading() {
    return this.state === "loading";
  }

  get fieldHasAccess() {
    return (
      this.isFlowMode ||
      this._directValue ||
      this.fieldIsReadable ||
      this.fieldIsUpdateable
    );
  }
  get isReady() {
    return this.state === "ready";
  }
  get hasError() {
    return this.state === "error";
  }

  connectedCallback() {
    this._connected = true;
    const markdownCoreUrl = `${MARKDOWN_CORE}/markdown-core.iife.js`;

    const resolveMermaidRuntime = () => {
      const globals = [];
      if (typeof globalThis !== "undefined" && globalThis) {
        globals.push(globalThis);
      }
      if (typeof window !== "undefined" && window) {
        globals.push(window);
      }

      for (const g of globals) {
        if (g.mermaid) {
          return g.mermaid;
        }
      }
      return null;
    };

    const mermaidUrls = [MERMAID_JS].filter(
      (url) => typeof url === "string" && url
    );

    loadScript(this, markdownCoreUrl)
      .then(() => {
        if (typeof window === "undefined" || !window.MarkdownCore) {
          throw new Error("MarkdownCore global not found after script load");
        }

        // Mermaid diagrams are compiled inside a hidden Visualforce iframe
        // instead of directly under Lightning Web Security: mermaid.render()'s
        // synchronous DOM/layout work is dramatically slower under LWS's Proxy
        // membrane, which is what previously read as the preview freezing for
        // diagram-heavy docs (marpViewer.js already does this for Marp decks;
        // this generalizes it to plain Markdown). window.MarkdownCore is a
        // page-wide static-resource global, so this registration only needs
        // to happen once regardless of how many markdownViewer/markdownEditor
        // instances are on the page.
        if (
          !window.__mermaidFrameCompilerReady &&
          typeof window.MarkdownCore.createMermaidFrameCompiler === "function" &&
          typeof window.MarkdownCore.setExternalMermaidCompiler === "function"
        ) {
          window.__mermaidFrameCompilerReady = true;
          const frameCompiler = window.MarkdownCore.createMermaidFrameCompiler({
            vfPageUrl: "/apex/MermaidRenderer"
          });
          window.MarkdownCore.setExternalMermaidCompiler(frameCompiler);
        }

        return mermaidUrls
          .reduce(async (prev, url) => {
            const loaded = await prev;
            if (loaded) {
              return true;
            }

            try {
              await loadScript(this, url);

              if (
                typeof window !== "undefined" &&
                !window.mermaid &&
                window.MermaidBundle
              ) {
                window.mermaid =
                  window.MermaidBundle.default || window.MermaidBundle;
              }

              const mermaid = resolveMermaidRuntime();
              if (mermaid) {
                return true;
              }

              // Script loaded but global not found - check window directly
              if (typeof window !== "undefined") {
                if (typeof window.mermaid !== "undefined") {
                  const retryMermaid = resolveMermaidRuntime();
                  if (retryMermaid) {
                    return true;
                  }
                }
              }
            } catch {
              // Script load error (HTTP 200+ but execution failed, or network error)
              if (
                typeof window !== "undefined" &&
                !window.mermaid &&
                window.MermaidBundle
              ) {
                window.mermaid =
                  window.MermaidBundle.default || window.MermaidBundle;
              }

              // Despite error, check if mermaid was injected
              const mermaid = resolveMermaidRuntime();
              if (mermaid) {
                return true;
              }
            }
            return false;
          }, Promise.resolve(false))
          .then((loaded) => {
            if (!loaded) {
              // Mermaid is optional at runtime. markdown-core falls back to local
              // .mermaid-error blocks when runtime is missing.
            }
          });
      })
      .then(() => {
        if (!this._connected) {
          return;
        }
        this.libraryLoaded = true;
        this.state = "ready";
        this.scheduleRender();
      })
      .catch((err) => {
        if (!this._connected) {
          return;
        }
        console.error(
          "[markdownViewer] markdown-core script load failed:",
          err
        );
        console.error("[markdownViewer] MARKDOWN_CORE path:", MARKDOWN_CORE);
        this.state = "error";
      });
  }

  disconnectedCallback() {
    // This component can be mounted only transiently (e.g. c-marp-viewer
    // renders it for a single frame before switching to its VF iframe). The
    // script-load chain and any in-flight mermaid render are plain promises
    // with no cancellation, so without this flag they'd keep running full
    // mermaid.render() work under Lightning Web Security after unmount.
    this._connected = false;
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  renderedCallback() {
    if (this.libraryLoaded && this.state === "ready") {
      if (this._lastRenderedMarkdown !== this.markdownValue) {
        this.scheduleRender();
      }
    }
  }

  scheduleRender() {
    if (!this.libraryLoaded || this.state !== "ready") {
      return;
    }
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    /* eslint-disable-next-line @lwc/lwc/no-async-operation */
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this.triggerRender();
    }, 80);
  }

  triggerRender() {
    this._lastRenderedMarkdown = this.markdownValue;
    this._renderVersion += 1;
    this.doRenderAsync(this._renderVersion, this.markdownValue).catch(() => {});
  }

  async doRenderAsync(version, markdown) {
    const container = this.template.querySelector('[data-id="content"]');
    if (!container) {
      return;
    }

    if (!markdown) {
      if (this._renderVersion === version) {
        clearChildren(container);
      }
      return;
    }

    try {
      const frontmatterMatch = /^---\n[\s\S]*?\n---\n?/.exec(markdown);
      const strippedMarkdown = frontmatterMatch
        ? markdown.slice(frontmatterMatch[0].length)
        : markdown;
      // data-md-line (see checkbox-transform.ts) is computed from the AST
      // of strippedMarkdown, not the original markdown, since the
      // frontmatter block is only hidden here for display and never
      // touches the rendering pipeline itself. Writing a checkbox toggle
      // back to the *original* text (still frontmatter-and-all — that's
      // what's actually stored) needs the line number restored to what it
      // would be in that original text, or every line is off by the
      // frontmatter's line count and toggles silently hit the wrong line.
      this._checkboxLineOffset = frontmatterMatch
        ? frontmatterMatch[0].split("\n").length - 1
        : 0;
      const safeHtml =
        await window.MarkdownCore.renderAndSanitizeAsync(strippedMarkdown);
      if (this._renderVersion !== version) {
        return;
      }

      clearChildren(container);
      const styleEl = document.createElement("style");
      styleEl.textContent = MD_CONTENT_STYLES;
      container.appendChild(styleEl);

      appendHtml(container, safeHtml);
      this.bindAnchorLinks(container);
      this.bindCheckboxToggle(container);
    } catch (err) {
      console.error("[markdownViewer] render failed:", err);
      this.dispatchEvent(
        new ShowToastEvent({
          title: this.labels.saveErrorTitle,
          message: this.labels.viewerErrorText,
          variant: "error"
        })
      );
    }
  }

  bindCheckboxToggle(container) {
    // The container div persists across renders (only its children are
    // replaced via appendHtml/clearChildren), so a single delegated listener
    // bound once covers every future render.
    if (this._checkboxToggleBound) {
      return;
    }
    this._checkboxToggleBound = true;
    container.addEventListener("click", (e) => {
      const checkbox = e.target.closest(
        'input[type="checkbox"][data-md-line]'
      );
      if (!checkbox || !container.contains(checkbox)) {
        return;
      }
      if (this.checkboxesReadOnly) {
        e.preventDefault();
        return;
      }
      const renderedLine = Number(checkbox.dataset.mdLine);
      if (!Number.isFinite(renderedLine)) {
        return;
      }
      // data-md-line is relative to the frontmatter-stripped text that was
      // actually rendered; every consumer of this event (this component's
      // own standalone toggleCheckboxLine call below, and
      // markdownEditor.js's handleCheckboxToggle) operates on the raw
      // stored field value, which still has the frontmatter — so the line
      // number has to be translated back before it leaves this handler.
      const line = renderedLine + this._checkboxLineOffset;
      const checked = checkbox.checked;
      this.dispatchEvent(
        new CustomEvent("mdcheckboxtoggle", {
          detail: { line, checked },
          bubbles: true,
          composed: true
        })
      );
      // Standalone usage (record page) has no host listening for the event
      // above to persist the change, so this component owns its own
      // immediate-save round trip in that mode only. Embedded usage
      // (markdownEditor's `value` prop, Flow's `markdownText` prop) leaves
      // persistence to whichever host is listening for the event instead.
      if (!this.isFlowMode && this._directValue === "") {
        this.persistCheckboxToggle(line, checked, checkbox);
      }
    });
  }

  persistCheckboxToggle(line, checked, checkboxEl) {
    toggleCheckboxLine({
      recordId: this.recordId,
      objectApiName: this.objectApiName,
      fieldApiName: this.normalizedFieldApiName,
      line,
      checked
    })
      .then((updated) => {
        this.markdownValue = updated;
        this.scheduleRender();
        getRecordNotifyChange([{ recordId: this.recordId }]);
      })
      .catch((err) => {
        // Revert the optimistic native toggle so the UI doesn't drift from
        // the still-unpersisted server value.
        checkboxEl.checked = !checked;
        console.error("[markdownViewer] checkbox toggle failed:", err);
        this.dispatchEvent(
          new ShowToastEvent({
            title: this.labels.saveErrorTitle,
            message: err.body ? err.body.message : this.labels.saveErrorMessage,
            variant: "error"
          })
        );
      });
  }

  bindAnchorLinks(container) {
    const anchors = container.querySelectorAll('a[href^="#"]');
    anchors.forEach((anchor) => {
      const raw = anchor.getAttribute("href") || "";
      const targetId = decodeURIComponent(
        raw.startsWith("#") ? raw.slice(1) : raw
      );
      anchor.style.cursor = "pointer";
      anchor.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const target = container.querySelector(
          `[id="${CSS.escape(targetId)}"]`
        );
        if (!target) {
          return;
        }

        const scrollable = this.findScrollParent(this.template.host);
        if (!scrollable) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }

        const targetRect = target.getBoundingClientRect();
        const containerRect = scrollable.getBoundingClientRect
          ? scrollable.getBoundingClientRect()
          : { top: 0 };

        scrollable.scrollTo({
          top: scrollable.scrollTop + targetRect.top - containerRect.top - 16,
          behavior: "smooth"
        });
      });
    });
  }

  findScrollParent(startEl) {
    let node = startEl;
    while (node) {
      const style = window.getComputedStyle(node);
      const overflow = (style.overflow || "") + (style.overflowY || "");
      if (
        /auto|scroll/.test(overflow) &&
        node.scrollHeight > node.clientHeight
      ) {
        return node;
      }
      if (node.parentElement) {
        node = node.parentElement;
      } else {
        const root = node.getRootNode ? node.getRootNode() : null;
        node = root && root.host ? root.host : null;
      }
    }
    return null;
  }
}
