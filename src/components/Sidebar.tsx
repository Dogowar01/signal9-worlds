import { useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router';
import {
  ChevronRight, Clock, Eye, EyeOff, HeartPulse, Home, LayoutTemplate, Lightbulb, Lock, Map, Moon,
  Network, Plus, Search, Settings, Star, Sun,
} from 'lucide-react';
import type { Article } from '../db';
import { useWorld } from '../lib/world';
import { usePrefs } from '../lib/prefs';
import { useCreateArticle } from '../lib/actions';
import { TemplateIcon } from '../icons';
import { WorldSigil } from './WorldArt';

export function Sidebar({ onSearch, onNavigate }: { onSearch: () => void; onNavigate: () => void }) {
  const { world, articles, templates, index } = useWorld();
  const { playerView, setPlayerView, theme, setTheme, treeMode, setTreeMode } = usePrefs();
  const create = useCreateArticle();
  const navigate = useNavigate();
  const base = `/w/${world.id}`;
  const pinned = articles.filter((a) => a.pinned).sort((a, b) => a.title.localeCompare(b.title));
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

  const nav = [
    { to: base, icon: Home, label: 'Overview', end: true },
    { to: `${base}/maps`, icon: Map, label: 'Maps' },
    { to: `${base}/timeline`, icon: Clock, label: 'Timeline' },
    { to: `${base}/graph`, icon: Network, label: 'Connections' },
    { to: `${base}/health`, icon: HeartPulse, label: 'World health' },
    { to: `${base}/prompts`, icon: Lightbulb, label: 'Prompts & names' },
    { to: `${base}/templates`, icon: LayoutTemplate, label: 'Article types' },
    { to: `${base}/settings`, icon: Settings, label: 'Settings & export' },
  ];

  return (
    <aside className="sidebar" onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate()}>
      <div className="sidebar-head">
        <button className="world-switch" onClick={() => navigate('/')} title="All worlds">
          <WorldSigil seed={world.id} size={30} />
          <span>{world.name}</span>
        </button>
      </div>
      <button className="search-btn" onClick={onSearch}>
        <Search size={15} /> <span>Search or jump…</span>
        <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <nav className="nav">
        {nav.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-item">
            <Icon size={16} /> {label}
          </NavLink>
        ))}
      </nav>

      <div className="mode-row">
        <button
          className={`chip ${playerView ? 'chip-on' : ''}`}
          onClick={() => setPlayerView(!playerView)}
          title="Player view hides GM-only articles, pins, events and :::secret blocks"
        >
          {playerView ? <Eye size={14} /> : <EyeOff size={14} />} {playerView ? 'Player view' : 'GM view'}
        </button>
        <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {pinned.length > 0 && (
        <div className="tree-section">
          <div className="tree-title"><Star size={12} /> Pinned</div>
          {pinned.map((a) => (
            <ArticleLink key={a.id} a={a} />
          ))}
        </div>
      )}

      <div className="tree-section grow">
        <div className="tree-title">
          <span>Articles ({articles.length})</span>
          <span className="seg">
            <button className={treeMode === 'type' ? 'on' : ''} onClick={() => setTreeMode('type')}>Type</button>
            <button className={treeMode === 'tree' ? 'on' : ''} onClick={() => setTreeMode('tree')}>Tree</button>
          </span>
          <button className="icon-btn sm" onClick={() => create()} title="New article" aria-label="New article">
            <Plus size={15} />
          </button>
        </div>
        {treeMode === 'type'
          ? templates.map((t) => {
              const list = articles.filter((a) => a.templateId === t.id).sort((a, b) => a.title.localeCompare(b.title));
              if (!list.length) return null;
              return (
                <Group key={t.id} label={t.name} icon={t.icon} color={t.color} count={list.length} onAdd={() => create('Untitled', t.id)}>
                  {list.map((a) => (
                    <ArticleLink key={a.id} a={a} />
                  ))}
                </Group>
              );
            })
          : articles
              .filter((a) => !a.parentId || !index.byId.has(a.parentId) || (playerView && index.byId.get(a.parentId)?.gmOnly))
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((a) => <TreeNode key={a.id} a={a} depth={0} />)}
        {articles.length === 0 && (
          <p className="muted small pad">
            No articles yet. Press <b>+</b> or type a name in search.
          </p>
        )}
      </div>
    </aside>
  );
}

function Group({ label, icon, color, count, onAdd, children }: { label: string; icon: string; color: string; count: number; onAdd: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="group">
      <div className="group-head">
        <button className="group-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <ChevronRight size={13} className={`chev ${open ? 'open' : ''}`} />
          <TemplateIcon name={icon} size={13} color={color} />
          {label} <span className="muted">{count}</span>
        </button>
        <button className="icon-btn sm ghost" onClick={onAdd} title={`New ${label}`} aria-label={`New ${label}`}>
          <Plus size={13} />
        </button>
      </div>
      <div className={`group-body ${open ? 'open' : ''}`}>
        <div>{children}</div>
      </div>
    </div>
  );
}

function TreeNode({ a, depth }: { a: Article; depth: number }) {
  const { index } = useWorld();
  const { playerView } = usePrefs();
  const kids = (index.children.get(a.id) ?? []).filter((c) => !(playerView && c.gmOnly));
  const [open, setOpen] = useState(depth < 1);
  return (
    <div>
      <div className="tree-row" style={{ paddingLeft: depth * 12 }}>
        {kids.length ? (
          <button className="twisty" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse' : 'Expand'}>
            <ChevronRight size={12} className={`chev ${open ? 'open' : ''}`} />
          </button>
        ) : (
          <span className="twisty" />
        )}
        <ArticleLink a={a} />
      </div>
      {open && kids.map((k) => <TreeNode key={k.id} a={k} depth={depth + 1} />)}
    </div>
  );
}

function ArticleLink({ a }: { a: Article }) {
  const { world, templateById } = useWorld();
  const { articleId } = useParams();
  const t = templateById.get(a.templateId);
  return (
    <NavLink to={`/w/${world.id}/a/${a.id}`} className={`tree-item ${articleId === a.id ? 'active' : ''}`}>
      <TemplateIcon name={t?.icon} size={13} color={t?.color} />
      <span className="ellipsis">{a.title || 'Untitled'}</span>
      {a.gmOnly && <Lock size={11} className="muted" />}
      {a.status === 'stub' && <span className="dot" title="Stub" />}
    </NavLink>
  );
}
