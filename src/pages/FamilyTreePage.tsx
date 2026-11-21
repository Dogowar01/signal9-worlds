import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { GitFork, Heart, Maximize, UserPlus } from 'lucide-react';
import { createArticle, db, touch, uid, type Article, type Relation } from '../db';
import { useWorld } from '../lib/world';
import { usePrefs } from '../lib/prefs';
import { ArticlePicker } from '../components/ArticlePicker';

const CARD_W = 172;
const CARD_H = 62;
const GAP_X = 34;
const GAP_Y = 110;

type Kin = 'parent' | 'child' | 'spouse' | 'sibling';

interface Family {
  parents: Map<string, Set<string>>;
  children: Map<string, Set<string>>;
  spouses: Map<string, Set<string>>;
  siblings: Map<string, Set<string>>;
}

const add = (m: Map<string, Set<string>>, a: string, b: string) => {
  if (!m.has(a)) m.set(a, new Set());
  m.get(a)!.add(b);
};

/** Read family links out of relationships, in either direction. */
function buildFamily(relations: Relation[]): Family {
  const f: Family = { parents: new Map(), children: new Map(), spouses: new Map(), siblings: new Map() };
  for (const r of relations) {
    const t = r.type.trim().toLowerCase();
    if (/^(parent|father|mother) of$/.test(t)) (add(f.children, r.fromId, r.toId), add(f.parents, r.toId, r.fromId));
    else if (/^(child|son|daughter) of$/.test(t)) (add(f.parents, r.fromId, r.toId), add(f.children, r.toId, r.fromId));
    else if (/^(spouse|husband|wife|partner|married to|consort) of$|^married to$/.test(t)) (add(f.spouses, r.fromId, r.toId), add(f.spouses, r.toId, r.fromId));
    else if (/^(sibling|brother|sister|twin) of$/.test(t)) (add(f.siblings, r.fromId, r.toId), add(f.siblings, r.toId, r.fromId));
  }
  return f;
}

const familySize = (f: Family, id: string) =>
  (f.parents.get(id)?.size ?? 0) + (f.children.get(id)?.size ?? 0) + (f.spouses.get(id)?.size ?? 0) + (f.siblings.get(id)?.size ?? 0);

interface Placed { id: string; gen: number; x: number; y: number }

function layout(f: Family, root: string, limit = 160) {
  const gen = new Map<string, number>([[root, 0]]);
  const queue = [root];
  while (queue.length && gen.size < limit) {
    const id = queue.shift()!;
    const g = gen.get(id)!;
    const visit = (ids: Set<string> | undefined, dg: number) =>
      ids?.forEach((o) => {
        if (!gen.has(o)) (gen.set(o, g + dg), queue.push(o));
      });
    visit(f.parents.get(id), -1);
    visit(f.children.get(id), 1);
    visit(f.spouses.get(id), 0);
    visit(f.siblings.get(id), 0);
  }
  const rows = new Map<number, string[]>();
  for (const [id, g] of gen) {
    if (!rows.has(g)) rows.set(g, []);
    rows.get(g)!.push(id);
  }
  const gens = [...rows.keys()].sort((a, b) => a - b);
  const x = new Map<string, number>();
  for (const g of gens) rows.get(g)!.forEach((id, i) => x.set(id, i * (CARD_W + GAP_X)));

  const neighbours = (id: string) => [...(f.parents.get(id) ?? []), ...(f.children.get(id) ?? [])].filter((o) => gen.has(o));
  const keepSpousesTogether = (row: string[]) => {
    const out: string[] = [];
    for (const id of row) {
      if (out.includes(id)) continue;
      out.push(id);
      for (const s of f.spouses.get(id) ?? []) if (row.includes(s) && !out.includes(s)) out.push(s);
    }
    return out;
  };

  // a few sweeps: order each generation by the average position of its relatives, then pack
  for (let iter = 0; iter < 6; iter++) {
    const order = iter % 2 === 0 ? gens : [...gens].reverse();
    for (const g of order) {
      const row = rows.get(g)!;
      const want = new Map(row.map((id) => {
        const n = neighbours(id);
        return [id, n.length ? n.reduce((s, o) => s + x.get(o)!, 0) / n.length : x.get(id)!];
      }));
      row.sort((a, b) => want.get(a)! - want.get(b)!);
      const sorted = keepSpousesTogether(row);
      rows.set(g, sorted);
      let prev = -Infinity;
      const placed = sorted.map((id) => {
        const p = Math.max(want.get(id)!, prev + CARD_W + GAP_X);
        prev = p;
        return p;
      });
      const shift = (placed.reduce((s, p, i) => s + (want.get(sorted[i])! - p), 0) / placed.length) || 0;
      sorted.forEach((id, i) => x.set(id, placed[i] + shift));
    }
  }
  const minX = Math.min(...x.values());
  const minG = gens[0];
  const nodes: Placed[] = [...gen.keys()].map((id) => ({ id, gen: gen.get(id)!, x: x.get(id)! - minX, y: (gen.get(id)! - minG) * (CARD_H + GAP_Y) }));
  return { nodes, truncated: gen.size >= limit };
}

