import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown, ArrowLeft, ArrowUp, BookOpen, ChevronRight, FileDown, Flame, Focus, NotebookPen, Plus, Target, Trash2,
} from 'lucide-react';
import { db, type Manuscript, type ManuscriptNode, type SceneStatus } from '../db';
import { useWorld } from '../lib/world';
import { extractTargets, originalCasing } from '../lib/links';
import { compileManuscript, download, safeName } from '../lib/io';
import { STATUS_META, addNode, moveNode, recordProgress, streak, todayWords, totalWords, wordCount } from '../lib/manuscript';
import { trashManuscript, trashScene } from '../lib/trash';
import { showUndo } from '../lib/undo';
import { useCreateArticle } from '../lib/actions';
import { LinkEditor } from '../components/LinkEditor';
import { ArticlePicker } from '../components/ArticlePicker';
import { Markdown } from '../components/Markdown';
import { ArticleChip } from './ArticleView';

export function ManuscriptView() {
  const { msId = '' } = useParams();
  const ms = useLiveQuery(() => db.manuscripts.get(msId), [msId], null);
  const nodes = useLiveQuery(() => db.scenes.where('manuscriptId').equals(msId).toArray(), [msId]);
  if (ms === null || !nodes) return <div className="loading">Opening manuscript…</div>;
  if (!ms) return <div className="empty-state">Manuscript not found. It may be in the trash.</div>;
  return <Workspace ms={ms} nodes={nodes} />;
}

function Workspace({ ms, nodes }: { ms: Manuscript; nodes: ManuscriptNode[] }) {
  const { world } = useWorld();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [focus, setFocus] = useState(false);
  const [reading, setReading] = useState(false);
  const chapters = nodes.filter((n) => n.kind === 'chapter').sort((a, b) => a.order - b.order);
  const scenesOf = (cid: string) => nodes.filter((n) => n.parentId === cid).sort((a, b) => a.order - b.order);
  const firstScene = chapters.map((c) => scenesOf(c.id)[0]).find(Boolean) ?? chapters[0];
  const selId = params.get('scene') ?? firstScene?.id;
  const selected = nodes.find((n) => n.id === selId);
  const total = totalWords(nodes);
  const today = todayWords(ms, total);
  const days = streak(ms);
  const base = `/w/${world.id}`;

  useEffect(() => {
    document.documentElement.classList.toggle('focus-mode', focus);
    return () => document.documentElement.classList.remove('focus-mode');
  }, [focus]);

  const select = (id: string) => {
    setReading(false);
    setParams({ scene: id }, { replace: true });
  };

  return (
    <div className={`ms-page ${focus ? 'focus' : ''}`}>
      <header className="ms-top">
        <Link className="icon-btn" to={`${base}/write`} title="All manuscripts"><ArrowLeft size={17} /></Link>
        <input className="map-name" value={ms.title} onChange={(e) => db.manuscripts.update(ms.id, { title: e.target.value })} aria-label="Manuscript title" />
        <span className="grow" />
        <GoalRing value={today} goal={ms.dailyGoal} label="today" />
        <GoalRing value={total} goal={ms.wordGoal} label="total" />
        {days > 1 && <span className="streak"><Flame size={14} /> {days}-day streak</span>}
        <button className={`icon-btn ${reading ? 'on' : ''}`} title="Read the whole manuscript" onClick={() => setReading(!reading)}><BookOpen size={17} /></button>
        <button className={`icon-btn ${focus ? 'on' : ''}`} title="Focus mode" onClick={() => setFocus(!focus)}><Focus size={17} /></button>
        <button className="icon-btn" title="Download as Markdown" onClick={() => download(`${safeName(ms.title)}.md`, compileManuscript(ms, nodes), 'text/markdown')}><FileDown size={17} /></button>
      </header>
      <div className="ms-cols">
        <aside className="binder">
          {chapters.map((ch) => (
            <BinderChapter key={ch.id} ms={ms} chapter={ch} scenes={scenesOf(ch.id)} chapters={chapters} selected={selId} onSelect={select} />
          ))}
          <button className="btn sm binder-add" onClick={async () => select((await addNode(ms, 'chapter', null, chapters)).id)}>
            <Plus size={13} /> Chapter
          </button>
          <hr />
          <button
            className="btn sm danger"
            onClick={async () => {
              const tid = await trashManuscript(ms.id);
              navigate(`${base}/write`);
              showUndo(ms.title, tid);
            }}
          >
            <Trash2 size={13} /> Delete manuscript
          </button>
        </aside>

        <main className="ms-main">
          {reading ? (
            <article className="read-through">
              <Markdown source={compileManuscript(ms, nodes)} />
            </article>
          ) : selected ? (
            <SceneEditor key={selected.id} node={selected} />
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><NotebookPen size={26} /></div>
              Add a chapter to begin.
            </div>
          )}
        </main>

        {!reading && selected && <Inspector ms={ms} node={selected} />}
      </div>
    </div>
  );
}

