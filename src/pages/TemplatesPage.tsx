import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Library, Plus, Trash2 } from 'lucide-react';
import { TEMPLATE_LIBRARY, mergeFields } from '../templates';
import { db, touch, uid, type Template, type TemplateField } from '../db';
import { useWorld } from '../lib/world';
import { ICONS, TemplateIcon } from '../icons';

const COLORS = ['#e0a458', '#6fb38a', '#7f9fe0', '#c58fd6', '#d98b7a', '#e5c86a', '#5fc4c4', '#e07a6f', '#9a8cf0', '#8fbf6a', '#c9a66b', '#a3a3a3', '#f0a05a', '#6ab0de'];

type Kind = 'fact' | 'factPara' | 'section' | 'table';
const kindOf = (f: TemplateField): Kind => (f.type === 'table' ? 'table' : f.placement === 'section' ? 'section' : f.type === 'textarea' ? 'factPara' : 'fact');
const fromKind = (k: Kind, f: TemplateField): Pick<TemplateField, 'type'> & Partial<TemplateField> =>
  k === 'fact' ? { type: 'text', placement: undefined }
  : k === 'factPara' ? { type: 'textarea', placement: undefined }
  : k === 'section' ? { type: 'textarea', placement: 'section', group: f.group }
  : { type: 'table', placement: 'section', group: f.group, columns: f.columns?.length ? f.columns : ['Name', 'Details'] };

const keyOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || uid().slice(0, 6);

