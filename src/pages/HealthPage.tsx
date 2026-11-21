import { Link } from 'react-router';
import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Copy, FilePlus, Link2Off, Lock, Sprout, Unlink } from 'lucide-react';
import { findClashes, type NameEntry } from '../lib/names';
import { isSection } from '../templates';
import { useWorld } from '../lib/world';
import { useCreateArticle } from '../lib/actions';
import { articleText, extractTargets, originalCasing } from '../lib/links';
import { hasSecrets, stripSecrets } from '../lib/markdown';
import type { Article } from '../db';

export function HealthPage() {
  const { world, allArticles, index, relations, templateById, maps } = useWorld();
  const create = useCreateArticle();
  const base = `/w/${world.id}`;

  // group broken links by target
  const broken = new Map<string, { label: string; from: Article[] }>();
  for (const b of index.broken) {
    const e = broken.get(b.target) ?? { label: originalCasing(articleText(b.from), b.target), from: [] };
    e.from.push(b.from);
    broken.set(b.target, e);
  }
  const brokenList = [...broken.values()].sort((a, b) => b.from.length - a.from.length);

  const related = new Set(relations.flatMap((r) => [r.fromId, r.toId]));
  const orphans = allArticles.filter(
    (a) => !(index.incoming.get(a.id)?.size) && !a.parentId && !related.has(a.id) && !(index.children.get(a.id)?.length) && !a.pinned,
  );
  const textLength = (a: Article) => a.body.trim().length + Object.values(a.fields).reduce((n, v) => n + v.trim().length, 0);
  const stubs = allArticles.filter((a) => a.status === 'stub' || textLength(a) < 120);
  const emptyFacts = allArticles.filter((a) => {
    const fields = (templateById.get(a.templateId)?.fields ?? []).filter((f) => !isSection(f));
    if (fields.length < 3) return false;
    const filled = fields.filter((f) => a.fields[f.key]?.trim()).length;
    return filled / fields.length < 0.3;
  });
  // public articles that link to GM-only ones outside a :::secret block (the link text still names the secret)
  const leaks = allArticles
    .filter((a) => !a.gmOnly)
    .flatMap((a) => {
      const seen = new Set<string>();
      return extractTargets(stripSecrets(articleText(a)))
        .map((t) => index.resolve(t))
        .filter((t): t is Article => !!t && t.gmOnly && !seen.has(t.id) && !!seen.add(t.id))
        .map((t) => ({ from: a, to: t }));
    });
  const withSecrets = allArticles.filter((a) => hasSecrets(a.body)).length;

  // invented names that are identical or easy to confuse
  const clashes = useMemo(() => {
    const entries: NameEntry[] = [
      ...allArticles.flatMap((a) =>
        [a.title, ...a.aliases].filter((n) => n.trim() && n !== 'Untitled').map((name) => ({ name, kind: templateById.get(a.templateId)?.name ?? 'article', owner: a.id, link: `${base}/a/${a.id}` })),
      ),
      ...maps.flatMap((m) => [
        { name: m.name, kind: 'map', owner: `map:${m.id}`, link: `${base}/maps/${m.id}` },
        ...m.pins.map((p) => ({ name: p.label, kind: `pin on ${m.name}`, owner: p.articleId ?? `pin:${p.id}`, link: `${base}/maps/${m.id}?pin=${p.id}` })),
        ...(m.regions ?? []).map((r) => ({ name: r.name, kind: `region on ${m.name}`, owner: r.articleId ?? `region:${r.id}`, link: `${base}/maps/${m.id}?region=${r.id}` })),
      ]),
    ].filter((e) => e.name && e.name !== 'New pin' && e.name !== 'New region');
    return findClashes(entries);
  }, [allArticles, maps, templateById, base]);

  const total = allArticles.length || 1;
  const score = Math.round(
    100 * (1 - (0.4 * stubs.length) / total - (0.3 * orphans.length) / total - (0.3 * Math.min(1, brokenList.length / total))),
  );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>World health</h1>
          <p className="lead">Loose threads, unwritten places, and secrets that might leak. A to-do list your world writes for you.</p>
        </div>
        <div className="score" style={{ ['--p' as string]: `${Math.max(0, score)}%` }}>
          <b>{Math.max(0, score)}</b>
          <span>health</span>
        </div>
      </header>

      <div className="health-grid stagger">
        <Panel icon={<Copy size={16} />} title="Name clashes" count={clashes.length} hint="Names that are the same, or close enough to confuse readers (and you, later). Rename one, or ignore it if they're meant to be related.">
          {clashes.map((c, i) => (
            <div key={i} className="health-row clash-row">
              <span className={`clash-kind ${c.reason}`}>{c.reason === 'same' ? 'Same' : 'Similar'}</span>
              <Link to={c.a.link!}>{c.a.name}</Link>
              <span className="muted small">{c.a.kind}</span>
              <span className="muted">·</span>
              <Link to={c.b.link!}>{c.b.name}</Link>
              <span className="muted small">{c.b.kind}</span>
            </div>
          ))}
        </Panel>
        <Panel icon={<Link2Off size={16} />} title="Unwritten links" count={brokenList.length} hint="Things you mentioned but haven't written yet.">
          {brokenList.map((b) => (
            <div key={b.label} className="health-row">
              <button className="btn sm" onClick={() => create(b.label)}>
                <FilePlus size={13} /> Create
              </button>
              <b>{b.label}</b>
              <span className="muted small ellipsis">
                in {b.from.slice(0, 3).map((f) => f.title).join(', ')}
                {b.from.length > 3 ? ` +${b.from.length - 3}` : ''}
              </span>
            </div>
          ))}
        </Panel>

        <Panel icon={<Lock size={16} />} title="Possible secret leaks" count={leaks.length} hint="Public articles linking to GM-only ones. Players won't get a link, but they will see the name.">
          {leaks.map((l, i) => (
            <div key={i} className="health-row">
              <AlertTriangle size={14} className="warn" />
              <Link to={`${base}/a/${l.from.id}/edit`}>{l.from.title}</Link>
              <span className="muted small">mentions</span>
              <Link to={`${base}/a/${l.to.id}`}>{l.to.title}</Link>
            </div>
          ))}
          <p className="muted small">{withSecrets} article(s) contain :::secret blocks (hidden in player view automatically).</p>
        </Panel>

        <Panel icon={<Unlink size={16} />} title="Orphans" count={orphans.length} hint="Nothing links here. Connect them, or they'll be forgotten.">
          {orphans.map((a) => (
            <div key={a.id} className="health-row">
              <Link to={`${base}/a/${a.id}`}>{a.title}</Link>
            </div>
          ))}
        </Panel>

        <Panel icon={<Sprout size={16} />} title="Stubs" count={stubs.length} hint="Marked as stub, or under a paragraph long.">
          {stubs.map((a) => (
            <div key={a.id} className="health-row">
              <Link to={`${base}/a/${a.id}/edit`}>{a.title}</Link>
              <span className="muted small">{textLength(a).toLocaleString()} chars</span>
            </div>
          ))}
        </Panel>

        <Panel icon={<AlertTriangle size={16} />} title="Sparse details" count={emptyFacts.length} hint="Less than a third of the sidebar fields are filled in.">
          {emptyFacts.map((a) => (
            <div key={a.id} className="health-row">
              <Link to={`${base}/a/${a.id}/edit`}>{a.title}</Link>
              <span className="muted small">{templateById.get(a.templateId)?.name}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ icon, title, count, hint, children }: { icon: React.ReactNode; title: string; count: number; hint: string; children: React.ReactNode }) {
  return (
    <section className="card health-panel">
      <h2>
        {icon} {title}
        <span className={`count ${count ? 'hot' : ''}`}>{count}</span>
      </h2>
      <p className="muted small">{hint}</p>
      <div className="health-list">
        {count === 0 && (
          <p className="all-clear">
            <CheckCircle2 size={16} /> All clear
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