function GoalRing({ value, goal, label }: { value: number; goal: number; label: string }) {
  const pct = Math.min(100, (value / Math.max(1, goal)) * 100);
  return (
    <div className={`goal ${pct >= 100 ? 'met' : ''}`} title={`${value.toLocaleString()} of ${goal.toLocaleString()} words ${label}`}>
      <span className="goal-ring" style={{ ['--p' as string]: `${pct}%` }} />
      <span>
        <b>{value.toLocaleString()}</b> <span className="muted">{label}</span>
      </span>
    </div>
  );
}

function BinderChapter({ ms, chapter, scenes, chapters, selected, onSelect }: {
  ms: Manuscript;
  chapter: ManuscriptNode;
  scenes: ManuscriptNode[];
  chapters: ManuscriptNode[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const words = scenes.reduce((n, s) => n + wordCount(s.body), 0);
  return (
    <div className="binder-ch">
      <div className={`binder-row ch ${selected === chapter.id ? 'active' : ''}`}>
        <button className="twisty" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse' : 'Expand'}>
          <ChevronRight size={13} className={`chev ${open ? 'open' : ''}`} />
        </button>
        <button className="binder-title" onClick={() => onSelect(chapter.id)}>{chapter.title || 'Untitled chapter'}</button>
        <span className="muted small">{words ? words.toLocaleString() : ''}</span>
        <NodeTools node={chapter} siblings={chapters} />
      </div>
      <div className={`group-body ${open ? 'open' : ''}`}>
        <div>
          {scenes.map((s) => (
            <div key={s.id} className={`binder-row scene ${selected === s.id ? 'active' : ''}`}>
              <span className="status-dot" style={{ background: STATUS_META[s.status].color }} title={STATUS_META[s.status].label} />
              <button className="binder-title" onClick={() => onSelect(s.id)}>{s.title || 'Untitled scene'}</button>
              <span className="muted small">{wordCount(s.body) || ''}</span>
              <NodeTools node={s} siblings={scenes} />
            </div>
          ))}
          <button className="binder-new" onClick={async () => onSelect((await addNode(ms, 'scene', chapter.id, scenes)).id)}>
            <Plus size={12} /> Scene
          </button>
        </div>
      </div>
    </div>
  );
}

function NodeTools({ node, siblings }: { node: ManuscriptNode; siblings: ManuscriptNode[] }) {
  return (
    <span className="node-tools">
      <button className="icon-btn sm" onClick={() => moveNode(node, siblings, -1)} aria-label="Move up"><ArrowUp size={11} /></button>
      <button className="icon-btn sm" onClick={() => moveNode(node, siblings, 1)} aria-label="Move down"><ArrowDown size={11} /></button>
      <button
        className="icon-btn sm danger"
        onClick={async () => showUndo(node.title || (node.kind === 'chapter' ? 'chapter' : 'scene'), await trashScene(node.id))}
        aria-label="Delete"
      >
        <Trash2 size={11} />
      </button>
    </span>
  );
}

function SceneEditor({ node }: { node: ManuscriptNode }) {
  const [title, setTitle] = useState(node.title);
  const [synopsis, setSynopsis] = useState(node.synopsis);
  const [body, setBody] = useState(node.body);
  const [state, setState] = useState<'saved' | 'dirty' | 'saving'>('saved');
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef({ title, synopsis, body });
  latest.current = { title, synopsis, body };

  const persist = async () => {
    setState('saving');
    await db.scenes.update(node.id, { ...latest.current, updatedAt: Date.now() });
    await recordProgress(node.manuscriptId);
    setState('saved');
  };
  const schedule = () => {
    setState('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(persist, 700);
  };
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    db.scenes.update(node.id, { ...latest.current }).then(() => recordProgress(node.manuscriptId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="scene-editor">
      <input
        className="title-input scene-title"
        value={title}
        placeholder={node.kind === 'chapter' ? 'Chapter title' : 'Scene title'}
        onChange={(e) => (setTitle(e.target.value), schedule())}
      />
      <textarea
        className="synopsis"
        rows={2}
        value={synopsis}
        placeholder={node.kind === 'chapter' ? 'What happens in this chapter? (notes, not part of the text)' : 'Synopsis: what changes in this scene? (notes, not part of the text)'}
        onChange={(e) => (setSynopsis(e.target.value), schedule())}
      />
      <LinkEditor
        value={body}
        onChange={(v) => (setBody(v), schedule())}
        onSave={persist}
        rows={26}
        className="prose-editor"
        placeholder={node.kind === 'chapter' ? 'Optional chapter epigraph or opening text. Scenes go in the binder.' : 'Begin. Type [[ to link a character, place or anything from your world.'}
      />
      <div className="row small muted scene-foot">
        <span className={`save-state ${state}`}>{state === 'saved' ? 'Saved' : state === 'saving' ? 'Saving…' : 'Writing'}</span>
        <span className="grow" />
        {wordCount(body).toLocaleString()} words · Ctrl+S saves
      </div>
    </div>
  );
}

function Inspector({ ms, node }: { ms: Manuscript; node: ManuscriptNode }) {
  const { index } = useWorld();
  const create = useCreateArticle();
  const targets = useMemo(() => [...new Set(extractTargets(`${node.body}\n${node.synopsis}`))], [node.body, node.synopsis]);
  const found = targets.map((t) => index.resolve(t)).filter((a, i, arr) => a && arr.indexOf(a) === i);
  const missing = targets.filter((t) => !index.resolve(t));
  return (
    <aside className="inspector">
      {node.kind === 'scene' && (
        <>
          <div className="field">
            <span>Status</span>
            <div className="seg wrap">
              {(Object.keys(STATUS_META) as SceneStatus[]).map((s) => (
                <button key={s} className={node.status === s ? 'on' : ''} onClick={() => db.scenes.update(node.id, { status: s })}>
                  <span className="status-dot" style={{ background: STATUS_META[s].color }} /> {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Point of view</span>
            <ArticlePicker value={node.povId} onChange={(id) => db.scenes.update(node.id, { povId: id })} placeholder="Whose eyes?" />
          </div>
          <div className="field">
            <span>Location</span>
            <ArticlePicker value={node.locationId} onChange={(id) => db.scenes.update(node.id, { locationId: id })} placeholder="Where?" />
          </div>
        </>
      )}
      <div className="field">
        <span>Lore in this {node.kind}</span>
        {found.length === 0 && missing.length === 0 && <p className="muted small">Link people and places with [[ ]] and they'll appear here.</p>}
        <div className="chips">
          {found.map((a) => a && <ArticleChip key={a.id} a={a} />)}
          {missing.map((t) => (
            <button key={t} className="chip missing-chip" onClick={() => create(originalCasing(node.body, t))} title="Not written yet. Click to create">
              + {originalCasing(node.body, t)}
            </button>
          ))}
        </div>
      </div>
      <div className="field goals">
        <span><Target size={12} /> Goals</span>
        <label className="row small">
          <span className="grow muted">Manuscript</span>
          <input className="input sm" type="number" min={0} step={1000} style={{ width: 100 }} value={ms.wordGoal} onChange={(e) => db.manuscripts.update(ms.id, { wordGoal: Number(e.target.value) || 0 })} />
        </label>
        <label className="row small">
          <span className="grow muted">Daily</span>
          <input className="input sm" type="number" min={0} step={50} style={{ width: 100 }} value={ms.dailyGoal} onChange={(e) => db.manuscripts.update(ms.id, { dailyGoal: Number(e.target.value) || 0 })} />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          <span>Subtitle</span>
          <input className="input sm" value={ms.subtitle} onChange={(e) => db.manuscripts.update(ms.id, { subtitle: e.target.value })} placeholder="Book one of…" />
        </label>
      </div>
    </aside>
  );
}
