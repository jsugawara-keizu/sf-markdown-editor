import { LightningElement, api, track } from "lwc";
import FORM_FACTOR from "@salesforce/client/formFactor";
import MarpPrevSlide from "@salesforce/label/c.MarpPrevSlide";
import MarpNextSlide from "@salesforce/label/c.MarpNextSlide";
import MarpToggleSlideView from "@salesforce/label/c.MarpToggleSlideView";
import MarpToggleDocView from "@salesforce/label/c.MarpToggleDocView";
import MarpMobileUnsupportedNotice from "@salesforce/label/c.MarpMobileUnsupportedNotice";

const MARP_FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const MARP_DIRECTIVE_RE = /^\s*marp\s*:\s*true\s*$/m;

// Marp slide view relies on a Visualforce iframe, which is unreliable inside
// the Salesforce Mobile App's embedded browser. Fall back to document view.
const IS_MOBILE = FORM_FACTOR !== "Large";

export default class MarpViewer extends LightningElement {
  label = {
    MarpPrevSlide,
    MarpNextSlide,
    MarpToggleSlideView,
    MarpToggleDocView,
    MarpMobileUnsupportedNotice
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
      // Set eagerly (not just inside renderedCallback) so the template never
      // has a render frame where hasMarp is true but isSlideMode is still
      // false. That frame used to fall through to the <c-markdown-viewer>
      // branch below, which mounts a SECOND, independent Mermaid renderer
      // that runs directly under Lightning Web Security instead of inside
      // the VF iframe — full mermaid.render() work under LWS's Proxy
      // membrane is dramatically slower than in a plain VF page, and this is
      // what read as the preview freezing.
      this._isSlideMode = true;
    }
  }

  _value = "";
  _hasMarp = false;
  _forceDocMode = IS_MOBILE;
  _pendingRender = false;
  _frameReady = false;
  // Both the iframe's own "load" event and the VF page's PAGE_READY message
  // fire for the same initial mount, so without this guard the first render
  // is sent twice — the VF page then runs two concurrent mermaid.render()
  // passes against the same fixed diagram ids, racing each other.
  _initialRenderSent = false;
  // Guards against re-sending RENDER for content the VF page is already
  // rendering. Without this, any extra ready/render-trigger signal (e.g. a
  // duplicate or delayed postMessage under LWS's iframe/message instrumentation)
  // restarts marp.render() + the mermaid pass from scratch before the prior
  // pass ever finishes, which looks exactly like a frozen preview.
  _renderInFlight = false;
  _lastSentMarkdown = null;
  isMobile = IS_MOBILE;

  @api isFullscreen = false;

  @track _isSlideMode = false;
  @track _slideCount = 0;
  @track _currentSlide = 0;

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
    return this.isFullscreen ? "marp-root marp-root--fullscreen" : "marp-root";
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
  }

  disconnectedCallback() {
    window.removeEventListener("message", this._onMessage);
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
        this._sendRender();
      }
      return;
    }
    this._frameReady = false;
    this._initialRenderSent = false;
    this._renderInFlight = false;
    this._lastSentMarkdown = null;
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
      // The VF page's own PAGE_READY message may have already triggered the
      // initial render (see _handleMessage) — don't send it twice.
      if (this._initialRenderSent) {
        return;
      }
      this._initialRenderSent = true;
      // Also try postMessage as a secondary channel for re-renders.
      this._sendRender();
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

  // Sends RENDER unless the VF page is already rendering this exact content.
  // Any ready/render-trigger signal that arrives while a render is still in
  // flight (duplicate postMessage, delayed load event, etc.) is a no-op
  // instead of restarting marp.render()/mermaid from scratch.
  _sendRender() {
    if (this._renderInFlight && this._lastSentMarkdown === this._value) {
      return;
    }
    this._renderInFlight = true;
    this._lastSentMarkdown = this._value;
    this._postMessage({ type: "RENDER", markdown: this._value });
  }

  _handleMessage(event) {
    const data = event.data;
    if (!data || !data.type) return;

    if (data.type === "PAGE_READY" || data.type === "PONG") {
      this._frameReady = true;
      // See _onFrameLoad: guard against sending the initial render twice.
      if (data.type === "PAGE_READY" && this._initialRenderSent) {
        return;
      }
      if (data.type === "PAGE_READY") {
        this._initialRenderSent = true;
      }
      this._sendRender();
    } else if (data.type === "READY") {
      this._slideCount = data.slideCount || 0;
      this._currentSlide = 0;
      this._renderInFlight = false;
    } else if (data.type === "SLIDE_CHANGED") {
      this._currentSlide = data.slide || 0;
      this._slideCount = data.slideCount || this._slideCount;
    } else if (data.type === "ERROR") {
      console.error("[marpViewer] render error:", data.message);
      this._renderInFlight = false;
    }
  }

  // ── handlers ──────────────────────────────────────────────────────────────

  handleToggle() {
    if (this.isMobile) {
      return;
    }
    this._forceDocMode = !this._forceDocMode;
    this._isSlideMode = !this._forceDocMode && this._hasMarp;
    if (this._isSlideMode) {
      this._pendingRender = true;
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