export function TemplatesPage() {
  const { world, templates, allArticles } = useWorld();
  const [selId, setSelId] = useState<string | undefined>(templates[0]?.id);
  const [showLib, setShowLib] = useState(false);
  const sel = templates.find((t) => t.id === selId) ?? templates[0];

  const save = async (t: Template, patch: Partial<Template>) => {
    await db.templates.update(t.id, patch);
    await touch(world.id);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Article types</h1>
          <p className="lead">Every type is yours to change: rename it, recolor it, add facts, sections and tables. Existing text is never lost.</p>
        </div>
        <div className="row">
        <button className={`btn ${showLib ? 'on' : ''}`} onClick={() => setShowLib(!showLib)}>
          <Library size={16} /> Detailed types
        </button>
        <button
          className="btn primary"
          onClick={async () => {
            const id = uid();
            await db.templates.add({ id, worldId: world.id, name: 'New type', icon: 'Book', color: COLORS[templates.length % COLORS.length], fields: [], order: templates.length });
            setSelId(id);
          }}
        >
          <Plus size={16} /> New type
        </button>
        </div>
      </header>
      {showLib && (
        <section className="card tpl-library">
          <h2><Library size={16} /> Detailed types</h2>
          <p className="muted small">
            Deep, sectioned versions of the core types, each section with a guiding question. Adding one that you already have only <b>adds the missing fields</b>; your existing fields, names and article text stay exactly as they are.
          </p>
          <div className="lib-grid">
            {TEMPLATE_LIBRARY.map((lib) => {
              const existing = templates.find((x) => x.name.toLowerCase() === lib.name.toLowerCase());
              const missing = existing ? lib.fields.filter((fl) => !existing.fields.some((e) => e.key === fl.key)).length : lib.fields.length;
              const groups = [...new Set(lib.fields.map((fl) => fl.group).filter(Boolean))];
              return (
                <div key={lib.name} className="lib-card">
                  <div className="row">
                    <TemplateIcon name={lib.icon} size={18} color={lib.color} />
                    <b className="grow">{lib.name}</b>
                    <span className="muted small">{lib.fields.length} fields</span>
                  </div>
                  <p className="muted small">{groups.join(' · ')}</p>
                  {existing && missing === 0 ? (
                    <span className="small ok-text"><Check size={13} /> Up to date</span>
                  ) : (
                    <button
                      className="btn sm"
                      onClick={async () => {
                        if (existing) {
                          await db.templates.update(existing.id, { fields: mergeFields(existing.fields, lib.fields) });
                          setSelId(existing.id);
                        } else {
                          const id = uid();
                          await db.templates.add({ ...structuredClone(lib), id, worldId: world.id, order: templates.length });
                          setSelId(id);
                        }
                        await touch(world.id);
                      }}
                    >
                      {existing ? `Upgrade your ${existing.name} (+${missing})` : `Add ${lib.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      <div className="tpl-layout">
        <ul className="plain-list tpl-list card">
          {templates.map((t) => (
            <li key={t.id}>
              <button className={`list-link ${sel?.id === t.id ? 'active' : ''}`} onClick={() => setSelId(t.id)}>
                <TemplateIcon name={t.icon} size={15} color={t.color} /> <span className="grow ellipsis">{t.name}</span>
                <span className="muted small">{allArticles.filter((a) => a.templateId === t.id).length}</span>
              </button>
            </li>
          ))}
        </ul>
        {sel && <TemplateEditor key={sel.id} t={sel} save={(p) => save(sel, p)} count={allArticles.filter((a) => a.templateId === sel.id).length} others={templates.filter((x) => x.id !== sel.id)} onDeleted={() => setSelId(undefined)} />}
      </div>
    </div>
  );
}

function TemplateEditor({ t, save, count, others, onDeleted }: { t: Template; save: (p: Partial<Template>) => void; count: number; others: Template[]; onDeleted: () => void }) {
  const { world } = useWorld();
  const [name, setName] = useState(t.name);
  const [newField, setNewField] = useState('');
  const [newKind, setNewKind] = useState<Kind>('fact');
  const setFields = (fields: TemplateField[]) => save({ fields });

  return (
    <div className="card tpl-editor">
      <div className="row">
        <label className="field grow">
          <span>Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && save({ name: name.trim() })} />
        </label>
      </div>
      <div className="field">
        <span>Color</span>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} className={`swatch ${t.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => save({ color: c })} aria-label={c} />
          ))}
        </div>
      </div>
      <div className="field">
        <span>Icon</span>
        <div className="icon-grid">
          {Object.keys(ICONS).map((k) => (
            <button key={k} className={`icon-btn ${t.icon === k ? 'on' : ''}`} onClick={() => save({ icon: k })} title={k} aria-label={k}>
              <TemplateIcon name={k} size={16} color={t.icon === k ? t.color : undefined} />
            </button>
          ))}
        </div>
      </div>
      <h3 className="sub">Fields</h3>
      <p className="muted small" style={{ marginTop: -4 }}>
        <b>Facts</b> sit in the article's sidebar box. <b>Sections</b> become parts of the article itself, grouped under headings, with a guiding question shown while empty. <b>Tables</b> suit things like life stages.
      </p>
      <datalist id="tpl-groups">
        {[...new Set(t.fields.map((f) => f.group).filter(Boolean))].map((g) => <option key={g} value={g} />)}
      </datalist>
      <div className="field-rows">
        {t.fields.map((f, i) => {
          const kind = kindOf(f);
          const upd = (patch: Partial<TemplateField>) => setFields(t.fields.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={f.key + i} className={`field-card ${kind}`}>
              <div className="field-row">
                <input
                  className="input sm grow"
                  defaultValue={f.label}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== f.label && upd({ label: e.target.value.trim() })}
                />
                <select className="input sm" value={kind} onChange={(e) => upd(fromKind(e.target.value as Kind, f))}>
                  <option value="fact">Fact (short)</option>
                  <option value="factPara">Fact (paragraph)</option>
                  <option value="section">Section</option>
                  <option value="table">Table section</option>
                </select>
                <button className="icon-btn sm" disabled={i === 0} onClick={() => setFields(swap(t.fields, i, i - 1))} aria-label="Move up"><ArrowUp size={13} /></button>
                <button className="icon-btn sm" disabled={i === t.fields.length - 1} onClick={() => setFields(swap(t.fields, i, i + 1))} aria-label="Move down"><ArrowDown size={13} /></button>
                <button className="icon-btn sm danger" onClick={() => setFields(t.fields.filter((_, j) => j !== i))} aria-label="Remove field"><Trash2 size={13} /></button>
              </div>
              {(kind === 'section' || kind === 'table') && (
                <div className="field-extra">
                  <input className="input sm" list="tpl-groups" placeholder="Group heading, e.g. Biology & Anatomy" defaultValue={f.group ?? ''} onBlur={(e) => e.target.value !== (f.group ?? '') && upd({ group: e.target.value.trim() || undefined })} />
                  <input className="input sm grow" placeholder="Guiding question shown while it's empty" defaultValue={f.hint ?? ''} onBlur={(e) => e.target.value !== (f.hint ?? '') && upd({ hint: e.target.value.trim() || undefined })} />
                  {kind === 'table' && (
                    <input className="input sm grow" placeholder="Columns, comma separated" defaultValue={(f.columns ?? []).join(', ')} onBlur={(e) => upd({ columns: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const label = newField.trim();
          if (!label) return;
          let key = keyOf(label);
          while (t.fields.some((f) => f.key === key)) key += '_2';
          const lastGroup = [...t.fields].reverse().find((f) => f.group)?.group;
          setFields([...t.fields, { key, label, ...fromKind(newKind, { key, label, type: 'text', group: lastGroup }) }]);
          setNewField('');
        }}
      >
        <select className="input sm" style={{ width: 150 }} value={newKind} onChange={(e) => setNewKind(e.target.value as Kind)}>
          <option value="fact">New fact</option>
          <option value="factPara">New paragraph fact</option>
          <option value="section">New section</option>
          <option value="table">New table</option>
        </select>        <input className="input sm grow" placeholder="New field, e.g. Favorite weapon" value={newField} onChange={(e) => setNewField(e.target.value)} />
        <button className="btn sm"><Plus size={13} /> Add field</button>
      </form>
      <p className="muted small">Renaming a field keeps its data. Removing one hides it, but the text stays in the article and comes back if you re-add a field with the same name.</p>
      <hr />
      <button
        className="btn sm danger"
        disabled={!others.length}
        onClick={async () => {
          const fallback = others.find((o) => o.name === 'Note') ?? others[0];
          if (!confirm(count ? `Delete “${t.name}”? Its ${count} article(s) become “${fallback.name}”.` : `Delete “${t.name}”?`)) return;
          await db.articles.where('templateId').equals(t.id).modify({ templateId: fallback.id });
          await db.templates.delete(t.id);
          await touch(world.id);
          onDeleted();
        }}
      >
        <Trash2 size={13} /> Delete type
      </button>
    </div>
  );
}

function swap<T>(a: T[], i: number, j: number) {
  const b = [...a];
  [b[i], b[j]] = [b[j], b[i]];
  return b;
}
