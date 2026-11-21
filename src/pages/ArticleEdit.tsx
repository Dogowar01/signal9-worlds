import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Bold, Check, Columns2, Heading, ImagePlus, Italic, LayoutPanelTop, Link2, List, Lock, Quote, Trash2, TriangleAlert } from 'lucide-react';
import { deleteArticle, propagateRename, snapshotArticle, updateArticle, type Article, type CanonStatus, type Status } from '../db';
import { isSection } from '../templates';
import { CANON_META, CANON_ORDER } from '../lib/canon';
import { similarTo } from '../lib/names';
import { CanonPicker } from '../components/Canon';
import { SectionsEditor } from '../components/SectionsEditor';
import { useWorld } from '../lib/world';
import { imageFileToDataUrl } from '../lib/io';
import { LinkEditor, type LinkEditorHandle } from '../components/LinkEditor';
import { ArticlePicker } from '../components/ArticlePicker';
import { Markdown } from '../components/Markdown';
import { TemplateIcon } from '../icons';

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

const pendingDelete = new Map<string, number>();
const isBlank = (a: Article) =>
  (!a.title.trim() || a.title.trim() === 'Untitled') &&
  !a.body.trim() &&
  !a.summary.trim() &&
  !a.image &&
  !a.parentId &&
  Object.values(a.fields).every((v) => !v.trim());

export function ArticleEdit() {
  const { articleId = '' } = useParams();
  const { index } = useWorld();
  const source = index.byId.get(articleId);
  if (!source) return <div className="empty-state">This article doesn't exist.</div>;
  // key forces a fresh editor (and fresh draft state) per article
  return <Editor key={source.id} source={source} />;
}

