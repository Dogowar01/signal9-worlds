import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CanonLens } from './canon';

type Theme = 'dark' | 'light';
interface Prefs {
  playerView: boolean;
  setPlayerView: (v: boolean) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  treeMode: 'type' | 'tree';
  setTreeMode: (m: 'type' | 'tree') => void;
  canonLens: CanonLens;
  setCanonLens: (l: CanonLens) => void;
}

const Ctx = createContext<Prefs | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: preference just won't persist */
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const systemDark = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  const [playerView, setPV] = useState(() => load('s9.playerView', false));
  const [theme, setT] = useState<Theme>(() => load<Theme>('s9.theme', systemDark ? 'dark' : 'light'));
  const [treeMode, setTM] = useState<'type' | 'tree'>(() => load('s9.treeMode', 'type'));
  const [canonLens, setCL] = useState<CanonLens>(() => load<CanonLens>('s9.canonLens', 'all'));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.classList.toggle('player-view', playerView);
  }, [playerView]);

  return (
    <Ctx.Provider
      value={{
        playerView,
        setPlayerView: (v) => (setPV(v), save('s9.playerView', v)),
        theme,
        setTheme: (t) => (setT(t), save('s9.theme', t)),
        treeMode,
        setTreeMode: (m) => (setTM(m), save('s9.treeMode', m)),
        canonLens,
        setCanonLens: (l) => (setCL(l), save('s9.canonLens', l)),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePrefs() {
  const p = useContext(Ctx);
  if (!p) throw new Error('PrefsProvider missing');
  return p;
}