export function FamilyTreePage() {
  const { world, articles, index, relations, templates, templateById } = useWorld();
  const { playerView } = usePrefs();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const family = useMemo(() => buildFamily(relations), [relations]);
  const visibleIds = new Set(articles.map((a) => a.id));
  const candidates = articles.filter((a) => familySize(family, a.id) > 0).sort((a, b) => familySize(family, b.id) - familySize(family, a.id));
  const root = params.get('root') && visibleIds.has(params.get('root')!) ? params.get('root')! : candidates[0]?.id;
  const [selected, setSelected] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 40, y: 40, k: 1 });
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean; node?: string } | null>(null);

  // hide GM-only people in player view by dropping their links
  const visibleFamily = useMemo(() => {
    if (!playerView) return family;
    const strip = (m: Map<string, Set<string>>) => new Map([...m].filter(([k]) => visibleIds.has(k)).map(([k, v]) => [k, new Set([...v].filter((o) => visibleIds.has(o)))]));
    return { parents: strip(family.parents), children: strip(family.children), spouses: strip(family.spouses), siblings: strip(family.siblings) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family, playerView, articles]);

  const { nodes, truncated } = useMemo(() => (root ? layout(visibleFamily, root) : { nodes: [], truncated: false }), [visibleFamily, root]);
  const pos = new Map(nodes.map((n) => [n.id, n]));

  const fit = () => {
    const svg = svgRef.current;
    if (!svg || !nodes.length) return;
    const w = Math.max(...nodes.map((n) => n.x)) + CARD_W;
    const h = Math.max(...nodes.map((n) => n.y)) + CARD_H;
    const k = Math.min(1.1, (svg.clientWidth - 60) / w, (svg.clientHeight - 60) / h);
    setView({ k, x: (svg.clientWidth - w * k) / 2, y: (svg.clientHeight - h * k) / 2 });
  };
  useEffect(fit, [root, nodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      setView((v) => {
        const k = Math.min(2.5, Math.max(0.2, v.k * Math.exp(-e.deltaY * 0.0015)));
        return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [root]);

  // parent→child connectors grouped by the set of parents, so couples share one line down
  const unions = new Map<string, { parents: string[]; kids: string[] }>();
  for (const n of nodes) {
    const ps = [...(visibleFamily.parents.get(n.id) ?? [])].filter((p) => pos.has(p)).sort();
    if (!ps.length) continue;
    const key = ps.join('|');
    if (!unions.has(key)) unions.set(key, { parents: ps, kids: [] });
    unions.get(key)!.kids.push(n.id);
  }
  const spousePairs: [string, string][] = [];
  for (const n of nodes) for (const s of visibleFamily.spouses.get(n.id) ?? []) if (pos.has(s) && n.id < s) spousePairs.push([n.id, s]);

  const sel = selected ? index.byId.get(selected) : undefined;
  const charType = templates.find((t) => t.name === 'Character')?.id ?? templates[0]?.id;

  return (
    <div className="graph-page tree-page">
      <div className="graph-controls card">
        <h2>
          <GitFork size={18} /> Family trees
        </h2>
        <p className="muted small">Built from relationships: parent of, child of, spouse of, sibling of. Click a person to select, double-click to open.</p>
        <div className="field">
          <span>Centre on</span>
          <ArticlePicker value={root} onChange={(id) => id && setParams({ root: id })} placeholder="Choose a person" />
        </div>
        {candidates.length > 0 && (
          <div className="field">
            <span>Families</span>
            <div className="chips">
              {candidates.slice(0, 8).map((a) => (
                <button key={a.id} className={`chip ${a.id === root ? 'chip-on' : ''}`} onClick={() => setParams({ root: a.id })}>
                  {a.title}
                </button>
              ))}
            </div>
          </div>
        )}
        {sel && !playerView && <AddRelative person={sel} charType={charType} onAdded={(id) => setSelected(id)} />}
        <button className="btn sm" onClick={fit}><Maximize size={13} /> Fit</button>
        {truncated && <p className="muted small">Showing the closest 160 relatives.</p>}
      </div>

      {!root ? (
        <div className="empty-state grow">
          <div className="empty-icon"><GitFork size={26} /></div>
          No families yet.
          <span className="small">Open a character, add a relationship like “parent of” or “spouse of”, or pick anyone to start a tree:</span>
          <div style={{ width: 280 }}>
            <ArticlePicker value={null} onChange={(id) => id && (setParams({ root: id }), setSelected(id))} placeholder="Start with…" />
          </div>
        </div>
      ) : (
        <svg
          ref={svgRef}
          className="graph family"
          onPointerDown={(e) => {
            const node = (e.target as Element).closest('[data-node]')?.getAttribute('data-node') ?? undefined;
            drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false, node };
            try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
            if (d.moved) setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
          }}
          onPointerUp={() => {
            const d = drag.current;
            drag.current = null;
            if (d && !d.moved) setSelected(d.node ?? null);
          }}
          onDoubleClick={(e) => {
            const node = (e.target as Element).closest('[data-node]')?.getAttribute('data-node');
            if (node) navigate(`/w/${world.id}/a/${node}`);
          }}
        >
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {spousePairs.map(([a, b]) => {
              const p = pos.get(a)!, q = pos.get(b)!;
              const [l, r] = p.x < q.x ? [p, q] : [q, p];
              const y = l.y + CARD_H / 2;
              return (
                <g key={`${a}-${b}`} className="kin spouse">
                  <line x1={l.x + CARD_W} y1={y} x2={r.x} y2={r.y + CARD_H / 2} />
                  <g transform={`translate(${(l.x + CARD_W + r.x) / 2},${y})`}>
                    <circle r="9" className="heart-bg" />
                    <Heart size={11} x={-5.5} y={-5.5} className="heart" />
                  </g>
                </g>
              );
            })}
            {[...unions.values()].map((u) => {
              const ps = u.parents.map((p) => pos.get(p)!);
              const top = Math.max(...ps.map((p) => p.y)) + CARD_H;
              const sx = ps.reduce((s, p) => s + p.x + CARD_W / 2, 0) / ps.length;
              const startY = ps.length > 1 && ps.every((p) => p.y === ps[0].y) ? ps[0].y + CARD_H / 2 : top;
              const kids = u.kids.map((k) => pos.get(k)!);
              const barY = Math.min(...kids.map((k) => k.y)) - GAP_Y / 2;
              const xs = [sx, ...kids.map((k) => k.x + CARD_W / 2)];
              return (
                <g key={u.parents.join('|')} className="kin descent">
                  <path d={`M${sx},${startY} V${barY} M${Math.min(...xs)},${barY} H${Math.max(...xs)} ${kids.map((k) => `M${k.x + CARD_W / 2},${barY} V${k.y}`).join(' ')}`} />
                </g>
              );
            })}
            {nodes.map((n, i) => {
              const a = index.byId.get(n.id) as Article | undefined;
              if (!a) return null;
              const t = templateById.get(a.templateId);
              const born = a.fields.born?.replace(/\[\[|\]\]/g, '');
              const died = a.fields.died?.replace(/\[\[|\]\]/g, '');
              const dates = born || died ? `${born || '?'} – ${died || ''}` : a.fields.title_epithet || t?.name || '';
              return (
                <g
                  key={n.id}
                  data-node={n.id}
                  className={`person ${n.id === root ? 'root' : ''} ${n.id === selected ? 'sel' : ''}`}
                  transform={`translate(${n.x},${n.y})`}
                  style={{ ['--tc' as string]: t?.color ?? '#999', animationDelay: `${Math.min(i, 24) * 35}ms` }}
                >
                  <rect width={CARD_W} height={CARD_H} rx="12" />
                  <rect width="4" height={CARD_H - 20} x="0" y="10" rx="2" className="accent-bar" />
                  {a.image ? (
                    <>
                      <clipPath id={`av-${n.id}`}><circle cx="31" cy={CARD_H / 2} r="18" /></clipPath>
                      <image href={a.image} x="13" y={CARD_H / 2 - 18} width="36" height="36" clipPath={`url(#av-${n.id})`} preserveAspectRatio="xMidYMid slice" />
                    </>
                  ) : (
                    <>
                      <circle cx="31" cy={CARD_H / 2} r="18" className="avatar" />
                      <text x="31" y={CARD_H / 2 + 5} textAnchor="middle" className="initial">{a.title.trim().charAt(0).toUpperCase()}</text>
                    </>
                  )}
                  <text x="58" y="27" className="name">{a.title.length > 17 ? a.title.slice(0, 16) + '…' : a.title}</text>
                  <text x="58" y="45" className="dates">{dates.length > 22 ? dates.slice(0, 21) + '…' : dates}</text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

function AddRelative({ person, charType, onAdded }: { person: Article; charType?: string; onAdded: (id: string) => void }) {
  const { world } = useWorld();
  const [kin, setKin] = useState<Kin>('child');
  const [target, setTarget] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const link = async () => {
    let id = target;
    if (!id && newName.trim() && charType) id = (await createArticle(world.id, { title: newName.trim(), templateId: charType, status: 'stub' })).id;
    if (!id || id === person.id) return;
    const rel =
      kin === 'parent' ? { fromId: id, toId: person.id, type: 'parent of' }
      : kin === 'child' ? { fromId: person.id, toId: id, type: 'parent of' }
      : kin === 'spouse' ? { fromId: person.id, toId: id, type: 'spouse of' }
      : { fromId: person.id, toId: id, type: 'sibling of' };
    await db.relations.add({ id: uid(), worldId: world.id, ...rel });
    await touch(world.id);
    setTarget(null);
    setNewName('');
    onAdded(person.id);
  };

  return (
    <div className="add-relative">
      <div className="sub" style={{ marginTop: 6 }}>
        <UserPlus size={13} /> Add to {person.title}
      </div>
      <div className="seg wrap">
        {(['parent', 'child', 'spouse', 'sibling'] as Kin[]).map((k) => (
          <button key={k} className={kin === k ? 'on' : ''} onClick={() => setKin(k)}>
            {k}
          </button>
        ))}
      </div>
      <ArticlePicker value={target} onChange={setTarget} exclude={person.id} placeholder="Existing article…" />
      <div className="muted small center" style={{ margin: '4px 0' }}>or</div>
      <input className="input sm" placeholder="New character's name" value={newName} disabled={!!target} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && link()} />
      <button className="btn sm primary" style={{ marginTop: 8, width: '100%' }} disabled={!target && !newName.trim()} onClick={link}>
        Add {kin}
      </button>
    </div>
  );
}
