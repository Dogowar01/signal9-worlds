import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Moon, Plus, RotateCcw, Sparkles, Sun, Upload, X } from 'lucide-react';
import { purgeTrash, restoreTrash } from '../lib/trash';
import { createWorld, db } from '../db';
import { createSampleWorld } from '../lib/sample';
import { importWorld } from '../lib/io';
import { usePrefs } from '../lib/prefs';
import { timeAgo } from '../lib/actions';
import { APP_VERSION, promptInstall, useAppStatus } from '../lib/appUpdate';
import { Starfield } from '../components/Starfield';
import { WorldCover } from '../components/WorldArt';

export function WorldsPage() {
  const worlds = useLiveQuery(() => db.worlds.orderBy('updatedAt').reverse().toArray(), []);
  const counts = useLiveQuery(async () => {
    const all = await db.articles.toArray();
    const m = new Map<string, number>();
    for (const a of all) m.set(a.worldId, (m.get(a.worldId) ?? 0) + 1);
    return m;
  }, []);
  const deletedWorlds = useLiveQuery(() => db.trash.filter((t) => t.kind === 'world').reverse().sortBy('deletedAt'), []);
  const navigate = useNavigate();
  const { theme, setTheme } = usePrefs();
  const { installPrompt, installed } = useAppStatus();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const make = async () => {
    if (!name.trim()) return;
    const w = await createWorld(name.trim());
    navigate(`/w/${w.id}`);
  };

  return (
    <div className="home">
      <Starfield />
      <div className="home-inner">
        <header className="home-head">
          <div>
            <div className="eyebrow">Worldbuilding, your way</div>
            <h1 className="brand">Signal9 Worlds</h1>
            <p className="brand-tag">Your private atlas of people, places and secrets. Everything stays on this device unless you export it.</p>
          </div>
          <div className="row">
            {installPrompt && !installed && (
              <button className="btn sm" onClick={promptInstall}>
                <Download size={14} /> Install app
              </button>
            )}
            <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <section className="card new-world">
          <h2>Begin a new world</h2>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              make();
            }}
          >
            <input className="input grow" placeholder="Name it: The Shattered Reach, Eldmoor, Station Nine…" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn primary" disabled={!name.trim()}>
              <Plus size={16} /> Create
            </button>
          </form>
          <div className="row wrap" style={{ marginTop: 12 }}>
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const id = await createSampleWorld();
                navigate(`/w/${id}`);
              }}
            >
              <Sparkles size={16} /> {busy ? 'Conjuring…' : 'Explore a sample world'}
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Import a world file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  setError('');
                  const id = await importWorld(JSON.parse(await file.text()));
                  navigate(`/w/${id}`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
              }}
            />
          </div>
          {error && <p className="error">{error}</p>}
        </section>

        {worlds && worlds.length > 0 && <h2 className="section-title">Your worlds</h2>}
        <section className="world-grid stagger">
          {worlds?.map((w) => (
            <button key={w.id} className="card world-card" onClick={() => navigate(`/w/${w.id}`)}>
              <div className="cover-wrap">
                <WorldCover seed={w.id} />
              </div>
              <div className="world-card-body">
                <h3>{w.name}</h3>
                {w.description && <p className="muted">{w.description}</p>}
                <p className="muted small">
                  {counts?.get(w.id) ?? 0} articles · edited {timeAgo(w.updatedAt)}
                </p>
              </div>
            </button>
          ))}
        </section>
        {worlds && worlds.length === 0 && (
          <p className="muted center" style={{ animation: 'fadeUp .6s .2s both' }}>
            No worlds yet. Name one above, or open the sample to look around.
          </p>
        )}
        {deletedWorlds && deletedWorlds.length > 0 && (
          <section className="deleted-worlds">
            <h3 className="sub">Recently deleted</h3>
            {deletedWorlds.map((t) => (
              <div key={t.id} className="trash-row">
                <span className="grow">
                  <b>{t.label}</b> <span className="muted small">deleted {timeAgo(t.deletedAt)}</span>
                </span>
                <button
                  className="btn sm"
                  onClick={async () => {
                    const route = await restoreTrash(t.id);
                    if (route) navigate(route);
                  }}
                >
                  <RotateCcw size={13} /> Restore
                </button>
                <button
                  className="icon-btn sm danger"
                  title="Delete forever"
                  onClick={() => confirm(`Permanently delete “${t.label}”? This can't be undone.`) && purgeTrash(t.id)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </section>
        )}
        <p className="muted small center home-foot">Signal9 Worlds v{APP_VERSION}</p>
      </div>
    </div>
  );
}
