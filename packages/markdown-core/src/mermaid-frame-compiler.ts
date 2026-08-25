import { mermaidDebugLog } from './debug';

function debugLog(event: string, payload: Record<string, unknown>): void {
  mermaidDebugLog('mermaid-frame-compiler', event, payload);
}

export interface MermaidFrameCompilerOptions {
  /** URL of the page hosting the mermaid render frame (e.g. "/apex/MermaidRenderer"). */
  vfPageUrl: string;
  /** Max time to wait for the frame to finish loading before giving up, ms. */
  frameReadyTimeoutMs?: number;
  /** Max time to wait for a single render response before giving up, ms. */
  renderTimeoutMs?: number;
}

interface PendingEntry {
  resolve: (svg: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// mermaid.render() does synchronous, expensive DOM/layout work that is far
// slower under Lightning Web Security's Proxy membrane than in a plain page
// (see marpViewer.js, which already routes Marp decks through a Visualforce
// iframe for the same reason). This factory builds a compile function that
// delegates rendering to a hidden same-page iframe outside LWS instead, so
// diagram-heavy (but non-Marp) Markdown no longer blocks the main thread long
// enough to read as a frozen preview.
export function createMermaidFrameCompiler(
  options: MermaidFrameCompilerOptions
): (definition: string, id: string) => Promise<string> {
  const vfPageUrl = options.vfPageUrl;
  const frameReadyTimeoutMs = options.frameReadyTimeoutMs ?? 8000;
  const renderTimeoutMs = options.renderTimeoutMs ?? 15000;

  let iframeEl: HTMLIFrameElement | null = null;
  let frameReadyPromise: Promise<boolean> | null = null;
  const pending = new Map<string, PendingEntry>();
  let listenerAttached = false;

  function handleMessage(event: MessageEvent): void {
    // Only accept messages from the render frame this compiler created —
    // targetOrigin stays "*" on the reply below because the Visualforce
    // domain isn't known ahead of time (varies per org/sandbox/My Domain),
    // but checking the sender's window identity is origin-agnostic and rules
    // out any other frame/window on the page forging a MERMAID_RESULT to
    // inject arbitrary SVG.
    if (event.source !== iframeEl?.contentWindow) return;
    const data = event.data as
      | { type?: string; id?: string; svg?: string; message?: string }
      | null
      | undefined;
    if (!data || !data.type || !data.id) return;
    const entry = pending.get(data.id);
    if (!entry) return;

    if (data.type === 'MERMAID_RESULT') {
      pending.delete(data.id);
      clearTimeout(entry.timer);
      debugLog('render:success', { id: data.id, svgLength: (data.svg || '').length });
      entry.resolve(data.svg || '');
    } else if (data.type === 'MERMAID_ERROR') {
      pending.delete(data.id);
      clearTimeout(entry.timer);
      debugLog('render:error', { id: data.id, message: data.message });
      entry.reject(new Error(data.message || 'mermaid render error'));
    }
  }

  function ensureFrame(): Promise<boolean> {
    if (frameReadyPromise) return frameReadyPromise;

    frameReadyPromise = new Promise<boolean>((resolve) => {
      if (typeof document === 'undefined' || typeof window === 'undefined') {
        debugLog('frame:no-dom', {});
        resolve(false);
        return;
      }

      if (!listenerAttached) {
        window.addEventListener('message', handleMessage);
        listenerAttached = true;
      }

      const iframe = document.createElement('iframe');
      // Kept in normal layout flow (not display:none) so the mermaid runtime's
      // SVG text-measurement calls inside the frame behave like a normally
      // rendered page; positioned off-screen so it's never visible to users.
      iframe.style.position = 'fixed';
      iframe.style.left = '-10000px';
      iframe.style.top = '0';
      iframe.style.width = '1600px';
      iframe.style.height = '1200px';
      iframe.style.border = '0';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('tabindex', '-1');
      iframe.title = 'mermaid-render-frame';

      let settled = false;
      const finish = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        debugLog('frame:ready', { ok });
        resolve(ok);
      };

      iframe.addEventListener('load', () => finish(true), { once: true });
      iframe.addEventListener('error', () => finish(false), { once: true });
      // Defense in depth against a frame that never loads (blocked, 404,
      // network issue) so callers fail fast into the direct-under-LWS
      // fallback instead of hanging indefinitely.
      setTimeout(() => finish(false), frameReadyTimeoutMs);

      try {
        iframe.src = vfPageUrl;
      } catch {
        finish(false);
        return;
      }

      document.body.appendChild(iframe);
      iframeEl = iframe;
    });

    return frameReadyPromise;
  }

  return async function compile(definition: string, id: string): Promise<string> {
    const ready = await ensureFrame();
    if (!ready || !iframeEl || !iframeEl.contentWindow) {
      throw new Error('mermaid render frame unavailable');
    }

    debugLog('render:start', { id, definitionLength: definition.length });

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('mermaid render frame timed out'));
      }, renderTimeoutMs);

      pending.set(id, { resolve, reject, timer });
      iframeEl!.contentWindow!.postMessage({ type: 'RENDER_MERMAID', id, definition }, '*');
    });
  };
}
