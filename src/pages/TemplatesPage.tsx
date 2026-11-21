import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { db, touch, uid, type Template, type TemplateField } from '../db';
import { useWorld } from '../lib/world';
import { ICONS, TemplateIcon } from '../icons';

const COLORS = ['#e0a458', '#6fb38a', '#7f9fe0', '#c58fd6', '#d98b7a', '#e5c86a', '#5fc4c4', '#e07a6f', '#9a8cf0', '#8fbf6a', '#c9a66b', '#a3a3a3', '#f0a05a', '#6ab0de'];

const keyOf = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || uid().slice(0, 6);

export function TemplatesPage() {
  const { world, templates, allArticles } = useWorld();
  const [selId, setSelId] = useState<string | undefined>(templates[0]?.id);
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
          <p className="lead">Every type is yours to change: rename it, recolor it, add or drop sidebar fields. Existing text is never lost.</p>
        </div>
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
      </header>
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
      <h3 className="sub">Sidebar fields</h3>
      <div className="field-rows">
        {t.fields.map((f, i) => (
          <div key={f.key + i} className="field-row">
            <input
              className="input sm grow"
              defaultValue={f.label}
              onBlur={(e) => e.target.value.trim() && e.target.value !== f.label && setFields(t.fields.map((x, j) => (j === i ? { ...x, label: e.target.value.trim() } : x)))}
            />
            <select className="input sm" value={f.type} onChange={(e) => setFields(t.fields.map((x, j) => (j === i ? { ...x, type: e.target.value as TemplateField['type'] } : x)))}>
              <option value="text">Short text</option>
              <option value="textarea">Paragraph</option>
            </select>
            <button className="icon-btn sm" disabled={i === 0} onClick={() => setFields(swap(t.fields, i, i - 1))} aria-label="Move up"><ArrowUp size={13} /></button>
            <button className="icon-btn sm" disabled={i === t.fields.length - 1} onClick={() => setFields(swap(t.fields, i, i + 1))} aria-label="Move down"><ArrowDown size={13} /></button>
            <button className="icon-btn sm danger" onClick={() => setFields(t.fields.filter((_, j) => j !== i))} aria-label="Remove field"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const label = newField.trim();
          if (!label) return;
          let key = keyOf(label);
          while (t.fields.some((f) => f.key === key)) key += '_2';
          setFields([...t.fields, { key, label, type: 'text' }]);
          setNewField('');
        }}
      >
        <input className="input sm grow" placeholder="New field, e.g. Favorite weapon" value={newField} onChange={(e) => setNewField(e.target.value)} />
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
