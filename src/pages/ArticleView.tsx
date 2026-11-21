import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, Ghost, History, Lock, MapPin, Network, PenLine, Pencil, Pentagon, Plus, Star, Trash2, X } from 'lucide-react';
import { db, snapshotArticle, uid, updateArticle, type Article } from '../db';
import { trashArticle } from '../lib/trash';
import { showUndo } from '../lib/undo';
import { compareEvents, formatShortDate, getCalendar } from '../lib/calendar';
import { extractTargets, stripLinks } from '../lib/links';
import { useWorld } from '../lib/world';
import { usePrefs } from '../lib/prefs';
import { timeAgo, useCreateArticle } from '../lib/actions';
import { RELATION_TYPES } from '../templates';
import { Markdown } from '../components/Markdown';
import { ArticlePicker } from '../components/ArticlePicker';
import { TemplateIcon } from '../icons';

export function ArticleView() {
  const { articleId = '' } = useParams();
  const { world, index, templateById, relations } = useWorld();
  const { playerView } = usePrefs();
  const navigate = useNavigate();
  const create = useCreateArticle();
  const [showHistory, setShowHistory] = useState(false);
  const a = index.byId.get(articleId);
  const { maps, events: allEvents } = useWorld();
  const events = allEvents.filter((e) => e.articleId === articleId).sort(compareEvents(getCalendar(world)));
  const scenes = useLiveQuery(() => db.scenes.where('worldId').equals(world.id).toArray(), [world.id]) ?? [];
  const manuscripts = useLiveQuery(() => db.manuscripts.where('worldId').equals(world.id).toArray(), [world.id]) ?? [];

  if (!a)
    return (
      <div className="empty-state">
        <div className="empty-icon"><Ghost size={28} /></div>
        This article was deleted or never existed.
      </div>
    );
  if (playerView && a.gmOnly)
    return (
      <div className="empty-state">
        <div className="empty-icon"><Lock size={26} /></div>
        This article is GM-only and hidden in player view.
      </div>
    );

  const base = `/w/${world.id}`;
  const t = templateById.get(a.templateId);
  const visible = (x?: Article) => !!x && !(playerView && x.gmOnly);

  const crumbs: Article[] = [];
  for (let p = a.parentId ? index.byId.get(a.parentId) : undefined; p && crumbs.length < 10; p = p.parentId ? index.byId.get(p.parentId) : undefined) {
    crumbs.unshift(p);
  }
  const facts = (t?.fields ?? []).filter((f) => a.fields[f.key]?.trim());
  const backlinks = [...(index.incoming.get(a.id) ?? [])].map((id) => index.byId.get(id)!).filter(visible).sort((x, y) => x.title.localeCompare(y.title));
  const children = (index.children.get(a.id) ?? []).filter(visible);
  const relOut = relations.filter((r) => r.fromId === a.id && visible(index.byId.get(r.toId)));
  const relIn = relations.filter((r) => r.toId === a.id && visible(index.byId.get(r.fromId)));
  const onMaps = maps.flatMap((m) => m.pins.filter((p) => p.articleId === a.id && !(playerView && p.gmOnly)).map((p) => ({ m, p })));
  const inRegions = maps.flatMap((m) => (m.regions ?? []).filter((r) => r.articleId === a.id && !(playerView && r.gmOnly)).map((r) => ({ m, r })));
  const myEvents = events.filter((e) => !(playerView && e.gmOnly));
  const names = new Set([a.title, ...a.aliases].map((n) => n.trim().toLowerCase()));
  const inScenes = playerView
    ? []
    : scenes.filter((s) => s.kind === 'scene' && (s.povId === a.id || s.locationId === a.id || extractTargets(`${s.body}\n${s.synopsis}`).some((t) => names.has(t))));

  return (
    <div className="page article">
      {crumbs.length > 0 && (
        <nav className="crumbs">
          {crumbs.filter(visible).map((c) => (
            <span key={c.id}>
              <Link to={`${base}/a/${c.id}`}>{c.title}</Link> ›{' '}
            </span>
          ))}
        </nav>
      )}
      <header className="article-head">
        <div className="grow">
          <div className="type-label">
            <span className="type-label type-pill" style={{ color: t?.color }}>
              <TemplateIcon name={t?.icon} size={13} /> {t?.name ?? 'Article'}
            </span>
            <span className={`status status-${a.status}`}>{a.status === 'done' ? 'finished' : a.status}</span>
            {a.gmOnly && (
              <span className="badge gm">
                <Lock size={11} /> GM only
              </span>
            )}
          </div>
          <h1>{a.title || 'Untitled'}</h1>
          {a.aliases.length > 0 && <p className="muted aliases">Also known as {a.aliases.join(', ')}</p>}
        </div>
        <div className="row actions">
          <button className={`icon-btn ${a.pinned ? 'accent' : ''}`} title={a.pinned ? 'Unpin' : 'Pin to sidebar'} onClick={() => updateArticle(a.id, { pinned: !a.pinned })}>
            <Star size={17} fill={a.pinned ? 'currentColor' : 'none'} />
          </button>
          <Link className="icon-btn" title="Show in connections graph" to={`${base}/graph?focus=${a.id}`}>
            <Network size={17} />
          </Link>
          <button className="icon-btn" title="Version history" onClick={() => setShowHistory(true)}>
            <History size={17} />
          </button>
          <button
            className="icon-btn danger"
            title="Delete article"
            onClick={async () => {
              const tid = await trashArticle(a.id);
              navigate(base);
              showUndo(a.title, tid);
            }}
          >
            <Trash2 size={17} />
          </button>
          <Link className="btn primary" to={`${base}/a/${a.id}/edit`}>
            <Pencil size={15} /> Edit
          </Link>
        </div>
      </header>
      <div className="ornament" aria-hidden>
        <span>✦</span>
      </div>

      <div className="article-cols">
        <div className="article-main">
          {a.summary && <Markdown source={a.summary} className="lead" />}
          {a.body.trim() ? (
            <Markdown source={a.body} className="article-body" />
          ) : (
            <p className="muted">
              Nothing written yet. <Link to={`${base}/a/${a.id}/edit`}>Start writing</Link>.
            </p>
          )}

          {(backlinks.length > 0 || children.length > 0) && (
            <section className="backlinks">
              {children.length > 0 && (
                <>
                  <h3>Inside {a.title}</h3>
                  <div className="chips">
                    {children.map((c) => (
                      <ArticleChip key={c.id} a={c} />
                    ))}
                  </div>
                </>
              )}
              {backlinks.length > 0 && (
                <>
                  <h3>Mentioned in</h3>
                  <div className="chips">
                    {backlinks.map((b) => (
                      <ArticleChip key={b.id} a={b} />
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        <aside className="infobox" style={{ ['--tc' as string]: t?.color }}>
          {a.image && <img className="infobox-img" src={a.image} alt={a.title} />}
          <div className="infobox-title">{a.title}</div>
          {facts.length > 0 && (
            <dl>
              {facts.map((f) => (
                <div key={f.key} className="fact">
                  <dt>{f.label}</dt>
                  <dd>
                    <Markdown source={a.fields[f.key]} inline />
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {a.tags.length > 0 && (
            <div className="chips tags">
              {a.tags.map((tag) => (
                <span key={tag} className="tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <Relations article={a} relOut={relOut} relIn={relIn} />

          {onMaps.length + inRegions.length > 0 && (
            <div className="info-section">
              <h4>
                <MapPin size={13} /> On maps
              </h4>
              {onMaps.map(({ m, p }) => (
                <Link key={p.id} className="list-link" to={`${base}/maps/${m.id}?pin=${p.id}`}>
                  <MapPin size={12} color={p.color} /> {m.name} · {p.label}
                </Link>
              ))}
              {inRegions.map(({ m, r }) => (
                <Link key={r.id} className="list-link" to={`${base}/maps/${m.id}?region=${r.id}`}>
                  <Pentagon size={12} color={r.color} /> {m.name} · {r.name}
                </Link>
              ))}
            </div>
          )}
          {inScenes.length > 0 && (
            <div className="info-section">
              <h4>
                <PenLine size={13} /> In your manuscripts
              </h4>
              {inScenes.slice(0, 8).map((s) => (
                <Link key={s.id} className="list-link" to={`${base}/write/${s.manuscriptId}?scene=${s.id}`}>
                  <span className="ellipsis grow">{s.title || 'Untitled scene'}</span>
                  <span className="muted small ellipsis">{manuscripts.find((m) => m.id === s.manuscriptId)?.title}</span>
                </Link>
              ))}
            </div>
          )}
          {myEvents.length > 0 && (
            <div className="info-section">
              <h4>
                <Clock size={13} /> Timeline
              </h4>
              {myEvents.map((e) => (
                <Link key={e.id} className="list-link" to={`${base}/timeline#ev-${e.id}`}>
                  <b>{formatShortDate(world, e)}</b> {stripLinks(e.title)}
                </Link>
              ))}
            </div>
          )}
          <p className="muted small">
            Edited {timeAgo(a.updatedAt)} ·{' '}
            <button className="linklike" onClick={() => create('Untitled', undefined, { parentId: a.id })}>
              + child article
            </button>
          </p>
        </aside>
      </div>
      {showHistory && <HistoryDrawer article={a} onClose={() => setShowHistory(false)} />}
    </div>
  );
}

export function ArticleChip({ a }: { a: Article }) {
  const { world, templateById } = useWorld();
  const t = templateById.get(a.templateId);
  return (
    <Link to={`/w/${world.id}/a/${a.id}`} className="chip">
      <TemplateIcon name={t?.icon} size={12} color={t?.color} /> {a.title}
    </Link>
  );
}

function Relations({ article, relOut, relIn }: { article: Article; relOut: { id: string; type: string; toId: string }[]; relIn: { id: string; type: string; fromId: string }[] }) {
  const { world, index } = useWorld();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('ally of');
  const [target, setTarget] = useState<string | null>(null);
  const base = `/w/${world.id}`;

  return (
    <div className="info-section">
      <h4>
        Relationships
        <button className="icon-btn sm ghost" onClick={() => setAdding(!adding)} title="Add relationship" aria-label="Add relationship">
          {adding ? <X size={13} /> : <Plus size={13} />}
        </button>
      </h4>
      {adding && (
        <form
          className="rel-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!target || !type.trim()) return;
            await db.relations.add({ id: uid(), worldId: world.id, fromId: article.id, toId: target, type: type.trim() });
            await db.worlds.update(world.id, { updatedAt: Date.now() });
            setTarget(null);
            setAdding(false);
          }}
        >
          <span className="small muted">{article.title}</span>
          <input className="input sm" list="rel-types" value={type} onChange={(e) => setType(e.target.value)} />
          <datalist id="rel-types">
            {RELATION_TYPES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <ArticlePicker value={target} onChange={setTarget} exclude={article.id} placeholder="Pick an article…" />
          <button className="btn sm primary" disabled={!target}>
            Add
          </button>
        </form>
      )}
      {relOut.length + relIn.length === 0 && !adding && <p className="muted small">None yet.</p>}
      {relOut.map((r) => (
        <div key={r.id} className="rel">
          <span className="muted">{r.type}</span> <Link to={`${base}/a/${r.toId}`}>{index.byId.get(r.toId)?.title}</Link>
          <button className="icon-btn sm ghost" onClick={() => db.relations.delete(r.id)} aria-label="Remove relationship">
            <X size={12} />
          </button>
        </div>
      ))}
      {relIn.map((r) => (
        <div key={r.id} className="rel">
          <Link to={`${base}/a/${r.fromId}`}>{index.byId.get(r.fromId)?.title}</Link> <span className="muted">{r.type} this</span>
          <button className="icon-btn sm ghost" onClick={() => db.relations.delete(r.id)} aria-label="Remove relationship">
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function HistoryDrawer({ article, onClose }: { article: Article; onClose: () => void }) {
  const snaps = useLiveQuery(() => db.snapshots.where('articleId').equals(article.id).reverse().sortBy('at'), [article.id]) ?? [];
  const [sel, setSel] = useState<string | null>(null);
  const s = snaps.find((x) => x.id === sel);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <header className="row">
          <h2 className="grow">Version history</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <p className="muted small">A version is saved each time you start an editing session (the newest 30 are kept).</p>
        {snaps.length === 0 && <p className="muted">No earlier versions yet.</p>}
        <div className="history">
          <ul className="plain-list">
            {snaps.map((x) => (
              <li key={x.id}>
                <button className={`list-link ${sel === x.id ? 'active' : ''}`} onClick={() => setSel(x.id)}>
                  {new Date(x.at).toLocaleString()} <span className="muted small">{x.body.length} chars</span>
                </button>
              </li>
            ))}
          </ul>
          {s && (
            <div className="history-preview">
              <div className="row">
                <b className="grow">{s.title}</b>
                <button
                  className="btn sm primary"
                  onClick={async () => {
                    if (!confirm('Restore this version? The current text will be saved as a version first.')) return;
                    await snapshotArticle(article);
                    await updateArticle(article.id, { title: s.title, body: s.body, fields: s.fields });
                    onClose();
                  }}
                >
                  Restore
                </button>
              </div>
              <pre className="snapshot-text">{s.body}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
