import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft, CloudFog, Eye, EyeOff, ImagePlus, Layers, Lock, Map as MapIcon, MapPin, Maximize, Move, Pentagon, Plus,
  Trash2, X, ZoomIn, ZoomOut, ExternalLink,
} from 'lucide-react';
import { db, touch, uid, type MapLayer, type Pin, type Region, type WorldMap } from '../db';
import { useWorld } from '../lib/world';
import { usePrefs } from '../lib/prefs';
import { ArticlePicker } from '../components/ArticlePicker';
import { plainExcerpt } from '../lib/markdown';
import { imageFileToDataUrl } from '../lib/io';
import { trashMap } from '../lib/trash';
import { showUndo } from '../lib/undo';
import { underFog } from '../lib/geometry';

const PIN_COLORS = ['#e0a458', '#e07a6f', '#6fb38a', '#6ab0de', '#c58fd6', '#e5c86a', '#f2f2f2'];
type Mode = 'view' | 'pin' | 'region' | 'move';
type Sel = { kind: 'pin' | 'region'; id: string } | null;

export function MapView() {
  const { mapId = '' } = useParams();
  const { world } = useWorld();
  const map = useLiveQuery(() => db.maps.get(mapId), [mapId], null);
  const allMaps = useLiveQuery(() => db.maps.where('worldId').equals(world.id).toArray(), [world.id]) ?? [];
  if (map === null) return <div className="loading">Unrolling the map…</div>;
  if (!map) return <div className="empty-state">Map not found. It may be in the trash.</div>;
  return <MapCanvas key={map.id} map={map} allMaps={allMaps} />;
}

const centroid = (pts: [number, number][]) => {
  const n = pts.length || 1;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n] as [number, number];
};

