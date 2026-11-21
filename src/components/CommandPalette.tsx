import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Clock, Eye, FilePlus, GitFork, HeartPulse, Lightbulb, Map, Network, NotebookPen, Search, Settings, Trash2 } from 'lucide-react';
import { useWorld } from '../lib/world';
import { usePrefs } from '../lib/prefs';
import { searchArticles } from '../lib/search';
import { useCreateArticle } from '../lib/actions';
import { TemplateIcon } from '../icons';

interface Item {
  key: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { world, articles, templates, templateById } = useWorld();
  const { playerView, setPlayerView } = usePrefs();
  const navigate = useNavigate();
  const create = useCreateArticle();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const items = useMemo<Item[]>(() => {
    const go = (path: string) => () => (navigate(`/w/${world.id}${path}`), onClose());
    const commands: Item[] = [
      { key: 'c-maps', label: 'Go to Maps', icon: <Map size={15} />, run: go('/maps') },
      { key: 'c-time', label: 'Go to Timeline', icon: <Clock size={15} />, run: go('/timeline') },
      { key: 'c-graph', label: 'Go to Connections graph', icon: <Network size={15} />, run: go('/graph') },
      { key: 'c-family', label: 'Go to Family trees', icon: <GitFork size={15} />, run: go('/family') },
      { key: 'c-write', label: 'Go to Manuscripts', icon: <NotebookPen size={15} />, run: go('/write') },
      { key: 'c-trash', label: 'Go to Trash', icon: <Trash2 size={15} />, run: go('/trash') },
      { key: 'c-health', label: 'Go to World health', icon: <HeartPulse size={15} />, run: go('/health') },
      { key: 'c-prompts', label: 'Go to Prompts & names', icon: <Lightbulb size={15} />, run: go('/prompts') },
      { key: 'c-settings', label: 'Go to Settings & export', icon: <Settings size={15} />, run: go('/settings') },
      { key: 'c-pv', label: playerView ? 'Switch to GM view' : 'Switch to Player view', icon: <Eye size={15} />, run: () => (setPlayerView(!playerView), onClose()) },
    ];
    const query = q.trim();
    if (!query) {
      const recent = [...articles].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
      return [
        ...recent.map((a) => articleItem(a.id, a.title, 'Recent')),
        ...commands,
      ];
    }
    const hits = searchArticles(articles, query, 20).map((h) => articleItem(h.article.id, h.article.title, h.snippet));
    const exact = articles.some((a) => a.title.toLowerCase() === query.toLowerCase());
    const creates: Item[] = exact
      ? []
      : [
          { key: 'new', label: `Create “${query}”`, hint: 'New note', icon: <FilePlus size={15} />, run: () => (create(query), onClose()) },
          ...templates
            .filter((t) => t.name !== 'Note')
            .slice(0, 6)
            .map((t) => ({
              key: `new-${t.id}`,
              label: `Create “${query}” as ${t.name}`,
              icon: <TemplateIcon name={t.icon} size={15} color={t.color} />,
              run: () => (create(query, t.id), onClose()),
            })),
        ];
    const cmdHits = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
    return [...hits, ...cmdHits, ...creates];

    function articleItem(id: string, title: string, hint?: string): Item {
      const a = articles.find((x) => x.id === id)!;
      const t = templateById.get(a.templateId);
      return {
        key: id,
        label: title || 'Untitled',
        hint,
        icon: <TemplateIcon name={t?.icon} size={15} color={t?.color} />,
        run: () => (navigate(`/w/${world.id}/a/${id}`), onClose()),
      };
    }
  }, [q, articles, templates, templateById, world.id, playerView]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <div className="palette-search">
        <Search size={18} />
        <input
          ref={inputRef}
          value={q}
          placeholder="Search articles, run a command, or type a new name…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(items.length - 1, s + 1)));
            else if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
            else if (e.key === 'Enter') items[sel]?.run();
          }}
        />
        <kbd>Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {items.map((it, i) => (
            <button key={it.key} className={`palette-item ${i === sel ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={it.run}>
              {it.icon}
              <span className="ellipsis">{it.label}</span>
              {it.hint && <span className="hint ellipsis">{it.hint}</span>}
            </button>
          ))}
          {items.length === 0 && <p className="muted pad">Nothing found.</p>}
        </div>
        <div className="palette-foot muted small">
          <span><kbd>↑</kbd> <kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
