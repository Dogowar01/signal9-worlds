import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Maximize } from 'lucide-react';
import { useWorld } from '../lib/world';
import { ArticlePicker } from '../components/ArticlePicker';

interface Node { id: string; x: number; y: number; vx: number; vy: number; r: number; fixed?: boolean }
interface Edge { a: string; b: string; kind: 'link' | 'rel' | 'parent'; label?: string }

export function GraphPage() {
  const { world, articles, templateById, index, relations, templates } = useWorld();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const focus = params.get('focus');
  const [showLinks, setShowLinks] = useState(true);
  const [showRels, setShowRels] = useState(true);
  const [showParents, setShowParents] = useState(true);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [depth, setDepth] = useState(2);
  const [hover, setHover] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodes = useRef(new Map<string, Node>());
  const view = useRef({ x: 0, y: 0, k: 1 });
  const alpha = useRef(1);
  const raf = useRef(0);
  const autoFit = useRef(true);

  const { visibleIds, edges } = useMemo(() => {
    const ids = new Set(articles.filter((a) => !hiddenTypes.has(a.templateId)).map((a) => a.id));
    const edges: Edge[] = [];
    if (showLinks)
      for (const [from, tos] of index.outgoing) for (const to of tos) if (ids.has(from) && ids.has(to)) edges.push({ a: from, b: to, kind: 'link' });
    if (showRels) for (const r of relations) if (ids.has(r.fromId) && ids.has(r.toId)) edges.push({ a: r.fromId, b: r.toId, kind: 'rel', label: r.type });
    if (showParents) for (const a of articles) if (a.parentId && ids.has(a.id) && ids.has(a.parentId)) edges.push({ a: a.id, b: a.parentId, kind: 'parent' });
    let visible = ids;
    if (focus && ids.has(focus)) {
      visible = new Set([focus]);
      let frontier = [focus];
      for (let d = 0; d < depth; d++) {
        const next: string[] = [];
        for (const e of edges) {
          if (frontier.includes(e.a) && !visible.has(e.b)) (visible.add(e.b), next.push(e.b));
          if (frontier.includes(e.b) && !visible.has(e.a)) (visible.add(e.a), next.push(e.a));
        }
        frontier = next;
      }
    }
    return { visibleIds: visible, edges: edges.filter((e) => visible.has(e.a) && visible.has(e.b)) };
  }, [articles, hiddenTypes, showLinks, showRels, showParents, index, relations, focus, depth]);

  // degree for node size
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of edges) (d.set(e.a, (d.get(e.a) ?? 0) + 1), d.set(e.b, (d.get(e.b) ?? 0) + 1));
    return d;
  }, [edges]);

  // sync node set
  useEffect(() => {
    const m = nodes.current;
    for (const id of [...m.keys()]) if (!visibleIds.has(id)) m.delete(id);
    const n = visibleIds.size;
    let i = 0;
    for (const id of visibleIds) {
      if (!m.has(id)) {
        const ang = i * 2.4;
        const rad = 40 + 12 * Math.sqrt(i) * Math.sqrt(n);
        m.set(id, { id, x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, vx: 0, vy: 0, r: 6 });
      }
      m.get(id)!.r = 6 + Math.min(14, Math.sqrt(degree.get(id) ?? 0) * 3);
      i++;
    }
    if (focus && m.has(focus)) {
      const f = m.get(focus)!;
      f.x = 0; f.y = 0; f.fixed = true;
    }
    for (const nd of m.values()) if (nd.id !== focus) nd.fixed = false;
    alpha.current = 1;
    run();
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds, edges, degree]);

  function step() {
    const list = [...nodes.current.values()];
    const a = alpha.current;
    // repulsion
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const q = list[j];
        let dx = p.x - q.x;
        let dy = p.y - q.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = Math.random(); dy = Math.random(); d2 = 1; }
        if (d2 > 640000) continue;
        const f = (12000 * a) / d2;
        const d = Math.sqrt(d2);
        p.vx += (dx / d) * f; p.vy += (dy / d) * f;
        q.vx -= (dx / d) * f; q.vy -= (dy / d) * f;
      }
    }
    // springs
    for (const e of edges) {
      const p = nodes.current.get(e.a);
      const q = nodes.current.get(e.b);
      if (!p || !q) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = e.kind === 'rel' ? 190 : 150;
      const f = ((d - target) / d) * 0.04 * a;
      p.vx += dx * f; p.vy += dy * f;
      q.vx -= dx * f; q.vy -= dy * f;
    }
    // gravity + integrate
    for (const p of list) {
      p.vx -= p.x * 0.0015 * a;
      p.vy -= p.y * 0.0015 * a;
      if (p.fixed) { p.vx = p.vy = 0; continue; }
      p.vx *= 0.6; p.vy *= 0.6;
      p.x += Math.max(-30, Math.min(30, p.vx));
      p.y += Math.max(-30, Math.min(30, p.vy));
    }
    alpha.current *= 0.985;
  }

  function run() {
    cancelAnimationFrame(raf.current);
    const loop = () => {
      step(); step();
      setTick((t) => t + 1);
      if (alpha.current > 0.02) raf.current = requestAnimationFrame(loop);
      else if (autoFit.current) {
        autoFit.current = false;
        fit();
      }
    };
    raf.current = requestAnimationFrame(loop);
  }

  const fit = () => {
    const svg = svgRef.current;
    const list = [...nodes.current.values()];
    if (!svg || !list.length) return;
    const xs = list.map((n) => n.x);
    const ys = list.map((n) => n.y);
    const minX = Math.min(...xs) - 60, maxX = Math.max(...xs) + 60, minY = Math.min(...ys) - 40, maxY = Math.max(...ys) + 40;
    const k = Math.min(1.2, svg.clientWidth / (maxX - minX), svg.clientHeight / (maxY - minY));
    view.current = { k, x: svg.clientWidth / 2 - ((minX + maxX) / 2) * k, y: svg.clientHeight / 2 - ((minY + maxY) / 2) * k };
    setTick((t) => t + 1);
  };

  useEffect(() => {
    const svg = svgRef.current!;
    view.current = { k: 1, x: svg.clientWidth / 2, y: svg.clientHeight / 2 };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const v = view.current;
      const k = Math.min(5, Math.max(0.1, v.k * Math.exp(-e.deltaY * 0.0015)));
      view.current = { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k };
      setTick((t) => t + 1);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    autoFit.current = true;
    const t = setTimeout(fit, 500);
    return () => (svg.removeEventListener('wheel', onWheel), clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const drag = useRef<{ id?: string; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    const id = (e.target as Element).closest('[data-node]')?.getAttribute('data-node') ?? undefined;
    drag.current = { id, sx: e.clientX, sy: e.clientY, vx: view.current.x, vy: view.current.y, moved: false };
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (!d.moved) return;
    if (d.id) {
      const n = nodes.current.get(d.id);
      if (!n) return;
      const r = svgRef.current!.getBoundingClientRect();
      n.x = (e.clientX - r.left - view.current.x) / view.current.k;
      n.y = (e.clientY - r.top - view.current.y) / view.current.k;
      n.fixed = true;
      alpha.current = Math.max(alpha.current, 0.3);
      run();
    } else {
      view.current = { ...view.current, x: d.vx + dx, y: d.vy + dy };
      setTick((t) => t + 1);
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.id && !d.moved) navigate(`/w/${world.id}/a/${d.id}`);
  };

  const v = view.current;
  const neighbours = new Set<string>();
  if (hover) for (const e of edges) if (e.a === hover || e.b === hover) (neighbours.add(e.a), neighbours.add(e.b));

  return (
    <div className="graph-page">
      <div className="graph-controls card">
        <h2>Connections</h2>
        <p className="muted small">Drag to pan, scroll to zoom, drag a node to pin it, click to open.</p>
        <label className="check"><input type="checkbox" checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} /> Article links</label>
        <label className="check"><input type="checkbox" checked={showRels} onChange={(e) => setShowRels(e.target.checked)} /> Relationships</label>
        <label className="check"><input type="checkbox" checked={showParents} onChange={(e) => setShowParents(e.target.checked)} /> Parent / child</label>
        <div className="field">
          <span>Focus on</span>
          <ArticlePicker value={focus} onChange={(id) => setParams(id ? { focus: id } : {})} placeholder="Whole world" />
        </div>
        {focus && (
          <label className="field">
            <span>Depth: {depth}</span>
            <input type="range" min={1} max={4} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
          </label>
        )}
        <div className="field">
          <span>Types</span>
          {templates.map((t) => (
            <label key={t.id} className="check small">
              <input
                type="checkbox"
                checked={!hiddenTypes.has(t.id)}
                onChange={() => setHiddenTypes((h) => { const n = new Set(h); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}
              />
              <span className="swatch-dot" style={{ background: t.color }} /> {t.name}
            </label>
          ))}
        </div>
        <button className="btn sm" onClick={fit}><Maximize size={13} /> Fit</button>
      </div>
      <svg ref={svgRef} className="graph" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="arrow" />
          </marker>
        </defs>
        <g transform={`translate(${v.x},${v.y}) scale(${v.k})`}>
          {edges.map((e, i) => {
            const p = nodes.current.get(e.a);
            const q = nodes.current.get(e.b);
            if (!p || !q) return null;
            const dim = hover && !(e.a === hover || e.b === hover);
            const dx = q.x - p.x, dy = q.y - p.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const ex = q.x - (dx / d) * (q.r + 2), ey = q.y - (dy / d) * (q.r + 2);
            return (
              <g key={i} className={`edge ${e.kind} ${dim ? 'dim' : ''}`}>
                <line x1={p.x} y1={p.y} x2={ex} y2={ey} markerEnd={e.kind === 'parent' ? undefined : 'url(#arrow)'} />
                {e.label && (hover ? !dim : v.k > 0.9) && (
                  <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 4} textAnchor="middle">{e.label}</text>
                )}
              </g>
            );
          })}
          {[...nodes.current.values()].map((n) => {
            const a = index.byId.get(n.id);
            if (!a) return null;
            const t = templateById.get(a.templateId);
            const dim = hover && hover !== n.id && !neighbours.has(n.id);
            return (
              <g
                key={n.id}
                data-node={n.id}
                className={`node ${dim ? 'dim' : ''} ${n.id === focus ? 'focus' : ''}`}
                transform={`translate(${n.x},${n.y})`}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(null)}
              >
                <circle r={n.r} fill={t?.color ?? '#999'} />
                {(v.k > 0.6 || n.r > 10 || hover === n.id || neighbours.has(n.id)) && (
                  <text y={n.r + 13} textAnchor="middle">{a.title}</text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {visibleIds.size === 0 && <div className="graph-empty muted">Nothing to show yet. Write some articles with [[links]].</div>}
    </div>
  );
}
