import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, List, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { db, touch, uid, type Era, type TimelineEvent, type WorldCalendar } from '../db';
import { useWorld } from '../lib/world';
import { usePrefs } from '../lib/prefs';
import {
  CALENDAR_PRESETS, absoluteDay, compareEvents, formatEventDate, formatShortDate, getCalendar, hasMonths, moonGlyph,
  moonName, moonPhase, weekdayName, yearPosition,
} from '../lib/calendar';
import { trashEvent } from '../lib/trash';
import { showUndo } from '../lib/undo';
import { Markdown } from '../components/Markdown';
import { stripLinks } from '../lib/links';
import { ArticlePicker } from '../components/ArticlePicker';

const COLORS = ['#e0a458', '#6ab0de', '#6fb38a', '#e07a6f', '#c58fd6', '#e5c86a', '#9aa0a6'];

export function TimelinePage() {
  const { world, index, events: allEvents, timelines } = useWorld();
  const { playerView } = usePrefs();
  const location = useLocation();
  const eras = useLiveQuery(() => db.eras.where('worldId').equals(world.id).sortBy('start'), [world.id]) ?? [];
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<TimelineEvent | 'new' | null>(null);
  const [editEra, setEditEra] = useState<Era | 'new' | null>(null);
  const [editCal, setEditCal] = useState(false);
  const [view, setView] = useState<'chronicle' | 'calendar'>('chronicle');
  const [q, setQ] = useState('');
  const cal = getCalendar(world);
  const sfx = world.yearSuffix;

  const tlById = new Map(timelines.map((t) => [t.id, t]));
  const events = useMemo(
    () =>
      allEvents
        .filter((e) => !(playerView && e.gmOnly) && !hidden.has(e.timelineId))
        .filter((e) => !q || `${e.title} ${e.description}`.toLowerCase().includes(q.toLowerCase()))
        .sort(compareEvents(cal)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEvents, playerView, hidden, q, world.calendar],
  );

  useEffect(() => {
    if (location.hash.startsWith('#ev-')) {
      setView('chronicle');
      setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150);
    }
  }, [location.hash, events.length]);

  // overview strip range
  const years = [...events.map((e) => yearPosition(cal, e)), ...events.map((e) => e.endYear ?? e.year), ...eras.flatMap((e) => [e.start, e.end])];
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
          <p className="lead">Every event on parallel tracks, grouped into eras, dated in your own calendar.</p>
        </div>
        <div className="row">
          <div className="seg">
            <button className={view === 'chronicle' ? 'on' : ''} onClick={() => setView('chronicle')}>
              <List size={14} /> Chronicle
            </button>
            <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>
              <CalendarDays size={14} /> Calendar
            </button>
          </div>
          {!playerView && (
            <button className="btn primary" onClick={() => setEditing('new')}>
              <Plus size={16} /> Event
            </button>
          )}
        </div>
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
        <div className="row wrap" style={{ marginTop: 10 }}>
          <b className="small">Eras</b>
          {eras.map((e) => (
            <button key={e.id} className="chip" style={{ borderColor: e.color }} onClick={() => !playerView && setEditEra(e)}>
              <span className="swatch-dot" style={{ background: e.color }} /> {e.name} <span className="muted small">{e.start}–{e.end}</span>
            </button>
          ))}
          {!playerView && (
            <button className="btn sm" onClick={() => setEditEra('new')}>
              <Plus size={13} /> Era
            </button>
          )}
          <span className="grow" />
          {!playerView && (
            <button className="btn sm" onClick={() => setEditCal(true)}>
              <CalendarDays size={13} /> Calendar: {hasMonths(cal) ? `${cal.months.length} months` : 'years only'}
            </button>
          )}
        </div>
      </div>

      {view === 'calendar' ? (
        <CalendarMonthView cal={cal} events={events} onOpenEvent={(e) => !playerView && setEditing(e)} onNew={() => setEditCal(true)} />
      ) : (
        <>
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
                  style={{ left: `${pct(yearPosition(cal, e))}%`, background: tlById.get(e.timelineId)?.color, animationDelay: `${0.2 + Math.min(i, 30) * 0.03}s` }}
                  title={`${formatEventDate(world, e)}: ${stripLinks(e.title)}`}
                />
              ))}
              <span className="ov-min">{Math.floor(min)}{sfx ? ` ${sfx}` : ''}</span>
              <span className="ov-max">{Math.ceil(max)}{sfx ? ` ${sfx}` : ''}</span>
            </div>
          )}

          <ol className="chronicle">
            {events.map((e, i) => {
              const era = eraOf(e.year);
              const showHeader = era?.id !== lastEra;
              lastEra = era?.id;
              const tl = tlById.get(e.timelineId);
              const a = e.articleId ? index.byId.get(e.articleId) : undefined;
              return (
                <li key={e.id} id={`ev-${e.id}`} className={`reveal ${location.hash === `#ev-${e.id}` ? 'flash' : ''}`} style={{ ['--i' as string]: Math.min(i, 14) }}>
                  {showHeader && (
                    <div className="era-head" style={{ color: era?.color }}>
                      {era ? era.name : 'Outside any era'}
                    </div>
                  )}
                  <div className="event" style={{ ['--c' as string]: tl?.color }}>
                    <div className="event-year">{formatEventDate(world, e)}</div>
                    <div className="event-body">
                      <div className="row">
                        <b className="grow"><Markdown source={e.title} inline /></b>
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
          {events.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><CalendarDays size={26} /></div>
              No events yet.{!playerView && ' Add the first one with “+ Event”.'}
            </div>
          )}
        </>
      )}

      {editing && <EventEditor event={editing === 'new' ? null : editing} timelines={timelines} cal={cal} onClose={() => setEditing(null)} />}
      {editEra && <EraEditor era={editEra === 'new' ? null : editEra} onClose={() => setEditEra(null)} />}
      {editCal && <CalendarEditor initial={cal} onClose={() => setEditCal(false)} />}
    </div>
  );
}

