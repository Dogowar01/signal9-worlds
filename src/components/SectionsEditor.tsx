import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Plus, X } from 'lucide-react';
import type { CanonStatus, Template, TemplateField } from '../db';
import { parseTable } from '../templates';
import { LinkEditor } from './LinkEditor';
import { CanonPicker } from './Canon';
import { groupSections } from './ArticleSections';

interface Props {
  template: Template;
  fields: Record<string, string>;
  fieldCanon: Record<string, CanonStatus>;
  setField: (key: string, value: string) => void;
  setCanon: (key: string, s: CanonStatus | undefined) => void;
  onSave: () => void;
}

/** Editing for a type's long-form sections, grouped like the article, each with its guiding question. */
export function SectionsEditor({ template, fields, fieldCanon, setField, setCanon, onSave }: Props) {
  const groups = groupSections(template.fields);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  if (!groups.length) return null;
  const filled = (g: { fields: TemplateField[] }) => g.fields.filter((fl) => fields[fl.key]?.trim()).length;

  return (
    <div className="sections-editor">
      <div className="row">
        <h3 className="sub grow" style={{ margin: '22px 0 8px' }}>{template.name} sections</h3>
        <button className="linklike small" onClick={() => setClosed(closed.size ? new Set() : new Set(groups.map((g) => g.name)))}>
          {closed.size ? 'Expand all' : 'Collapse all'}
        </button>
      </div>
      {groups.map((g) => {
        const open = !closed.has(g.name);
        return (
          <section key={g.name} className="sec-edit-group card">
            <button className="sec-edit-head" onClick={() => setClosed((c) => { const n = new Set(c); if (n.has(g.name)) n.delete(g.name); else n.add(g.name); return n; })}>
              <ChevronRight size={15} className={`chev ${open ? 'open' : ''}`} />
              <b className="grow">{g.name}</b>
              <span className={`fill-count ${filled(g) === g.fields.length ? 'full' : ''}`}>{filled(g)}/{g.fields.length}</span>
            </button>
            <div className={`group-body ${open ? 'open' : ''}`}>
              <div>
                {g.fields.map((fl) => (
                  <div key={fl.key} className="sec-edit-field">
                    <div className="row sec-edit-label">
                      <CanonPicker variant="dot" value={fieldCanon[fl.key]} onChange={(s) => setCanon(fl.key, s)} />
                      <b>{fl.label}</b>
                    </div>
                    {fl.type === 'table' ? (
                      <TableEditor field={fl} value={fields[fl.key] ?? ''} onChange={(v) => setField(fl.key, v)} />
                    ) : (
                      <LinkEditor
                        value={fields[fl.key] ?? ''}
                        onChange={(v) => setField(fl.key, v)}
                        rows={3}
                        className="section-input"
                        placeholder={fl.hint ?? `Write about ${fl.label.toLowerCase()}…`}
                        onSave={onSave}
                      />
                    )}
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

export function TableEditor({ field, value, onChange }: { field: TemplateField; value: string; onChange: (v: string) => void }) {
  const cols = field.columns?.length ? field.columns : ['Column'];
  const rows = parseTable(value, cols.length);
  const save = (next: string[][]) => onChange(next.length ? JSON.stringify(next) : '');
  const set = (r: number, c: number, v: string) => save(rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));
  const move = (i: number, d: number) => {
    const b = [...rows];
    [b[i], b[i + d]] = [b[i + d], b[i]];
    save(b);
  };
  return (
    <div className="table-edit">
      <table className="field-table editable">
        <thead>
          <tr>
            {cols.map((c) => <th key={c}>{c}</th>)}
            <th style={{ width: 70 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>
                  <textarea className="cell-input" rows={1} value={cell} placeholder={cols[j]} onChange={(e) => set(i, j, e.target.value)} />
                </td>
              ))}
              <td className="row-tools">
                <button type="button" className="icon-btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move row up"><ArrowUp size={11} /></button>
                <button type="button" className="icon-btn sm" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Move row down"><ArrowDown size={11} /></button>
                <button type="button" className="icon-btn sm danger" onClick={() => save(rows.filter((_, k) => k !== i))} aria-label="Remove row"><X size={11} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn sm" onClick={() => save([...rows, cols.map(() => '')])}>
        <Plus size={13} /> Row
      </button>
      {!rows.length && field.hint && <span className="muted small" style={{ marginLeft: 8 }}>{field.hint}</span>}
    </div>
  );
}
