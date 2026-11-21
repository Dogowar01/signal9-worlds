import { useEffect, useState } from 'react';
import { ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import type { Article, Template, TemplateField } from '../db';
import { isSection, parseTable } from '../templates';
import { usePrefs } from '../lib/prefs';
import { Markdown } from './Markdown';
import { CanonBadge, canonShown } from './Canon';

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';

/** Group section fields under their headings, keeping template order. */
export function groupSections(fields: TemplateField[]) {
  const groups: { name: string; fields: TemplateField[] }[] = [];
  for (const fl of fields.filter(isSection)) {
    const name = fl.group?.trim() || 'Details';
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, fields: [] }));
    g.fields.push(fl);
  }
  return groups;
}

export function FieldTable({ field, value }: { field: TemplateField; value: string }) {
  const cols = field.columns?.length ? field.columns : ['Column'];
  const rows = parseTable(value, cols.length).filter((r) => r.some((c) => c.trim()));
  if (!rows.length) return null;
  return (
    <div className="table-wrap">
      <table className="field-table">
        <thead>
          <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}><Markdown source={cell} inline /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The long-form parts of an article (detailed types), grouped and collapsible. */
export function ArticleSections({ article, template }: { article: Article; template?: Template }) {
  const { canonLens, playerView } = usePrefs();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = groupSections(template?.fields ?? [])
    .map((g) => ({
      ...g,
      fields: g.fields.filter((fl) => article.fields[fl.key]?.trim() && canonShown(article.fieldCanon?.[fl.key], canonLens, playerView)),
    }))
    .filter((g) => g.fields.length);

  // the table of contents asks us to open a group before scrolling to something inside it
  useEffect(() => {
    const reveal = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const g = groups.find((x) => `grp-${slug(x.name)}` === id || x.fields.some((fl) => `f-${fl.key}` === id));
      if (g) setCollapsed((c) => { const n = new Set(c); n.delete(g.name); return n; });
    };
    window.addEventListener('s9-reveal', reveal);
    return () => window.removeEventListener('s9-reveal', reveal);
  });

  if (!groups.length) return null;
  const allCollapsed = groups.every((g) => collapsed.has(g.name));

  return (
    <div className="article-sections">
      {groups.length > 1 && (
        <div className="sections-bar">
          <button className="linklike small" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.name)))}>
            {allCollapsed ? <ChevronsUpDown size={13} /> : <ChevronsDownUp size={13} />} {allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
          </button>
        </div>
      )}
      {groups.map((g) => {
        const open = !collapsed.has(g.name);
        return (
          <section key={g.name} className="sec-group">
            <h2
              id={`grp-${slug(g.name)}`}
              className="sec-group-head"
              onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(g.name)) n.delete(g.name); else n.add(g.name); return n; })}
            >
              <ChevronRight size={18} className={`chev ${open ? 'open' : ''}`} /> {g.name}
              <span className="sec-count">{g.fields.length}</span>
            </h2>
            <div className={`group-body ${open ? 'open' : ''}`}>
              <div>
                {g.fields.map((fl) => (
                  <div key={fl.key} className="sec-field">
                    <h3 id={`f-${fl.key}`}>
                      {fl.label} {!playerView && <CanonBadge status={article.fieldCanon?.[fl.key]} compact />}
                    </h3>
                    {fl.type === 'table' ? <FieldTable field={fl} value={article.fields[fl.key]} /> : <Markdown source={article.fields[fl.key]} />}
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
