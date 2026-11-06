/**
 * Read the user's current selection. Order:
 * 1. window.getSelection() (normal WYSIWYG text)
 * 2. CodeMirror instances (Typora source mode, code fences, math blocks):
 *    - Typora source mode: globalThis.File.editor.sourceView.cm
 *    - the focused/active `.CodeMirror` element's `.CodeMirror` instance
 *    - any other `.CodeMirror` element with a non-empty selection
 * Every probe is guarded; failures fall through to '' (caller shows '请先选中文字').
 */
type CMLike = { getSelection?: () => unknown; somethingSelected?: () => unknown };

function readCM(cm: unknown): string {
  try {
    const c = cm as CMLike | null | undefined;
    if (!c || typeof c.getSelection !== 'function') return '';
    if (typeof c.somethingSelected === 'function' && !c.somethingSelected()) return '';
    const text = c.getSelection();
    return typeof text === 'string' ? text : '';
  } catch { return ''; }
}

export function getSelectedText(win: any = globalThis, doc: any = (globalThis as any).document): string {
  try {
    const text = win.getSelection?.()?.toString() ?? '';
    if (text.trim()) return text;
  } catch { /* fall through */ }
  const candidates: unknown[] = [];
  try {
    const sv = win.File?.editor?.sourceView;
    if (sv?.cm) candidates.push(sv.cm);
  } catch { /* ignore */ }
  try {
    const active = doc?.activeElement?.closest?.('.CodeMirror');
    if (active) candidates.push(active.CodeMirror);
    const focused = doc?.querySelector?.('.CodeMirror-focused');
    if (focused) candidates.push(focused.CodeMirror);
    const all = doc?.querySelectorAll?.('.CodeMirror') ?? [];
    for (const el of Array.from(all as ArrayLike<any>)) candidates.push(el.CodeMirror);
  } catch { /* ignore */ }
  for (const cm of candidates) {
    const text = readCM(cm);
    if (text.trim()) return text;
  }
  return '';
}
