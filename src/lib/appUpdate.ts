import { useSyncExternalStore } from 'react';

declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: string;

export const APP_VERSION = __APP_VERSION__;
export const BUILD_ID = __BUILD_ID__;
export const BUILD_TIME = __BUILD_TIME__;

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface State {
  updateAvailable: boolean;
  latestBuiltAt?: string;
  lastChecked?: number;
  checking: boolean;
  installPrompt: InstallPromptEvent | null;
  installed: boolean;
}

let state: State = {
  updateAvailable: false,
  checking: false,
  installPrompt: null,
  installed: typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export function useAppStatus() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}

/** Ask the live site which build it is serving. Returns true when a newer build exists. */
export async function checkForUpdate(): Promise<boolean> {
  if (!import.meta.env.PROD) return false;
  set({ checking: true });
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const live = (await res.json()) as { build: string; builtAt?: string };
    const newer = live.build !== BUILD_ID;
    set({ updateAvailable: newer, latestBuiltAt: live.builtAt });
    if (newer) navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
    return newer;
  } catch {
    return false; // offline: try again later
  } finally {
    set({ checking: false, lastChecked: Date.now() });
  }
}

export async function applyUpdate() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
  } catch {
    /* reload anyway: pages are fetched network-first */
  }
  location.reload();
}

export async function promptInstall() {
  const p = state.installPrompt;
  if (!p) return false;
  await p.prompt();
  const { outcome } = await p.userChoice;
  set({ installPrompt: null, installed: outcome === 'accepted' || state.installed });
  return outcome === 'accepted';
}

/** Register the service worker and start periodic update checks (production only). */
export function startAppServices() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    set({ installPrompt: e as InstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => set({ installed: true, installPrompt: null }));
  if (!import.meta.env.PROD) return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker failed', err));
  }
  setTimeout(checkForUpdate, 5_000);
  setInterval(checkForUpdate, 30 * 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - (state.lastChecked ?? 0) > 5 * 60_000) checkForUpdate();
  });
}
