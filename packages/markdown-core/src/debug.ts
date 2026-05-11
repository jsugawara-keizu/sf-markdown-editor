let mermaidDebugEnabled = false;

export function setMermaidDebugEnabled(enabled: boolean): void {
  mermaidDebugEnabled = enabled === true;
}

export function isMermaidDebugEnabled(): boolean {
  return mermaidDebugEnabled;
}

export function mermaidDebugLog(scope: string, event: string, payload: Record<string, unknown>): void {
  if (!mermaidDebugEnabled) return;
  // eslint-disable-next-line no-console
  console.info(`[markdown-core][${scope}]`, event, payload);
}
