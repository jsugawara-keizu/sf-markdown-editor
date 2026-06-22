import { LightningElement, api, track } from "lwc";
import MarpPrevSlide from "@salesforce/label/c.MarpPrevSlide";
import MarpNextSlide from "@salesforce/label/c.MarpNextSlide";
import MarpToggleSlideView from "@salesforce/label/c.MarpToggleSlideView";
import MarpToggleDocView from "@salesforce/label/c.MarpToggleDocView";
import MarpEnterFullscreen from "@salesforce/label/c.MarpEnterFullscreen";
import MarpExitFullscreen from "@salesforce/label/c.MarpExitFullscreen";

const MARP_FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const MARP_DIRECTIVE_RE = /^\s*marp\s*:\s*true\s*$/m;

export default class MarpViewer extends LightningElement {
  label = {
    MarpPrevSlide,
    MarpNextSlide,
    MarpToggleSlideView,
    MarpToggleDocView
  };
  @api
  get value() {
    return this._value;
  }
  set value(v) {
    this._value = typeof v === "string" ? v : "";
    this._hasMarp = this._detectMarp(this._value);
    if (this._hasMarp && !this._forceDocMode) {
      this._pendingRender = true;
    }
  }

  _value = "";
  _hasMarp = false;
  _forceDocMode = false;
  _pendingRender = false;
  _frameReady = false;

  @track _isSlideMode = false;
  @track _slideCount = 0;
  @track _currentSlide = 0;
  @track _isFullscreen = false;
  _onKeydown = null;

  // ── getters ──────────────────────────────────────────────────────────────

  get hasMarp() {
    return this._hasMarp;
  }

  get isSlideMode() {
    return this._isSlideMode;
  }

  get toggleLabel() {
    return this._forceDocMode ? MarpToggleSlideView : MarpToggleDocView;
  }

  get toggleIcon() {
    return this._forceDocMode ? "utility:display_text" : "utility:rows";
  }

  get slideCounter() {
    return `${this._currentSlide + 1} / ${this._slideCount}`;
  }

  get isPrevDisabled() {
    return this._currentSlide === 0;
  }

  get isNextDisabled() {
    return this._currentSlide >= this._slideCount - 1;
  }

  get rootClass() {
    return this._isFullscreen ? "marp-root marp-root--fullscreen" : "marp-root";
  }

  get isFullscreen() {
    return this._isFullscreen;
  }

  get fullscreenIcon() {
    return this._isFullscreen ? "utility:contract" : "utility:expand";
  }

  get fullscreenLabel() {
    return this._isFullscreen ? MarpExitFullscreen : MarpEnterFullscreen;
  }

  get _vfUrl() {
    return "/apex/MarpRenderer";
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  connectedCallback() {
    this._onMessage = this._handleMessage.bind(this);
    // window in LWS is a sandboxed proxy; add listener on both window and
    // the real top-level window (accessed via window.parent when same-origin)
    // so that postMessage from the VF iframe is reliably received.
    window.addEventListener("message", this._onMessage);
    this._onKeydown = (e) => {
      if (e.key === "Escape" && this._isFullscreen) this._exitFullscreen();
    };
    document.addEventListener("keydown", this._onKeydown);
  }

  disconnectedCallback() {
    window.removeEventListener("message", this._onMessage);
    document.removeEventListener("keydown", this._onKeydown);
    this._detachFrameLoad();
  }

  renderedCallback() {
    if (this._pendingRender && this._hasMarp && !this._forceDocMode) {
      this._pendingRender = false;
      this._isSlideMode = true;
      this._mountFrame();
    }
  }

  // ── frame setup ───────────────────────────────────────────────────────────

  _mountFrame() {
    const iframe = this.template.querySelector('[data-id="marp-frame"]');
    if (!iframe) {
      this._pendingRender = true;
      return;
    }
    const alreadyMounted =
      iframe.src &&
      (iframe.src.endsWith(this._vfUrl) ||
        iframe.src.endsWith(this._vfUrl + "?r=1"));
    if (alreadyMounted) {
      if (this._frameReady) {
        this._postMessage({ type: "RENDER", markdown: this._value });
      }
      return;
    }
    this._frameReady = false;
    // Pass markdown via window.name so the VF page can render on load
    // without relying on postMessage (LWS may proxy contentWindow).
    iframe.name = JSON.stringify({ markdown: this._value });
    this._attachFrameLoad(iframe);
    iframe.src = this._vfUrl;
  }

  _attachFrameLoad(iframe) {
    this._detachFrameLoad();
    this._onFrameLoad = () => {
      this._frameReady = true;
      // Also try postMessage as a secondary channel for re-renders.
      this._postMessage({ type: "RENDER", markdown: this._value });
    };
    this._frameEl = iframe;
    iframe.addEventListener("load", this._onFrameLoad);
  }

  _detachFrameLoad() {
    if (this._frameEl && this._onFrameLoad) {
      this._frameEl.removeEventListener("load", this._onFrameLoad);
    }
    this._frameEl = null;
    this._onFrameLoad = null;
  }

  // ── postMessage ───────────────────────────────────────────────────────────

  _postMessage(data) {
    const iframe = this.template.querySelector('[data-id="marp-frame"]');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(data, "*");
    }
  }

  _handleMessage(event) {
    const data = event.data;
    if (!data || !data.type) return;

    if (data.type === "PAGE_READY" || data.type === "PONG") {
      this._frameReady = true;
      this._postMessage({ type: "RENDER", markdown: this._value });
    } else if (data.type === "READY") {
      this._slideCount = data.slideCount || 0;
      this._currentSlide = 0;
    } else if (data.type === "SLIDE_CHANGED") {
      this._currentSlide = data.slide || 0;
      this._slideCount = data.slideCount || this._slideCount;
    } else if (data.type === "ERROR") {
      console.error("[marpViewer] render error:", data.message);
    }
  }

  // ── handlers ──────────────────────────────────────────────────────────────

  handleFullscreen() {
    if (this._isFullscreen) {
      this._exitFullscreen();
    } else {
      this._isFullscreen = true;
    }
  }

  _exitFullscreen() {
    this._isFullscreen = false;
  }

  handleToggle() {
    this._forceDocMode = !this._forceDocMode;
    this._isSlideMode = !this._forceDocMode && this._hasMarp;
    if (this._isSlideMode) {
      this._pendingRender = true;
    } else {
      this._isFullscreen = false;
    }
  }

  handlePrev() {
    this._postMessage({ type: "PREV" });
  }

  handleNext() {
    this._postMessage({ type: "NEXT" });
  }

  handleKeydown(event) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      this.handleNext();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      this.handlePrev();
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  _detectMarp(markdown) {
    // Strip leading HTML comments (e.g. doctoc TOC) before frontmatter check.
    const stripped = markdown.replace(/^(<!--[\s\S]*?-->\s*)+/, "");
    const match = MARP_FRONTMATTER_RE.exec(stripped);
    if (!match) return false;
    return MARP_DIRECTIVE_RE.test(match[1]);
  }
}