function Editor({ source }: { source: Article }) {
  const { world, templates, templateById, index, allArticles, maps } = useWorld();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Article>(source);
  const [aliases, setAliases] = useState(source.aliases.join(', '));
  const [tags, setTags] = useState(source.tags.join(', '));
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving'>('saved');
  const [preview, setPreview] = useState(() => window.innerWidth > 1300);
  const editor = useRef<LinkEditorHandle>(null);
  const timer = useRef<number | undefined>(undefined);
  const snapped = useRef(false);
  const dirty = useRef(false);
  const originalTitle = useRef(source.title);
  const latest = useRef(draft);
  latest.current = draft;
  const base = `/w/${world.id}`;
  const t = templateById.get(draft.templateId);

  const persist = async (d: Article) => {
    setSaveState('saving');
    if (!snapped.current) {
      snapped.current = true;
      if (source.body.trim() || Object.values(source.fields).some((v) => v.trim())) await snapshotArticle(source);
    }
    const { id, worldId, createdAt, updatedAt, ...changes } = d;
    void id; void worldId; void createdAt; void updatedAt;
    dirty.current = false;
    await updateArticle(source.id, changes);
    setSaveState(dirty.current ? 'dirty' : 'saved');
  };

  const change = (patch: Partial<Article>) => {
    const next = { ...latest.current, ...patch };
    setDraft(next);
    latest.current = next;
    dirty.current = true;
    setSaveState('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => persist(next), 600);
  };

  const flush = async () => {
    window.clearTimeout(timer.current);
    await persist(latest.current);
    const n = await propagateRename(world.id, originalTitle.current, latest.current.title, source.id);
    originalTitle.current = latest.current.title;
    return n;
  };

  // Save + fix renamed links if the user navigates away without pressing Done.
  useEffect(() => {
    // React dev mode re-mounts immediately; cancel a cleanup-delete scheduled by that first unmount.
    const pending = pendingDelete.get(source.id);
    if (pending) {
      window.clearTimeout(pending);
      pendingDelete.delete(source.id);
    }
    return () => {
      window.clearTimeout(timer.current);
      const d = latest.current;
      if (isBlank(d)) {
        // Abandoned "Untitled" article: remove it rather than leave clutter behind.
        pendingDelete.set(d.id, window.setTimeout(() => {
          pendingDelete.delete(d.id);
          deleteArticle(d.id);
        }, 250));
        return;
      }
      const finish = () => propagateRename(d.worldId, originalTitle.current, d.title, d.id);
      if (dirty.current) {
        const { id, worldId, createdAt, updatedAt, ...changes } = d;
        void id; void worldId; void createdAt; void updatedAt;
        updateArticle(source.id, changes).then(finish);
      } else finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFieldCanon = (key: string, s: CanonStatus | undefined) => {
    const next = { ...(latest.current.fieldCanon ?? {}) };
    if (s) next[key] = s;
    else delete next[key];
    change({ fieldCanon: next });
  };
  const words = [draft.body, ...Object.values(draft.fields)].reduce((n, s) => n + (s.match(/\S+/g)?.length ?? 0), 0);
  const nameEntries = useMemo(
    () => [
      ...allArticles.flatMap((a) => [a.title, ...a.aliases].filter(Boolean).map((name) => ({ name, kind: templateById.get(a.templateId)?.name ?? 'article', owner: a.id }))),
      ...maps.flatMap((m) => [
        ...m.pins.map((p) => ({ name: p.label, kind: `pin on ${m.name}`, owner: `pin:${p.id}`, link: p.articleId ?? undefined })),
        ...(m.regions ?? []).map((r) => ({ name: r.name, kind: `region on ${m.name}`, owner: `region:${r.id}`, link: r.articleId ?? undefined })),
      ]),
    ],
    [allArticles, maps, templateById],
  );
  const lookalikes = draft.title.trim() && draft.title !== 'Untitled'
    ? similarTo(draft.title, nameEntries, source.id).filter((e) => !('link' in e && e.link === source.id))
    : [];

  const descendants = new Set<string>([source.id]);
  const walk = (id: string) => (index.children.get(id) ?? []).forEach((c) => (descendants.add(c.id), walk(c.id)));
  walk(source.id);

  const done = async () => {
    if (isBlank(latest.current)) return navigate(base);
    await flush();
    navigate(`${base}/a/${source.id}`);
  };

  return (
    <div className="page editor-page">
      <header className="editor-head">
        <input
          className="title-input"
          value={draft.title}
          placeholder="Article title"
          autoFocus={source.title === 'Untitled'}
          onFocus={(e) => source.title === 'Untitled' && e.target.select()}
          onChange={(e) => change({ title: e.target.value })}
        />
        <CanonPicker value={draft.canon} onChange={(s) => change({ canon: s })} placeholder="Canon status" />
        <span className={`save-state ${saveState}`}>{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Editing'}</span>
        <button className="btn primary" onClick={done}>
          <Check size={16} /> Done
        </button>
      </header>
      {lookalikes.length > 0 && (
        <p className="hint-bar warn-bar small">
          <TriangleAlert size={13} /> Similar names already exist:{' '}
          {lookalikes.map((e, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <b>{e.name}</b> <span className="muted">({e.kind})</span>
            </span>
          ))}
          . Easy to confuse later; rename one if they aren't meant to be related.
        </p>
      )}
      {originalTitle.current && draft.title.trim() !== originalTitle.current.trim() && (
        <p className="hint-bar small">Renaming: links to “{originalTitle.current}” in other articles will be updated when you press Done.</p>
      )}

      <div className="editor-grid">
        <div className="editor-meta card">
          <label className="field">
            <span>Type</span>
            <select className="input sm" value={draft.templateId} onChange={(e) => change({ templateId: e.target.value })}>
              {templates.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Writing progress</span>
            <select className="input sm" value={draft.status} onChange={(e) => change({ status: e.target.value as Status })}>
              <option value="stub">Stub</option>
              <option value="draft">Draft</option>
              <option value="done">Finished</option>
            </select>
          </label>
          <div className="field">
            <span>Inside (parent)</span>
            <ArticlePicker value={draft.parentId} onChange={(id) => change({ parentId: id })} exclude={[...descendants]} placeholder="Top level" />
          </div>
          <label className="field">
            <span>Also known as</span>
            <input className="input sm" value={aliases} placeholder="comma, separated" onChange={(e) => (setAliases(e.target.value), change({ aliases: list(e.target.value) }))} />
          </label>
          <label className="field">
            <span>Tags</span>
            <input className="input sm" value={tags} placeholder="comma, separated" onChange={(e) => (setTags(e.target.value), change({ tags: list(e.target.value) }))} />
          </label>
          <label className="check">
            <input type="checkbox" checked={draft.gmOnly} onChange={(e) => change({ gmOnly: e.target.checked })} />
            <Lock size={13} /> GM only (hidden in player view)
          </label>
          <div className="field">
            <span>Image</span>
            {draft.image ? (
              <div className="img-edit">
                <img src={draft.image} alt="" />
                <button className="btn sm" onClick={() => change({ image: undefined })}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            ) : (
              <label className="btn sm">
                <ImagePlus size={14} /> Add image
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const { url } = await imageFileToDataUrl(f, 1200);
                    change({ image: url });
                  }}
                />
              </label>
            )}
          </div>

          {t && t.fields.some((f) => !isSection(f)) && (
            <>
              <h3 className="sub" style={{ color: t.color }}>
                <TemplateIcon name={t.icon} size={14} /> {t.name} facts
              </h3>
              {t.fields.filter((f) => !isSection(f)).map((f) => (
                <label key={f.key} className="field">
                  <span className="row" style={{ gap: 6 }}>
                    <CanonPicker variant="dot" value={draft.fieldCanon?.[f.key]} onChange={(s) => setFieldCanon(f.key, s)} />
                    {f.label}
                  </span>
                  {f.type === 'textarea' ? (
                    <textarea className="input sm" rows={3} value={draft.fields[f.key] ?? ''} onChange={(e) => change({ fields: { ...latest.current.fields, [f.key]: e.target.value } })} />
                  ) : (
                    <input className="input sm" value={draft.fields[f.key] ?? ''} onChange={(e) => change({ fields: { ...latest.current.fields, [f.key]: e.target.value } })} />
                  )}
                </label>
              ))}
              <p className="muted small">
                Tip: use [[Article Name]] in any field. <Link to={`${base}/templates`}>Edit this type's fields</Link>
              </p>
            </>
          )}
        </div>

        <div className="editor-main">
          <label className="field">
            <span>Summary (one line, shown in previews)</span>
            <input className="input" value={draft.summary} onChange={(e) => change({ summary: e.target.value })} placeholder="Who or what is this, in a sentence?" />
          </label>
          <div className="body-editor">
          <div className="toolbar">
            <button title="Bold (Ctrl+B)" onClick={() => editor.current?.wrap('**')}><Bold size={15} /></button>
            <button title="Italic (Ctrl+I)" onClick={() => editor.current?.wrap('_')}><Italic size={15} /></button>
            <button title="Heading" onClick={() => editor.current?.linePrefix('## ')}><Heading size={15} /></button>
            <button title="Quote" onClick={() => editor.current?.linePrefix('> ')}><Quote size={15} /></button>
            <button title="List" onClick={() => editor.current?.linePrefix('- ')}><List size={15} /></button>
            <button title="Link to article ([[ ]])" onClick={() => editor.current?.wrap('[[', ']]', 'Article name')}><Link2 size={15} /></button>
            <button title="Embed an article, section (Article#Heading), map:Name or timeline" onClick={() => editor.current?.wrap('\n![[', ']]\n', '')}>
              <LayoutPanelTop size={15} /> Embed
            </button>
            <button title="Secret block (hidden in player view)" onClick={() => editor.current?.wrap('\n:::secret\n', '\n:::\n', 'Only the GM sees this.')}>
              <Lock size={15} /> Secret
            </button>
            <select
              className="toolbar-select"
              value=""
              title="Mark the selected passage's canon status"
              onChange={(e) => {
                const k = e.target.value;
                if (k) editor.current?.wrap(`\n:::${k}\n`, '\n:::\n', 'Text to mark');
              }}
            >
              <option value="">Mark as…</option>
              {CANON_ORDER.map((k) => (
                <option key={k} value={k}>{CANON_META[k].label}</option>
              ))}
            </select>
            <span className="grow" />
            <button className={preview ? 'on' : ''} title="Toggle preview" onClick={() => setPreview(!preview)}>
              <Columns2 size={15} /> Preview
            </button>
          </div>
          <div className={`write-area ${preview ? 'split' : ''}`}>
            <LinkEditor
              ref={editor}
              value={draft.body}
              onChange={(body) => change({ body })}
              rows={24}
              onSave={() => flush()}
              placeholder={'Write freely. Markdown works.\nType [[ to link another article, even one that doesn\'t exist yet.\nWrap GM secrets in :::secret … ::: blocks.'}
            />
            {preview && (
              <div className="preview card">
                <Markdown source={draft.body || '_Preview appears here._'} />
              </div>
            )}
          </div>
          <p className="muted small">
            {words.toLocaleString()} words · Ctrl+S saves · changes autosave
          </p>
          </div>
          {t && (
            <SectionsEditor
              template={t}
              fields={draft.fields}
              fieldCanon={draft.fieldCanon ?? {}}
              setField={(key, value) => change({ fields: { ...latest.current.fields, [key]: value } })}
              setCanon={setFieldCanon}
              onSave={() => flush()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
