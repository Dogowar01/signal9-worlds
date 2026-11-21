import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ExternalLink, Lock, Map as MapIcon, MapPin, Maximize, Move, Plus, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { db, touch, uid, type Pin, type WorldMap } from '../db';
import { useWorld } from '../lib/world';
import { usePrefs } from '../lib/prefs';
import { ArticlePicker } from '../components/ArticlePicker';
import { plainExcerpt } from '../lib/markdown';

const PIN_COLORS = ['#e0a458', '#e07a6f', '#6fb38a', '#6ab0de', '#c58fd6', '#e5c86a', '#f2f2f2'];

export function MapView() {
  const { mapId = '' } = useParams();
  const { world } = useWorld();
  const map = useLiveQuery(() => db.maps.get(mapId), [mapId], null);
  const allMaps = useLiveQuery(() => db.maps.where('worldId').equals(world.id).toArray(), [world.id]) ?? [];
  if (map === null) return <div className="loading">Loading map…</div>;
  if (!map) return <div className="empty-state">Map not found.</div>;
  return <MapCanvas key={map.id} map={map} allMaps={allMaps} />;
}

function MapCanvas({ map, allMaps }: { map: WorldMap; allMaps: WorldMap[] }) {
  const { world, index } = useWorld();
  const { playerView } = usePrefs();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [mode, setMode] = useState<'view' | 'add' | 'move'>('view');
  const [selected, setSelected] = useState<string | null>(params.get('pin'));
  const [filter, setFilter] = useState('');
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean; pin?: string; hit?: string } | null>(null);
  const base = `/w/${world.id}`;

  const pins = map.pins.filter((p) => !(playerView && p.gmOnly));
  const sel = map.pins.find((p) => p.id === selected);

  const savePins = async (next: Pin[]) => {
    await db.maps.update(map.id, { pins: next });
    await touch(world.id);
  };
  const updatePin = (id: string, patch: Partial<Pin>) => savePins(map.pins.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const fit = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const k = Math.min(el.clientWidth / map.width, el.clientHeight / map.height) * 0.95;
    setView({ k, x: (el.clientWidth - map.width * k) / 2, y: (el.clientHeight - map.height * k) / 2 });
  }, [map.width, map.height]);

  useEffect(() => {
    fit();
    const pinId = params.get('pin');
    const p = map.pins.find((x) => x.id === pinId);
    const el = wrap.current;
    if (p && el) {
      const k = Math.max(1, Math.min(el.clientWidth / map.width, el.clientHeight / map.height) * 2.5);
      setView({ k, x: el.clientWidth / 2 - p.x * map.width * k, y: el.clientHeight / 2 - p.y * map.height * k });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit]);

  // wheel zoom needs a non-passive listener
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setView((v) => {
        const k = Math.min(20, Math.max(0.05, v.k * Math.exp(-e.deltaY * 0.0015)));
        return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoom = (f: number) => {
    const el = wrap.current!;
    const mx = el.clientWidth / 2;
    const my = el.clientHeight / 2;
    setView((v) => {
      const k = Math.min(20, Math.max(0.05, v.k * f));
      return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k };
    });
  };

  const toImage = (clientX: number, clientY: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.k / map.width, y: (clientY - r.top - view.y) / view.k / map.height };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const pinEl = (e.target as HTMLElement).closest('[data-pin]') as HTMLElement | null;
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false, hit: pinEl?.dataset.pin, pin: mode === 'move' ? pinEl?.dataset.pin : undefined };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    if (d.pin) {
      const pt = toImage(e.clientX, e.clientY);
      const el = wrap.current!.querySelector(`[data-pin="${d.pin}"]`) as HTMLElement | null;
      if (el) {
        el.style.left = `${pt.x * map.width}px`;
        el.style.top = `${pt.y * map.height}px`;
      }
    } else setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.pin && d.moved) {
      const pt = toImage(e.clientX, e.clientY);
      updatePin(d.pin, { x: clamp(pt.x), y: clamp(pt.y) });
      return;
    }
    if (d.moved) return;
    // pointer capture retargets pointerup, so use the pin recorded on pointerdown
    if (d.hit) {
      setSelected(d.hit);
      return;
    }
    if (mode === 'add') {
      const pt = toImage(e.clientX, e.clientY);
      if (pt.x < 0 || pt.y < 0 || pt.x > 1 || pt.y > 1) return;
      const pin: Pin = { id: uid(), x: pt.x, y: pt.y, label: 'New pin', color: PIN_COLORS[0], articleId: null, mapId: null };
      savePins([...map.pins, pin]);
      setSelected(pin.id);
      setMode('view');
    } else setSelected(null);
  };

  const parent = allMaps.find((m) => m.id === map.parentMapId);
  const listed = pins.filter((p) => !filter || p.label.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="map-page">
      <div className="map-toolbar">
        <Link className="icon-btn" to={parent ? `${base}/maps/${parent.id}` : `${base}/maps`} title={parent ? `Up to ${parent.name}` : 'All maps'}>
          <ArrowLeft size={17} />
        </Link>
        <input className="map-name" value={map.name} onChange={(e) => db.maps.update(map.id, { name: e.target.value })} aria-label="Map name" />
        <span className="grow" />
        <div className="seg">
          <button className={mode === 'view' ? 'on' : ''} onClick={() => setMode('view')} title="Pan and select">
            View
          </button>
          <button className={mode === 'add' ? 'on' : ''} onClick={() => setMode('add')} title="Click the map to drop a pin">
            <Plus size={14} /> Pin
          </button>
          <button className={mode === 'move' ? 'on' : ''} onClick={() => setMode('move')} title="Drag pins to move them">
            <Move size={14} /> Move
          </button>
        </div>
        <button className="icon-btn" onClick={() => zoom(1.3)} aria-label="Zoom in"><ZoomIn size={17} /></button>
        <button className="icon-btn" onClick={() => zoom(1 / 1.3)} aria-label="Zoom out"><ZoomOut size={17} /></button>
        <button className="icon-btn" onClick={fit} aria-label="Fit to screen"><Maximize size={17} /></button>
      </div>
      <div className="map-body">
        <div
          ref={wrap}
          className={`map-wrap mode-${mode}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="map-layer" style={{ width: map.width, height: map.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
            <img src={map.image} width={map.width} height={map.height} alt={map.name} draggable={false} />
            {pins.map((p, i) => {
              const a = p.articleId ? index.byId.get(p.articleId) : undefined;
              const hiddenLink = a && playerView && a.gmOnly;
              return (
                <div
                  key={p.id}
                  data-pin={p.id}
                  className={`pin ${selected === p.id ? 'sel' : ''} ${p.mapId ? 'portal' : ''}`}
                  style={{ left: p.x * map.width, top: p.y * map.height, transform: `translate(-50%, -100%) scale(${1 / view.k})`, ['--pin' as string]: p.color, ['--i' as string]: Math.min(i, 20) }}
                  title={hiddenLink ? p.label : p.label}
                >
                  {p.mapId ? <MapIcon size={18} /> : <MapPin size={22} fill="currentColor" />}
                  <span className="pin-label">{p.label}</span>
                </div>
              );
            })}
          </div>
          {mode === 'add' && <div className="map-hint">Click anywhere on the map to drop a pin</div>}
          {mode === 'move' && <div className="map-hint">Drag pins to move them</div>}
        </div>

        <aside className="map-side">
          {sel ? (
            <PinEditor
              key={sel.id}
              pin={sel}
              maps={allMaps.filter((m) => m.id !== map.id)}
              onChange={(patch) => updatePin(sel.id, patch)}
              onDelete={() => (savePins(map.pins.filter((p) => p.id !== sel.id)), setSelected(null))}
              onClose={() => setSelected(null)}
              onOpenMap={async (id) => {
                const target = allMaps.find((m) => m.id === id);
                if (target && !target.parentMapId) await db.maps.update(id, { parentMapId: map.id });
                navigate(`${base}/maps/${id}`);
              }}
            />
          ) : (
            <>
              <h3>Pins ({pins.length})</h3>
              <input className="input sm" placeholder="Filter pins…" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <ul className="plain-list pin-list">
                {listed.map((p) => (
                  <li key={p.id}>
                    <button
                      className="list-link"
                      onClick={() => {
                        setSelected(p.id);
                        const el = wrap.current!;
                        setView((v) => ({ ...v, x: el.clientWidth / 2 - p.x * map.width * v.k, y: el.clientHeight / 2 - p.y * map.height * v.k }));
                      }}
                    >
                      <MapPin size={13} color={p.color} /> <span className="ellipsis grow">{p.label}</span>
                      {p.gmOnly && <Lock size={11} />}
                    </button>
                  </li>
                ))}
              </ul>
              {pins.length === 0 && <p className="muted small">Choose “+ Pin”, then click the map.</p>}
              <hr />
              <button
                className="btn sm danger"
                onClick={async () => {
                  if (!confirm(`Delete the map “${map.name}” and all its pins?`)) return;
                  await db.maps.delete(map.id);
                  await touch(world.id);
                  navigate(`${base}/maps`);
                }}
              >
                <Trash2 size={13} /> Delete map
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

function PinEditor({ pin, maps, onChange, onDelete, onClose, onOpenMap }: {
  pin: Pin;
  maps: WorldMap[];
  onChange: (p: Partial<Pin>) => void;
  onDelete: () => void;
  onClose: () => void;
  onOpenMap: (id: string) => void;
}) {
  const { world, index } = useWorld();
  const { playerView } = usePrefs();
  const [label, setLabel] = useState(pin.label);
  const [note, setNote] = useState(pin.note ?? '');
  const a = pin.articleId ? index.byId.get(pin.articleId) : undefined;
  const showArticle = a && !(playerView && a.gmOnly);

  return (
    <div className="pin-editor">
      <div className="row">
        <h3 className="grow">Pin</h3>
        <button className="icon-btn sm" onClick={onClose} aria-label="Close"><X size={15} /></button>
      </div>
      {showArticle && (
        <div className="pin-article card">
          {a.image && <img src={a.image} alt="" />}
          <b>{a.title}</b>
          <p className="small muted">{plainExcerpt(a.summary || a.body, 140)}</p>
          <Link className="btn sm primary" to={`/w/${world.id}/a/${a.id}`}>
            <ExternalLink size={13} /> Open article
          </Link>
        </div>
      )}
      {pin.mapId && (
        <button className="btn sm" onClick={() => onOpenMap(pin.mapId!)}>
          <MapIcon size={13} /> Open {maps.find((m) => m.id === pin.mapId)?.name ?? 'map'}
        </button>
      )}
      {!playerView && (
        <>
          <label className="field">
            <span>Label</span>
            <input className="input sm" value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => onChange({ label })} />
          </label>
          <div className="field">
            <span>Links to article</span>
            <ArticlePicker
              value={pin.articleId}
              onChange={(id) => onChange({ articleId: id, ...(id && (pin.label === 'New pin' || !pin.label) ? { label: index.byId.get(id)?.title ?? pin.label } : {}) })}
            />
          </div>
          <label className="field">
            <span>Opens map (drill down)</span>
            <select className="input sm" value={pin.mapId ?? ''} onChange={(e) => onChange({ mapId: e.target.value || null })}>
              <option value="">None</option>
              {maps.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>Color</span>
            <div className="swatches">
              {PIN_COLORS.map((c) => (
                <button key={c} className={`swatch ${pin.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange({ color: c })} aria-label={`Color ${c}`} />
              ))}
            </div>
          </div>
          <label className="field">
            <span>Note</span>
            <textarea className="input sm" rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => onChange({ note })} />
          </label>
          <label className="check">
            <input type="checkbox" checked={!!pin.gmOnly} onChange={(e) => onChange({ gmOnly: e.target.checked })} />
            <Lock size={13} /> GM only
          </label>
          <button className="btn sm danger" onClick={onDelete}>
            <Trash2 size={13} /> Delete pin
          </button>
        </>
      )}
      {playerView && pin.note && <p>{pin.note}</p>}
    </div>
  );
}
