import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { db, touch, uid, type Era, type TimelineEvent } from '../db';
import { useWorld } from '../lib/world';
import { usePrefs } from '../lib/prefs';
import { formatYear } from '../lib/actions';
import { Markdown } from '../components/Markdown';
import { ArticlePicker } from '../components/ArticlePicker';

const COLORS = ['#e0a458', '#6ab0de', '#6fb38a', '#e07a6f', '#c58fd6', '#e5c86a', '#9aa0a6'];

export function TimelinePage() {
  const { world, index } = useWorld();
  const { playerView } = usePrefs();
  const location = useLocation();
  const timelines = useLiveQuery(() => db.timelines.where('worldId').equals(world.id).toArray(), [world.id]) ?? [];
  const allEvents = useLiveQuery(() => db.events.where('worldId').equals(world.id).toArray(), [world.id]) ?? [];
  const eras = useLiveQuery(() => db.eras.where('worldId').equals(world.id).sortBy('start'), [world.id]) ?? [];
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<TimelineEvent | 'new' | null>(null);
  const [editEra, setEditEra] = useState<Era | 'new' | null>(null);
  const [q, setQ] = useState('');
  const sfx = world.yearSuffix;

  const tlById = new Map(timelines.map((t) => [t.id, t]));
  const events = useMemo(
    () =>
      allEvents
        .filter((e) => !(playerView && e.gmOnly) && !hidden.has(e.timelineId))
        .filter((e) => !q || `${e.title} ${e.description}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.year - b.year || a.title.localeCompare(b.title)),
    [allEvents, playerView, hidden, q],
  );

  useEffect(() => {
    if (location.hash.startsWith('#ev-')) {
      setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
    }
  }, [location.hash, events.length]);

  // overview strip range
  const years = [...events.map((e) => e.year), ...events.map((e) => e.endYear ?? e.year), ...eras.flatMap((e) => [e.start, e.end])];
  const min = years.length ? Math.min(...years) : 0;
  const max = years.length ? Math.max(...years) : 100;
  const span = Math.max(1, max - min);
  const pct = (y: number) => ((y - min) / span) * 100;

  const eraOf = (y: number) => eras.find((e) => y >= e.start && y < e.end) ?? eras.find((e) => y === e.end);
  let lastEra: string | undefined = '__none';

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Timeline</h1>
          <p className="lead">Every event on parallel tracks, grouped into eras. Link events to articles and they show up there too.</p>
        </div>
        {!playerView && (
          <button className="btn primary" onClick={() => setEditing('new')}>
            <Plus size={16} /> Event
          </button>
        )}
      </header>

      <div className="timeline-controls card">
        <div className="row wrap">
          <b className="small">Tracks</b>
          {timelines.map((t) => (
            <TrackChip
              key={t.id}
              name={t.name}
              color={t.color}
              on={!hidden.has(t.id)}
              editable={!playerView}
              onToggle={() => setHidden((h) => { const n = new Set(h); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}
              onRename={(name, color) => db.timelines.update(t.id, { name, color })}
              onDelete={
                timelines.length > 1
                  ? async () => {
                      if (!confirm(`Delete track “${t.name}” and its events?`)) return;
                      await db.events.where('timelineId').equals(t.id).delete();
                      await db.timelines.delete(t.id);
                      await touch(world.id);
                    }
                  : undefined
              }
            />
          ))}
          {!playerView && (
            <button className="btn sm" onClick={() => db.timelines.add({ id: uid(), worldId: world.id, name: 'New track', color: COLORS[timelines.length % COLORS.length] })}>
              <Plus size={13} /> Track
            </button>
          )}
          <span className="grow" />
          <input className="input sm" style={{ maxWidth: 200 }} placeholder="Filter events…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <b className="small">Eras</b>
          {eras.map((e) => (
            <button key={e.id} className="chip" style={{ borderColor: e.color }} onClick={() => !playerView && setEditEra(e)}>
              <span className="swatch-dot" style={{ background: e.color }} /> {e.name} <span className="muted small">{formatYear(e.start, '', e.end)}</span>
            </button>
          ))}
          {!playerView && (
            <button className="btn sm" onClick={() => setEditEra('new')}>
              <Plus size={13} /> Era
            </button>
          )}
          {!playerView && (
            <label className="small muted" style={{ marginLeft: 'auto' }}>
              Year label{' '}
              <input className="input sm" style={{ width: 70 }} value={sfx} placeholder="e.g. AS" onChange={(e) => db.worlds.update(world.id, { yearSuffix: e.target.value })} />
            </label>
          )}
        </div>
      </div>

      {events.length > 0 && (
        <div className="overview" aria-hidden>
          {eras.map((e) => (
            <div key={e.id} className="ov-era" style={{ left: `${pct(e.start)}%`, width: `${Math.max(0.5, pct(e.end) - pct(e.start))}%`, background: e.color }} title={e.name}>
              <span>{e.name}</span>
            </div>
          ))}
          {events.map((e, i) => (
            <a
              key={e.id}
              href={`#${location.pathname}#ev-${e.id}`}
              onClick={(ev) => {
                ev.preventDefault();
                document.getElementById(`ev-${e.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }}
              className="ov-tick"
              style={{ left: `${pct(e.year)}%`, background: tlById.get(e.timelineId)?.color, animationDelay: `${0.2 + Math.min(i, 30) * 0.03}s` }}
              title={`${formatYear(e.year, sfx, e.endYear)}: ${e.title}`}
            />
          ))}
          <span className="ov-min">{formatYear(min, sfx)}</span>
          <span className="ov-max">{formatYear(max, sfx)}</span>
        </div>
      )}

      <ol className="chronicle">
        {events.map((e, i) => {
          const era = eraOf(e.year);
          const header = era?.id !== lastEra ? era : undefined;
          const showHeader = era?.id !== lastEra;
          lastEra = era?.id;
          const tl = tlById.get(e.timelineId);
          const a = e.articleId ? index.byId.get(e.articleId) : undefined;
          return (
            <li key={e.id} id={`ev-${e.id}`} className={`reveal ${location.hash === `#ev-${e.id}` ? 'flash' : ''}`} style={{ ['--i' as string]: Math.min(i, 14) }}>
              {showHeader && (
                <div className="era-head" style={{ color: header?.color }}>
                  {header ? `${header.name}` : 'Outside any era'}
                </div>
              )}
              <div className="event" style={{ ['--c' as string]: tl?.color }}>
                <div className="event-year">{formatYear(e.year, sfx, e.endYear)}</div>
                <div className="event-body">
                  <div className="row">
                    <b className="grow">{e.title}</b>
                    {e.gmOnly && <Lock size={12} className="muted" />}
                    <span className="muted small">{tl?.name}</span>
                    {!playerView && (
                      <button className="icon-btn sm ghost" onClick={() => setEditing(e)} aria-label="Edit event">
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                  {e.description && <Markdown source={e.description} inline />}
                  {a && !(playerView && a.gmOnly) && (
                    <div>
                      <Link className="chip" to={`/w/${world.id}/a/${a.id}`}>
                        {a.title}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {events.length === 0 && <p className="muted">No events yet.</p>}

      {editing && (
        <EventEditor
          event={editing === 'new' ? null : editing}
          timelines={timelines}
          onClose={() => setEditing(null)}
        />
      )}
      {editEra && <EraEditor era={editEra === 'new' ? null : editEra} onClose={() => setEditEra(null)} />}
    </div>
  );
}

function TrackChip({ name, color, on, editable, onToggle, onRename, onDelete }: {
  name: string; color: string; on: boolean; editable: boolean; onToggle: () => void; onRename: (n: string, c: string) => void; onDelete?: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [n, setN] = useState(name);
  if (edit)
    return (
      <span className="chip">
        <input className="input sm" style={{ width: 120 }} value={n} onChange={(e) => setN(e.target.value)} autoFocus />
        {COLORS.map((c) => (
          <button key={c} className={`swatch sm ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => onRename(n, c)} aria-label={c} />
        ))}
        <button className="btn sm" onClick={() => (onRename(n, color), setEdit(false))}>OK</button>
        {onDelete && <button className="icon-btn sm danger" onClick={onDelete} aria-label="Delete track"><Trash2 size={12} /></button>}
      </span>
    );
  return (
    <span className={`chip ${on ? '' : 'off'}`}>
      <button className="linklike" onClick={onToggle} title={on ? 'Hide track' : 'Show track'}>
        <span className="swatch-dot" style={{ background: on ? color : 'transparent', borderColor: color }} /> {name}
      </button>
      {editable && (
        <button className="icon-btn sm ghost" onClick={() => setEdit(true)} aria-label="Edit track">
          <Pencil size={11} />
        </button>
      )}
    </span>
  );
}

