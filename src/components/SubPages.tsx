import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, FilePlus2, FolderTree } from 'lucide-react';
import type { Article } from '../db';
import { useWorld } from '../lib/world';
import { usePrefs } from '../lib/prefs';
import { useCreateArticle } from '../lib/actions';
import { TemplateIcon } from '../icons';
import { CanonBadge } from './Canon';

/** The articles nested inside this one, as a tree, with a quick way to add more. */
export function SubPages({ article }: { article: Article }) {
  const { index, templates, articles } = useWorld();
  const { playerView } = usePrefs();
  const create = useCreateArticle();
  const [name, setName] = useState('');
  const [type, setType] = useState(templates.find((t) => t.name === 'Note')?.id ?? templates[0]?.id);
  const visibleIds = new Set(articles.map((a) => a.id));
  const kids = (index.children.get(article.id) ?? []).filter((c) => visibleIds.has(c.id));
  if (!kids.length && playerView) return null;

  return (
    <section className="subpages card">
      <h3>
        <FolderTree size={15} /> Inside {article.title} {kids.length > 0 && <span className="muted small">· {countAll(article.id, index.children, visibleIds)} pages</span>}
      </h3>
      {kids.length > 0 && (
        <ul className="subtree">
          {kids.map((k) => <Node key={k.id} a={k} depth={0} visibleIds={visibleIds} />)}
        </ul>
      )}
      {!playerView && (
        <form
          className="row subpage-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create(name.trim(), type, { parentId: article.id });
          }}
        >
          <FilePlus2 size={15} className="muted" />
          <input className="input sm grow" placeholder={`New page inside ${article.title}, e.g. “${article.title} Biology”`} value={name} onChange={(e) => setName(e.target.value)} />
          <select className="input sm" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn sm" disabled={!name.trim()}>Add</button>
        </form>
      )}
    </section>
  );
}

function countAll(id: string, children: Map<string, Article[]>, visible: Set<string>): number {
  return (children.get(id) ?? []).filter((c) => visible.has(c.id)).reduce((n, c) => n + 1 + countAll(c.id, children, visible), 0);
}

function Node({ a, depth, visibleIds }: { a: Article; depth: number; visibleIds: Set<string> }) {
  const { world, index, templateById } = useWorld();
  const kids = (index.children.get(a.id) ?? []).filter((c) => visibleIds.has(c.id));
  const [open, setOpen] = useState(depth < 1);
  const t = templateById.get(a.templateId);
  return (
    <li>
      <div className="subtree-row">
        {kids.length ? (
          <button className="twisty" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse' : 'Expand'}>
            <ChevronRight size={13} className={`chev ${open ? 'open' : ''}`} />
          </button>
        ) : (
          <span className="twisty" />
        )}
        <Link to={`/w/${world.id}/a/${a.id}`} className="subtree-link">
          <TemplateIcon name={t?.icon} size={13} color={t?.color} /> {a.title}
        </Link>
        <CanonBadge status={a.canon} compact />
        {kids.length > 0 && <span className="muted small">{kids.length}</span>}
      </div>
      {open && kids.length > 0 && (
        <ul>
          {kids.map((k) => <Node key={k.id} a={k} depth={depth + 1} visibleIds={visibleIds} />)}
        </ul>
      )}
    </li>
  );
}
