import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useWorld } from '../lib/world';
import { searchArticles } from '../lib/search';
import { TemplateIcon } from '../icons';

interface Props {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  exclude?: string | string[];
  placeholder?: string;
}

/** A searchable article selector (type to filter, click to pick). */
export function ArticlePicker({ value, onChange, exclude, placeholder = 'None' }: Props) {
  const { allArticles, index, templateById } = useWorld();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const ex = new Set(Array.isArray(exclude) ? exclude : exclude ? [exclude] : []);
  const current = value ? index.byId.get(value) : undefined;

  const pool = allArticles.filter((a) => !ex.has(a.id));
  const results = q.trim() ? searchArticles(pool, q, 12).map((h) => h.article) : [...pool].sort((a, b) => a.title.localeCompare(b.title)).slice(0, 12);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (id: string | null) => {
    onChange(id);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="picker" ref={ref}>
      {current && !open ? (
        <div className="picker-value input sm" onClick={() => setOpen(true)}>
          <TemplateIcon name={templateById.get(current.templateId)?.icon} size={12} color={templateById.get(current.templateId)?.color} />
          <span className="ellipsis grow">{current.title}</span>
          <button
            type="button"
            className="icon-btn sm ghost"
            onClick={(e) => {
              e.stopPropagation();
              pick(null);
            }}
            aria-label="Clear"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <input
          className="input sm"
          value={q}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(results.length - 1, s + 1)));
            else if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
            else if (e.key === 'Enter') {
              e.preventDefault();
              if (results[sel]) pick(results[sel].id);
            } else if (e.key === 'Escape') setOpen(false);
          }}
          autoFocus={open && !!current}
        />
      )}
      {open && (
        <div className="picker-menu">
          {results.map((a, i) => {
            const t = templateById.get(a.templateId);
            return (
              <button type="button" key={a.id} className={`palette-item ${i === sel ? 'sel' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(a.id)}>
                <TemplateIcon name={t?.icon} size={13} color={t?.color} />
                <span className="ellipsis">{a.title}</span>
              </button>
            );
          })}
          {results.length === 0 && <p className="muted small pad">No matches</p>}
        </div>
      )}
    </div>
  );
}
