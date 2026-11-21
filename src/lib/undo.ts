import { useSyncExternalStore } from 'react';

export interface UndoState {
  label: string;
  trashId: string;
  key: number;
}

let current: UndoState | null = null;
let timer: number | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Show "Deleted X · Undo" for a few seconds. */
export function showUndo(label: string, trashId: string | null) {
  if (!trashId) return;
  current = { label, trashId, key: Date.now() };
  window.clearTimeout(timer);
  timer = window.setTimeout(clearUndo, 9000);
  emit();
}

export function clearUndo() {
  current = null;
  emit();
}

export function useUndo() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
  );
}
