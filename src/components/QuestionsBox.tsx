import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, CircleHelp, Plus, RotateCcw, X } from 'lucide-react';
import { db, touch, uid, type Question } from '../db';
import { useWorld } from '../lib/world';
import { Markdown } from './Markdown';

export async function addQuestion(worldId: string, text: string, articleId: string | null) {
  await db.questions.add({ id: uid(), worldId, articleId, text: text.trim(), status: 'open', answer: '', createdAt: Date.now(), decidedAt: null });
  await touch(worldId);
}

export async function decideQuestion(q: Question, answer: string) {
  await db.questions.update(q.id, { status: 'decided', answer, decidedAt: Date.now() });
  await touch(q.worldId);
}

/** One question: shows the answer once decided, or a box to record the decision. */
export function QuestionItem({ q, showArticle }: { q: Question; showArticle?: boolean }) {
  const { index, world } = useWorld();
  const [deciding, setDeciding] = useState(false);
  const [answer, setAnswer] = useState(q.answer);
  const a = q.articleId ? index.byId.get(q.articleId) : undefined;
  return (
    <div className={`q-item q-${q.status}`}>
      <div className="row q-row">
        <span className="q-mark">{q.status === 'decided' ? <Check size={13} /> : q.status === 'dropped' ? <X size={13} /> : '?'}</span>
        <div className="grow">
          <div className="q-text"><Markdown source={q.text} inline /></div>
          {showArticle && a && (
            <a className="chip q-article" href={`#/w/${world.id}/a/${a.id}`}>{a.title}</a>
          )}
          {q.status === 'decided' && q.answer && (
            <div className="q-answer"><b>Decided:</b> <Markdown source={q.answer} inline /></div>
          )}
        </div>
        <span className="q-actions">
          {q.status === 'open' ? (
            <>
              <button className="icon-btn sm" title="Record a decision" onClick={() => setDeciding(!deciding)}><Check size={13} /></button>
              <button className="icon-btn sm" title="Drop this question" onClick={() => db.questions.update(q.id, { status: 'dropped', decidedAt: Date.now() })}><X size={13} /></button>
            </>
          ) : (
            <button className="icon-btn sm" title="Reopen" onClick={() => db.questions.update(q.id, { status: 'open', decidedAt: null })}><RotateCcw size={12} /></button>
          )}
        </span>
      </div>
      {deciding && (
        <form
          className="q-decide"
          onSubmit={async (e) => {
            e.preventDefault();
            await decideQuestion(q, answer.trim());
            setDeciding(false);
          }}
        >
          <textarea className="input sm" rows={2} autoFocus placeholder="What did you decide? (optional, [[links]] work)" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <div className="row">
            <span className="grow" />
            <button type="button" className="btn sm" onClick={() => setDeciding(false)}>Cancel</button>
            <button className="btn sm primary">Mark decided</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Open questions attached to one article (in the article sidebar). */
export function QuestionsBox({ articleId }: { articleId: string }) {
  const { world } = useWorld();
  const qs = useLiveQuery(() => db.questions.where('articleId').equals(articleId).sortBy('createdAt'), [articleId]) ?? [];
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const open = qs.filter((q) => q.status === 'open');
  const done = qs.filter((q) => q.status !== 'open');

  return (
    <div className="info-section questions">
      <h4>
        <CircleHelp size={13} /> Open questions {open.length > 0 && <span className="q-count">{open.length}</span>}
        <button className="icon-btn sm ghost" onClick={() => setAdding(!adding)} title="Add a question" aria-label="Add a question">
          {adding ? <X size={13} /> : <Plus size={13} />}
        </button>
      </h4>
      {adding && (
        <form
          className="q-add"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            await addQuestion(world.id, text, articleId);
            setText('');
            setAdding(false);
          }}
        >
          <textarea className="input sm" rows={2} autoFocus placeholder="What still needs deciding?" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn sm primary" disabled={!text.trim()}>Add question</button>
        </form>
      )}
      {open.map((q) => <QuestionItem key={q.id} q={q} />)}
      {open.length === 0 && !adding && <p className="muted small">Nothing open.</p>}
      {done.length > 0 && (
        <>
          <button className="linklike small" onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Hide' : 'Show'} {done.length} decided
          </button>
          {showDone && done.map((q) => <QuestionItem key={q.id} q={q} />)}
        </>
      )}
    </div>
  );
}