// ---------------- Calendar month grid ----------------

function CalendarMonthView({ cal, events, onOpenEvent, onNew }: { cal: WorldCalendar; events: TimelineEvent[]; onOpenEvent: (e: TimelineEvent) => void; onNew: () => void }) {
  const { world, timelines } = useWorld();
  const latest = events.length ? events[events.length - 1] : null;
  const [year, setYear] = useState(latest?.year ?? 0);
  const [month, setMonth] = useState(latest?.month ?? 1);
  const color = new Map(timelines.map((t) => [t.id, t.color]));

  if (!hasMonths(cal))
    return (
      <div className="empty-state card">
        <div className="empty-icon"><CalendarDays size={26} /></div>
        Your world uses years only. Set up months, weekdays and moons to see a calendar.
        <button className="btn primary" onClick={onNew}>Set up a calendar</button>
      </div>
    );

  const m = Math.min(Math.max(1, month), cal.months.length);
  const days = cal.months[m - 1].days;
  const firstAbs = absoluteDay(cal, year, m, 1);
  const cols = Math.max(1, cal.weekdays.length || 7);
  const lead = cal.weekdays.length ? ((firstAbs + cal.weekdayOffset) % cols + cols) % cols : 0;
  const step = (d: number) => {
    let nm = m + d;
    let ny = year;
    if (nm < 1) { nm = cal.months.length; ny--; }
    if (nm > cal.months.length) { nm = 1; ny++; }
    setMonth(nm);
    setYear(ny);
  };
  const inMonth = events.filter((e) => e.year === year && e.month === m);
  const undated = events.filter((e) => e.year === year && !e.month);

  return (
    <div className="cal card">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <div className="cal-title" key={`${year}-${m}`}>
          <h2>{cal.months[m - 1].name}</h2>
          <span className="muted">
            Year <input className="input sm cal-year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /> {world.yearSuffix}
          </span>
        </div>
        <button className="icon-btn" onClick={() => step(1)} aria-label="Next month"><ChevronRight size={18} /></button>
      </div>
      <div className="cal-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {cal.weekdays.map((w) => (
          <div key={w} className="cal-wd">{w}</div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`pad${i}`} className="cal-day pad" />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const abs = firstAbs + i;
          const evs = inMonth.filter((e) => (e.day ?? 1) === d);
          return (
            <div key={d} className={`cal-day ${evs.length ? 'has' : ''}`} style={{ animationDelay: `${Math.min(i, 30) * 8}ms` }}>
              <div className="cal-num">
                {d}
                <span className="cal-moons">
                  {cal.moons.map((mo) => {
                    // mark only the day each main phase (new, first quarter, full, last quarter) is reached
                    const ph = moonPhase(mo.cycle, mo.offset, abs);
                    const next = moonPhase(mo.cycle, mo.offset, abs + 1);
                    const hit = [0, 0.25, 0.5, 0.75].find((t) => (t === 0 ? next < ph : ph <= t && next > t));
                    if (hit === undefined) return null;
                    return <span key={mo.name} title={`${mo.name}: ${moonName(hit)}`}>{moonGlyph(hit)}</span>;
                  })}
                </span>
              </div>
              {evs.map((e) => (
                <button key={e.id} className="cal-ev" style={{ ['--c' as string]: color.get(e.timelineId) }} onClick={() => onOpenEvent(e)} title={stripLinks(e.title)}>
                  {stripLinks(e.title)}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {undated.length > 0 && (
        <p className="muted small" style={{ marginTop: 12 }}>
          Also in {year}{world.yearSuffix ? ` ${world.yearSuffix}` : ''} (no month set): {undated.map((e) => e.title).join(', ')}
        </p>
      )}
      {cal.weekdays.length > 0 && (
        <p className="muted small">
          The 1st of {cal.months[m - 1].name} falls on a {weekdayName(cal, firstAbs)}. {cal.moons.length ? 'Moon icons mark the new, quarter and full moons (hover for which moon).' : ''}
        </p>
      )}
    </div>
  );
}

// ---------------- Editors ----------------

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

function EventEditor({ event, timelines, cal, onClose }: { event: TimelineEvent | null; timelines: { id: string; name: string }[]; cal: WorldCalendar; onClose: () => void }) {
  const { world } = useWorld();
  const [e, setE] = useState<TimelineEvent>(
    event ?? { id: uid(), worldId: world.id, timelineId: timelines[0]?.id ?? '', title: '', year: 0, month: null, day: null, endYear: null, articleId: null, description: '', gmOnly: false },
  );
  const [endText, setEndText] = useState(e.endYear != null ? String(e.endYear) : '');
  const maxDay = e.month ? cal.months[e.month - 1]?.days ?? 31 : 31;
  const save = async () => {
    if (!e.title.trim()) return;
    const end = endText.trim() === '' ? null : Number(endText);
    await db.events.put({ ...e, day: e.month ? e.day : null, endYear: end != null && Number.isFinite(end) ? end : null });
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
            <span>Year</span>
            <input className="input" type="number" value={e.year} onChange={(x) => setE({ ...e, year: Number(x.target.value) })} />
          </label>
          {hasMonths(cal) && (
            <>
              <label className="field grow">
                <span>Month</span>
                <select className="input" value={e.month ?? ''} onChange={(x) => setE({ ...e, month: x.target.value ? Number(x.target.value) : null })}>
                  <option value="">—</option>
                  {cal.months.map((m, i) => (
                    <option key={i} value={i + 1}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ width: 84 }}>
                <span>Day</span>
                <input className="input" type="number" min={1} max={maxDay} disabled={!e.month} value={e.day ?? ''} onChange={(x) => setE({ ...e, day: x.target.value ? Math.min(maxDay, Math.max(1, Number(x.target.value))) : null })} />
              </label>
            </>
          )}
          <label className="field" style={{ width: 110 }}>
            <span>Until year</span>
            <input className="input" type="number" value={endText} onChange={(x) => setEndText(x.target.value)} />
          </label>
        </div>
        <p className="muted small" style={{ marginTop: -4 }}>Shows as: {formatEventDate(world, { ...e, endYear: endText ? Number(endText) : null })}</p>
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
                const t = await trashEvent(event.id);
                showUndo(event.title, t);
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
        <div className="row" style={{ marginTop: 16 }}>
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

function CalendarEditor({ initial, onClose }: { initial: WorldCalendar; onClose: () => void }) {
  const { world } = useWorld();
  const [c, setC] = useState<WorldCalendar>(structuredClone(initial));
  const [suffix, setSuffix] = useState(world.yearSuffix);
  const setMonths = (months: WorldCalendar['months']) => setC({ ...c, months });
  const total = c.months.reduce((n, m) => n + (m.days || 0), 0);
  const move = <T,>(arr: T[], i: number, d: number) => {
    const b = [...arr];
    [b[i], b[i + d]] = [b[i + d], b[i]];
    return b;
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <form
        className="modal wide"
        onMouseDown={(ev) => ev.stopPropagation()}
        onSubmit={async (ev) => {
          ev.preventDefault();
          const clean: WorldCalendar = {
            months: c.months.filter((m) => m.name.trim()).map((m) => ({ name: m.name.trim(), days: Math.max(1, Math.round(m.days) || 1) })),
            weekdays: c.weekdays.map((w) => w.trim()).filter(Boolean),
            moons: c.moons.filter((m) => m.name.trim()).map((m) => ({ ...m, name: m.name.trim(), cycle: Math.max(1, Number(m.cycle) || 1), offset: Number(m.offset) || 0 })),
            weekdayOffset: Number(c.weekdayOffset) || 0,
          };
          await db.worlds.update(world.id, { calendar: clean, yearSuffix: suffix, updatedAt: Date.now() });
          onClose();
        }}
      >
        <div className="row">
          <h2 className="grow">World calendar</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <p className="muted small">Start from a preset or build your own. Existing events keep their year; months and days are optional on every event.</p>
        <div className="row wrap" style={{ marginBottom: 14 }}>
          {CALENDAR_PRESETS.map((p) => (
            <button type="button" key={p.name} className="chip" onClick={() => setC(structuredClone(p.calendar))}>
              {p.name}
            </button>
          ))}
          <button type="button" className="chip" onClick={() => setC({ months: [], weekdays: [], moons: [], weekdayOffset: 0 })}>Years only</button>
        </div>
        <div className="cal-edit-grid">
          <section>
            <h3 className="sub">Months · {total} days a year</h3>
            {c.months.map((m, i) => (
              <div key={i} className="field-row">
                <input className="input sm grow" value={m.name} placeholder="Month name" onChange={(e) => setMonths(c.months.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input className="input sm" style={{ width: 70 }} type="number" min={1} value={m.days} onChange={(e) => setMonths(c.months.map((x, j) => (j === i ? { ...x, days: Number(e.target.value) } : x)))} />
                <button type="button" className="icon-btn sm" disabled={i === 0} onClick={() => setMonths(move(c.months, i, -1))} aria-label="Move up"><ArrowUp size={12} /></button>
                <button type="button" className="icon-btn sm" disabled={i === c.months.length - 1} onClick={() => setMonths(move(c.months, i, 1))} aria-label="Move down"><ArrowDown size={12} /></button>
                <button type="button" className="icon-btn sm danger" onClick={() => setMonths(c.months.filter((_, j) => j !== i))} aria-label="Remove"><X size={12} /></button>
              </div>
            ))}
            <button type="button" className="btn sm" onClick={() => setMonths([...c.months, { name: '', days: 30 }])}><Plus size={13} /> Month</button>
          </section>
          <section>
            <h3 className="sub">Weekdays</h3>
            <textarea className="input sm" rows={4} value={c.weekdays.join(', ')} placeholder="Comma separated, e.g. Sunsday, Moonsday…" onChange={(e) => setC({ ...c, weekdays: e.target.value.split(',') })} />
            <label className="field" style={{ marginTop: 8 }}>
              <span>Year 0 starts on weekday #</span>
              <input className="input sm" type="number" value={c.weekdayOffset} onChange={(e) => setC({ ...c, weekdayOffset: Number(e.target.value) })} />
            </label>
            <h3 className="sub">Moons</h3>
            {c.moons.map((m, i) => (
              <div key={i} className="field-row">
                <input className="input sm grow" value={m.name} placeholder="Name" onChange={(e) => setC({ ...c, moons: c.moons.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <input className="input sm" style={{ width: 70 }} type="number" step="0.01" title="Days per cycle" value={m.cycle} onChange={(e) => setC({ ...c, moons: c.moons.map((x, j) => (j === i ? { ...x, cycle: Number(e.target.value) } : x)) })} />
                <input className="input sm" style={{ width: 60 }} type="number" title="Phase offset (days)" value={m.offset} onChange={(e) => setC({ ...c, moons: c.moons.map((x, j) => (j === i ? { ...x, offset: Number(e.target.value) } : x)) })} />
                <button type="button" className="icon-btn sm danger" onClick={() => setC({ ...c, moons: c.moons.filter((_, j) => j !== i) })} aria-label="Remove moon"><X size={12} /></button>
              </div>
            ))}
            <button type="button" className="btn sm" onClick={() => setC({ ...c, moons: [...c.moons, { name: 'Moon', cycle: 28, offset: 0 }] })}><Plus size={13} /> Moon</button>
            <p className="muted small">Cycle = days between full moons; offset shifts which day is full.</p>
            <label className="field">
              <span>Year label</span>
              <input className="input sm" value={suffix} placeholder="e.g. AS, Third Age" onChange={(e) => setSuffix(e.target.value)} />
            </label>
          </section>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="muted small grow">Example: {formatShortDate({ calendar: c, yearSuffix: suffix }, { year: 312, month: c.months.length ? 3 : null, day: c.months.length ? 14 : null })}</span>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary">Save calendar</button>
        </div>
      </form>
    </div>
  );
}