function EventEditor({ event, timelines, onClose }: { event: TimelineEvent | null; timelines: { id: string; name: string }[]; onClose: () => void }) {
  const { world } = useWorld();
  const [e, setE] = useState<TimelineEvent>(
    event ?? { id: uid(), worldId: world.id, timelineId: timelines[0]?.id ?? '', title: '', year: 0, endYear: null, articleId: null, description: '', gmOnly: false },
  );
  const [endText, setEndText] = useState(e.endYear != null ? String(e.endYear) : '');
  const save = async () => {
    if (!e.title.trim()) return;
    const end = endText.trim() === '' ? null : Number(endText);
    await db.events.put({ ...e, endYear: end != null && Number.isFinite(end) ? end : null });
    await touch(world.id);
    onClose();
  };
  return (
    <div className="overlay" onMouseDown={onClose}>
      <form className="modal" onMouseDown={(ev) => ev.stopPropagation()} onSubmit={(ev) => (ev.preventDefault(), save())}>
        <div className="row">
          <h2 className="grow">{event ? 'Edit event' : 'New event'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <label className="field">
          <span>Title</span>
          <input className="input" autoFocus value={e.title} onChange={(x) => setE({ ...e, title: x.target.value })} />
        </label>
        <div className="row">
          <label className="field grow">
            <span>Year (negative for before year 0)</span>
            <input className="input" type="number" value={e.year} onChange={(x) => setE({ ...e, year: Number(x.target.value) })} />
          </label>
          <label className="field grow">
            <span>End year (optional)</span>
            <input className="input" type="number" value={endText} onChange={(x) => setEndText(x.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Track</span>
          <select className="input" value={e.timelineId} onChange={(x) => setE({ ...e, timelineId: x.target.value })}>
            {timelines.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Linked article</span>
          <ArticlePicker value={e.articleId} onChange={(id) => setE({ ...e, articleId: id })} />
        </div>
        <label className="field">
          <span>Description ([[links]] work)</span>
          <textarea className="input" rows={3} value={e.description} onChange={(x) => setE({ ...e, description: x.target.value })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={e.gmOnly} onChange={(x) => setE({ ...e, gmOnly: x.target.checked })} /> <Lock size={13} /> GM only
        </label>
        <div className="row">
          {event && (
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                await db.events.delete(event.id);
                await touch(world.id);
                onClose();
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!e.title.trim()}>Save</button>
        </div>
      </form>
    </div>
  );
}

function EraEditor({ era, onClose }: { era: Era | null; onClose: () => void }) {
  const { world } = useWorld();
  const [e, setE] = useState<Era>(era ?? { id: uid(), worldId: world.id, name: '', start: 0, end: 100, color: COLORS[0] });
  return (
    <div className="overlay" onMouseDown={onClose}>
      <form
        className="modal"
        onMouseDown={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (!e.name.trim()) return;
          await db.eras.put({ ...e, end: Math.max(e.start, e.end) });
          await touch(world.id);
          onClose();
        }}
      >
        <h2>{era ? 'Edit era' : 'New era'}</h2>
        <label className="field">
          <span>Name</span>
          <input className="input" autoFocus value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} />
        </label>
        <div className="row">
          <label className="field grow">
            <span>Starts</span>
            <input className="input" type="number" value={e.start} onChange={(x) => setE({ ...e, start: Number(x.target.value) })} />
          </label>
          <label className="field grow">
            <span>Ends</span>
            <input className="input" type="number" value={e.end} onChange={(x) => setE({ ...e, end: Number(x.target.value) })} />
          </label>
        </div>
        <div className="swatches">
          {COLORS.map((c) => (
            <button type="button" key={c} className={`swatch ${e.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setE({ ...e, color: c })} aria-label={c} />
          ))}
        </div>
        <div className="row">
          {era && (
            <button type="button" className="btn danger" onClick={async () => (await db.eras.delete(era.id), onClose())}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary">Save</button>
        </div>
      </form>
    </div>
  );
}