function MapCanvas({ map, allMaps }: { map: WorldMap; allMaps: WorldMap[] }) {
  const { world } = useWorld();
  const { playerView } = usePrefs();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [mode, setMode] = useState<Mode>('view');
  const [sel, setSel] = useState<Sel>(params.get('pin') ? { kind: 'pin', id: params.get('pin')! } : params.get('region') ? { kind: 'region', id: params.get('region')! } : null);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<'items' | 'layers'>('items');
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const layers = map.layers ?? [];
  const regions = map.regions ?? [];
  const [layerVis, setLayerVis] = useState<Record<string, boolean>>(() => Object.fromEntries(layers.map((l) => [l.id, !l.hidden])));
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean; pin?: string; hitPin?: string; hitRegion?: string } | null>(null);
  const base = `/w/${world.id}`;

  const layerShown = (id?: string | null) => {
    if (!id) return true;
    const l = layers.find((x) => x.id === id);
    if (!l) return true;
    if (playerView && l.gmOnly) return false;
    return layerVis[id] ?? !l.hidden;
  };
  const visible = <T extends { gmOnly?: boolean; layerId?: string | null }>(x: T) => !(playerView && x.gmOnly) && layerShown(x.layerId);
  // players can't see anything under fog of war
  const fogged = (x: number, y: number) => playerView && underFog(x, y, regions);
  const pins = map.pins.filter((p) => visible(p) && !fogged(p.x, p.y));
  const shownRegions = regions.filter((r) => (playerView && r.fog ? true : visible(r) && !(playerView && fogged(...centroid(r.points)))));
  const selPin = sel?.kind === 'pin' ? pins.find((p) => p.id === sel.id) : undefined;
  const selRegion = sel?.kind === 'region' ? shownRegions.find((r) => r.id === sel.id && !(playerView && r.fog)) : undefined;

  const save = async (patch: Partial<WorldMap>) => {
    await db.maps.update(map.id, patch);
    await touch(world.id);
  };
  const updatePin = (id: string, patch: Partial<Pin>) => save({ pins: map.pins.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const updateRegion = (id: string, patch: Partial<Region>) => save({ regions: regions.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const updateLayer = (id: string, patch: Partial<MapLayer>) => save({ layers: layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  const fit = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const k = Math.min(el.clientWidth / map.width, el.clientHeight / map.height) * 0.95;
    setView({ k, x: (el.clientWidth - map.width * k) / 2, y: (el.clientHeight - map.height * k) / 2 });
  }, [map.width, map.height]);

  const focusOn = (x: number, y: number, zoom?: number) => {
    const el = wrap.current;
    if (!el) return;
    setView((v) => {
      const k = zoom ?? v.k;
      return { k, x: el.clientWidth / 2 - x * map.width * k, y: el.clientHeight / 2 - y * map.height * k };
    });
  };

  useEffect(() => {
    fit();
    const el = wrap.current;
    if (!el) return;
    const close = Math.max(1, Math.min(el.clientWidth / map.width, el.clientHeight / map.height) * 2.5);
    const p = map.pins.find((x) => x.id === params.get('pin'));
    const r = regions.find((x) => x.id === params.get('region'));
    if (p) focusOn(p.x, p.y, close);
    else if (r) focusOn(...centroid(r.points), close);
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

  const finishRegion = useCallback(
    async (pts: [number, number][]) => {
      // a double-click adds the same point twice; drop near-duplicates
      const clean = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.002);
      setDraft([]);
      setMode('view');
      if (clean.length < 3) return;
      const r: Region = { id: uid(), name: 'New region', points: clean, color: PIN_COLORS[regions.length % PIN_COLORS.length], articleId: null, layerId: activeLayer };
      await save({ regions: [...regions, r] });
      setSel({ kind: 'region', id: r.id });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [regions, activeLayer],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (mode === 'region' && e.key === 'Enter') finishRegion(draft);
      if (e.key === 'Escape') {
        setDraft([]);
        setMode('view');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, draft, finishRegion]);

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
    const t = e.target as HTMLElement;
    const pinEl = t.closest('[data-pin]') as HTMLElement | null;
    const regEl = t.closest('[data-region]') as Element | null;
    drag.current = {
      sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false,
      hitPin: pinEl?.dataset.pin, hitRegion: regEl?.getAttribute('data-region') ?? undefined,
      pin: mode === 'move' ? pinEl?.dataset.pin : undefined,
    };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
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
    const pt = toImage(e.clientX, e.clientY);
    const inside = pt.x >= 0 && pt.y >= 0 && pt.x <= 1 && pt.y <= 1;
    if (mode === 'region') {
      if (!inside) return;
      // clicking the first point closes the shape
      if (draft.length >= 3) {
        const [fx, fy] = draft[0];
        if (Math.hypot((pt.x - fx) * map.width * view.k, (pt.y - fy) * map.height * view.k) < 12) return finishRegion(draft);
      }
      setDraft((dr) => [...dr, [clamp(pt.x), clamp(pt.y)]]);
      return;
    }
    if (d.hitPin) return setSel({ kind: 'pin', id: d.hitPin });
    if (mode === 'pin') {
      if (!inside) return;
      const pin: Pin = { id: uid(), x: pt.x, y: pt.y, label: 'New pin', color: PIN_COLORS[0], articleId: null, mapId: null, layerId: activeLayer };
      save({ pins: [...map.pins, pin] });
      setSel({ kind: 'pin', id: pin.id });
      setMode('view');
      return;
    }
    if (d.hitRegion) return setSel({ kind: 'region', id: d.hitRegion });
    setSel(null);
  };

  const parent = allMaps.find((m) => m.id === map.parentMapId);
  const listedPins = pins.filter((p) => !filter || p.label.toLowerCase().includes(filter.toLowerCase()));
  const listedRegions = shownRegions.filter((r) => !(playerView && r.fog) && (!filter || r.name.toLowerCase().includes(filter.toLowerCase())));
  const hatch = Math.max(8, map.width / 110);
  const visibleLayers = layers.filter((l) => !(playerView && l.gmOnly));

  return (
    <div className="map-page">
      <div className="map-toolbar">
        <Link className="icon-btn" to={parent ? `${base}/maps/${parent.id}` : `${base}/maps`} title={parent ? `Up to ${parent.name}` : 'All maps'}>
          <ArrowLeft size={17} />
        </Link>
        <input className="map-name" value={map.name} readOnly={playerView} onChange={(e) => db.maps.update(map.id, { name: e.target.value })} aria-label="Map name" />
        <span className="grow" />
        {!playerView && (
          <>
            {layers.length > 0 && (
              <select className="input sm" style={{ width: 'auto' }} value={activeLayer ?? ''} onChange={(e) => setActiveLayer(e.target.value || null)} title="New pins and regions go on this layer">
                <option value="">Draw on: base map</option>
                {layers.map((l) => (
                  <option key={l.id} value={l.id}>Draw on: {l.name}</option>
                ))}
              </select>
            )}
            <div className="seg">
              <button className={mode === 'view' ? 'on' : ''} onClick={() => (setMode('view'), setDraft([]))} title="Pan and select">View</button>
              <button className={mode === 'pin' ? 'on' : ''} onClick={() => (setMode('pin'), setDraft([]))} title="Click the map to drop a pin">
                <MapPin size={14} /> Pin
              </button>
              <button className={mode === 'region' ? 'on' : ''} onClick={() => (setMode('region'), setDraft([]), setSel(null))} title="Click points to outline a region">
                <Pentagon size={14} /> Region
              </button>
              <button className={mode === 'move' ? 'on' : ''} onClick={() => (setMode('move'), setDraft([]))} title="Drag pins to move them">
                <Move size={14} /> Move
              </button>
            </div>
          </>
        )}
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
          onDoubleClick={() => mode === 'region' && finishRegion(draft)}
        >
          <div className="map-layer" style={{ width: map.width, height: map.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
            <img src={map.image} width={map.width} height={map.height} alt={map.name} draggable={false} />
            {layers.filter((l) => l.image && layerShown(l.id)).map((l) => (
              <img key={l.id} className="map-overlay" src={l.image!} width={map.width} height={map.height} alt="" draggable={false} style={{ opacity: l.opacity }} />
            ))}
            <svg className="map-svg" width={map.width} height={map.height} viewBox={`0 0 ${map.width} ${map.height}`}>
              <defs>
                <pattern id="fogHatch" patternUnits="userSpaceOnUse" width={hatch} height={hatch} patternTransform="rotate(45)">
                  <rect width={hatch} height={hatch} fill="rgba(10,10,14,.45)" />
                  <line x1="0" y1="0" x2="0" y2={hatch} stroke="rgba(255,255,255,.22)" strokeWidth={hatch / 3} />
                </pattern>
              </defs>
              {shownRegions.map((r, i) => {
                const pts = r.points.map(([x, y]) => `${x * map.width},${y * map.height}`).join(' ');
                const isSel = sel?.kind === 'region' && sel.id === r.id;
                if (r.fog && playerView) return <polygon key={r.id} className="fog-cover" points={pts} />;
                return (
                  <polygon
                    key={r.id}
                    data-region={r.id}
                    className={`region ${r.fog ? 'fog' : ''} ${isSel ? 'sel' : ''}`}
                    points={pts}
                    style={{ ['--rc' as string]: r.color, animationDelay: `${Math.min(i, 12) * 60}ms` }}
                    fill={r.fog ? 'url(#fogHatch)' : undefined}
                  />
                );
              })}
              {draft.length > 0 && (
                <>
                  <polyline className="draft-line" points={draft.map(([x, y]) => `${x * map.width},${y * map.height}`).join(' ')} />
                  {draft.map(([x, y], i) => (
                    <circle key={i} className={`draft-pt ${i === 0 && draft.length >= 3 ? 'first' : ''}`} cx={x * map.width} cy={y * map.height} r={(i === 0 && draft.length >= 3 ? 7 : 4.5) / view.k} />
                  ))}
                </>
              )}
            </svg>
            {shownRegions.filter((r) => !(playerView && r.fog) && r.points.length).map((r) => {
              const [cx, cy] = centroid(r.points);
              return (
                <div key={r.id} className="region-label" style={{ left: cx * map.width, top: cy * map.height, transform: `translate(-50%, -50%) scale(${1 / view.k})`, ['--rc' as string]: r.color }}>
                  {r.fog && <CloudFog size={12} />} {r.name}
                </div>
              );
            })}
            {pins.map((p, i) => (
              <div
                key={p.id}
                data-pin={p.id}
                className={`pin ${sel?.kind === 'pin' && sel.id === p.id ? 'sel' : ''} ${p.mapId ? 'portal' : ''}`}
                style={{ left: p.x * map.width, top: p.y * map.height, transform: `translate(-50%, -100%) scale(${1 / view.k})`, ['--pin' as string]: p.color, ['--i' as string]: Math.min(i, 20) }}
                title={p.label}
              >
                {p.mapId ? <MapIcon size={18} /> : <MapPin size={22} fill="currentColor" />}
                <span className="pin-label">{p.label}</span>
              </div>
            ))}
          </div>
          {mode === 'pin' && <div className="map-hint">Click anywhere on the map to drop a pin</div>}
          {mode === 'move' && <div className="map-hint">Drag pins to move them</div>}
          {mode === 'region' && (
            <div className="map-hint interactive">
              {draft.length < 3 ? `Click to place points (${draft.length} so far)` : 'Double-click, press Enter or click the first point to finish'}
              {draft.length >= 3 && (
                <button className="btn sm primary" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => finishRegion(draft)}>
                  Finish
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="map-side">
          {selPin ? (
            <PinEditor
              key={selPin.id}
              pin={selPin}
              maps={allMaps.filter((m) => m.id !== map.id)}
              layers={layers}
              onChange={(patch) => updatePin(selPin.id, patch)}
              onDelete={() => (save({ pins: map.pins.filter((p) => p.id !== selPin.id) }), setSel(null))}
              onClose={() => setSel(null)}
              onOpenMap={async (id) => {
                const target = allMaps.find((m) => m.id === id);
                if (target && !target.parentMapId) await db.maps.update(id, { parentMapId: map.id });
                navigate(`${base}/maps/${id}`);
              }}
            />
          ) : selRegion ? (
            <RegionEditor
              key={selRegion.id}
              region={selRegion}
              layers={layers}
              onChange={(patch) => updateRegion(selRegion.id, patch)}
              onDelete={() => (save({ regions: regions.filter((r) => r.id !== selRegion.id) }), setSel(null))}
              onClose={() => setSel(null)}
            />
          ) : (
            <>
              <div className="seg side-tabs">
                <button className={tab === 'items' ? 'on' : ''} onClick={() => setTab('items')}>
                  <MapPin size={13} /> Places
                </button>
                <button className={tab === 'layers' ? 'on' : ''} onClick={() => setTab('layers')}>
                  <Layers size={13} /> Layers {visibleLayers.length ? `(${visibleLayers.length})` : ''}
                </button>
              </div>
              {tab === 'items' ? (
                <>
                  <input className="input sm" placeholder="Filter pins and regions…" value={filter} onChange={(e) => setFilter(e.target.value)} />
                  <ul className="plain-list pin-list">
                    {listedPins.map((p) => (
                      <li key={p.id}>
                        <button className="list-link" onClick={() => (setSel({ kind: 'pin', id: p.id }), focusOn(p.x, p.y))}>
                          <MapPin size={13} color={p.color} /> <span className="ellipsis grow">{p.label}</span>
                          {p.gmOnly && <Lock size={11} />}
                        </button>
                      </li>
                    ))}
                    {listedRegions.map((r) => (
                      <li key={r.id}>
                        <button className="list-link" onClick={() => (setSel({ kind: 'region', id: r.id }), focusOn(...centroid(r.points)))}>
                          {r.fog ? <CloudFog size={13} /> : <Pentagon size={13} color={r.color} />} <span className="ellipsis grow">{r.name}</span>
                          {r.gmOnly && <Lock size={11} />}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {pins.length + regions.length === 0 && <p className="muted small">Choose “Pin” or “Region” above, then click the map.</p>}
                </>
              ) : (
                <LayersPanel
                  layers={visibleLayers}
                  vis={(id) => layerShown(id)}
                  toggle={(id) => setLayerVis((v) => ({ ...v, [id]: !layerShown(id) }))}
                  update={updateLayer}
                  add={(l) => save({ layers: [...layers, l] })}
                  remove={(id) =>
                    save({
                      layers: layers.filter((l) => l.id !== id),
                      pins: map.pins.map((p) => (p.layerId === id ? { ...p, layerId: null } : p)),
                      regions: regions.map((r) => (r.layerId === id ? { ...r, layerId: null } : r)),
                    })
                  }
                  editable={!playerView}
                />
              )}
              {!playerView && (
                <>
                  <hr />
                  <button
                    className="btn sm danger"
                    onClick={async () => {
                      const tid = await trashMap(map.id);
                      navigate(`${base}/maps`);
                      showUndo(map.name, tid);
                    }}
                  >
                    <Trash2 size={13} /> Delete map
                  </button>
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

function LayerSelect({ value, layers, onChange }: { value?: string | null; layers: MapLayer[]; onChange: (id: string | null) => void }) {
  if (!layers.length) return null;
  return (
    <label className="field">
      <span>Layer</span>
      <select className="input sm" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Base map (always shown)</option>
        {layers.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </label>
  );
}

function LayersPanel({ layers, vis, toggle, update, add, remove, editable }: {
  layers: MapLayer[];
  vis: (id: string) => boolean;
  toggle: (id: string) => void;
  update: (id: string, patch: Partial<MapLayer>) => void;
  add: (l: MapLayer) => void;
  remove: (id: string) => void;
  editable: boolean;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const make = async (file?: File) => {
    const n = name.trim() || (file ? file.name.replace(/\.[^.]+$/, '') : 'New layer');
    setBusy(true);
    try {
      const image = file ? (await imageFileToDataUrl(file, 4096)).url : null;
      add({ id: uid(), name: n, image, opacity: 1, hidden: false });
      setName('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="layers">
      <p className="muted small">Layers group pins and regions (political, trade routes, secrets…). Give one an image to overlay a different version of the map.</p>
      {layers.map((l) => (
        <div key={l.id} className={`layer-row ${vis(l.id) ? '' : 'off'}`}>
          <button className="icon-btn sm" onClick={() => toggle(l.id)} aria-label={vis(l.id) ? 'Hide layer' : 'Show layer'}>
            {vis(l.id) ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          {editable ? (
            <input className="input sm grow" defaultValue={l.name} onBlur={(e) => e.target.value.trim() && update(l.id, { name: e.target.value.trim() })} />
          ) : (
            <span className="grow">{l.name}</span>
          )}
          {l.gmOnly && <Lock size={12} className="muted" />}
          {editable && (
            <button className="icon-btn sm danger" onClick={() => confirm(`Delete layer “${l.name}”? Its pins and regions move to the base map.`) && remove(l.id)} aria-label="Delete layer">
              <Trash2 size={12} />
            </button>
          )}
          {editable && (
            <div className="layer-opts">
              {l.image && (
                <label className="small muted row">
                  Opacity <input type="range" min={0.1} max={1} step={0.05} value={l.opacity} onChange={(e) => update(l.id, { opacity: Number(e.target.value) })} />
                </label>
              )}
              <label className="check small">
                <input type="checkbox" checked={!!l.gmOnly} onChange={(e) => update(l.id, { gmOnly: e.target.checked })} /> GM only
              </label>
              <label className="check small">
                <input type="checkbox" checked={!!l.hidden} onChange={(e) => update(l.id, { hidden: e.target.checked })} /> Start hidden
              </label>
            </div>
          )}
        </div>
      ))}
      {layers.length === 0 && <p className="muted small">No layers yet.</p>}
      {editable && (
        <div className="row" style={{ marginTop: 10 }}>
          <input className="input sm grow" placeholder="Layer name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn sm" disabled={busy} onClick={() => make()} title="Layer for pins and regions">
            <Plus size={13} /> Add
          </button>
          <label className="btn sm" title="Layer with an overlay image">
            <ImagePlus size={13} />
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) make(f); }} />
          </label>
        </div>
      )}
    </div>
  );
}

function LinkedArticleCard({ articleId }: { articleId?: string | null }) {
  const { world, index } = useWorld();
  const { playerView } = usePrefs();
  const a = articleId ? index.byId.get(articleId) : undefined;
  if (!a || (playerView && a.gmOnly)) return null;
  return (
    <div className="pin-article card">
      {a.image && <img src={a.image} alt="" />}
      <b>{a.title}</b>
      <p className="small muted">{plainExcerpt(a.summary || a.body, 140)}</p>
      <Link className="btn sm primary" to={`/w/${world.id}/a/${a.id}`}>
        <ExternalLink size={13} /> Open article
      </Link>
    </div>
  );
}

function RegionEditor({ region, layers, onChange, onDelete, onClose }: {
  region: Region;
  layers: MapLayer[];
  onChange: (p: Partial<Region>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { index } = useWorld();
  const { playerView } = usePrefs();
  const [name, setName] = useState(region.name);
  const [note, setNote] = useState(region.note ?? '');
  return (
    <div className="pin-editor">
      <div className="row">
        <h3 className="grow">{region.fog ? 'Fog of war' : 'Region'}</h3>
        <button className="icon-btn sm" onClick={onClose} aria-label="Close"><X size={15} /></button>
      </div>
      <LinkedArticleCard articleId={region.articleId} />
      {playerView ? (
        <>
          <b>{region.name}</b>
          {region.note && <p>{region.note}</p>}
        </>
      ) : (
        <>
          <label className="field">
            <span>Name</span>
            <input className="input sm" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => onChange({ name })} />
          </label>
          <div className="field">
            <span>Links to article</span>
            <ArticlePicker
              value={region.articleId}
              onChange={(id) => {
                const t = id ? index.byId.get(id)?.title : undefined;
                if (t && (name === 'New region' || !name)) setName(t);
                onChange({ articleId: id, ...(t && (region.name === 'New region' || !region.name) ? { name: t } : {}) });
              }}
            />
          </div>
          <div className="field">
            <span>Color</span>
            <div className="swatches">
              {PIN_COLORS.map((c) => (
                <button key={c} className={`swatch ${region.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange({ color: c })} aria-label={`Color ${c}`} />
              ))}
            </div>
          </div>
          <LayerSelect value={region.layerId} layers={layers} onChange={(id) => onChange({ layerId: id })} />
          <label className="field">
            <span>Note</span>
            <textarea className="input sm" rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => onChange({ note })} />
          </label>
          <label className="check">
            <input type="checkbox" checked={!!region.fog} onChange={(e) => onChange({ fog: e.target.checked })} />
            <CloudFog size={13} /> Fog of war (covers this area in player view)
          </label>
          <label className="check">
            <input type="checkbox" checked={!!region.gmOnly} onChange={(e) => onChange({ gmOnly: e.target.checked })} />
            <Lock size={13} /> GM only
          </label>
          <p className="muted small">Untick fog as the party explores to reveal the area.</p>
          <button className="btn sm danger" onClick={onDelete}>
            <Trash2 size={13} /> Delete region
          </button>
        </>
      )}
    </div>
  );
}

function PinEditor({ pin, maps, layers, onChange, onDelete, onClose, onOpenMap }: {
  pin: Pin;
  maps: WorldMap[];
  layers: MapLayer[];
  onChange: (p: Partial<Pin>) => void;
  onDelete: () => void;
  onClose: () => void;
  onOpenMap: (id: string) => void;
}) {
  const { index } = useWorld();
  const { playerView } = usePrefs();
  const [label, setLabel] = useState(pin.label);
  const [note, setNote] = useState(pin.note ?? '');

  return (
    <div className="pin-editor">
      <div className="row">
        <h3 className="grow">Pin</h3>
        <button className="icon-btn sm" onClick={onClose} aria-label="Close"><X size={15} /></button>
      </div>
      <LinkedArticleCard articleId={pin.articleId} />
      {pin.mapId && (
        <button className="btn sm" onClick={() => onOpenMap(pin.mapId!)} style={{ marginBottom: 12 }}>
          <MapIcon size={13} /> Open {maps.find((m) => m.id === pin.mapId)?.name ?? 'map'}
        </button>
      )}
      {!playerView ? (
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
          <LayerSelect value={pin.layerId} layers={layers} onChange={(id) => onChange({ layerId: id })} />
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
      ) : (
        <>
          <b>{pin.label}</b>
          {pin.note && <p>{pin.note}</p>}
        </>
      )}
    </div>
  );
}
