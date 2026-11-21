import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { BadgeCheck, CircleHelp, Plus, Quote } from 'lucide-react';
import { db, type CanonStatus } from '../db';
import { useWorld } from '../lib/world';
import { CANON_META, CANON_ORDER } from '../lib/canon';
import { canonBlocks, plainExcerpt } from '../lib/markdown';
import { ArticlePicker } from '../components/ArticlePicker';
import { QuestionItem, addQuestion } from '../components/QuestionsBox';
import { CanonBadge } from '../components/Canon';
import { TemplateIcon } from '../icons';

type Tab = 'questions' | 'articles' | 'passages';

export function CanonPage() {
  const { world, allArticles, templateById } = useWorld();
  const questions = useLiveQuery(() => db.questions.where('worldId').equals(world.id).toArray(), [world.id]) ?? [];
  const [tab, setTab] = useState<Tab>('questions');
  const [qFilter, setQFilter] = useState<'open' | 'decided' | 'dropped' | 'all'>('open');
  const [text, setText] = useState('');
  const [about, setAbout] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CanonStatus | 'unmarked' | null>(null);
  const base = `/w/${world.id}`;

  const byStatus = useMemo(() => {
    const m = new Map<CanonStatus | 'unmarked', typeof allArticles>();
    for (const a of allArticles) {
      const k = a.canon ?? 'unmarked';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    for (const list of m.values()) list.sort((x, y) => x.title.localeCompare(y.title));
    return m;
  }, [allArticles]);

  const passages = useMemo(() => {
    const out: { article: (typeof allArticles)[number]; where: string; kind: CanonStatus; label: string; text: string }[] = [];
    for (const a of allArticles) {
      const t = templateById.get(a.templateId);
      for (const b of canonBlocks(a.body)) out.push({ article: a, where: 'Article text', ...b });
      for (const fl of t?.fields ?? []) {
        for (const b of canonBlocks(a.fields[fl.key] ?? '')) out.push({ article: a, where: fl.label, ...b });
        const st = a.fieldCanon?.[fl.key];
        if (st && a.fields[fl.key]?.trim()) out.push({ article: a, where: fl.label, kind: st, label: '', text: a.fields[fl.key] });
      }
    }
    return out;
  }, [allArticles, templateById]);

  const shownQs = questions
    .filter((q) => qFilter === 'all' || q.status === qFilter)
    .sort((a, b) => (a.status === b.status ? b.createdAt - a.createdAt : a.status === 'open' ? -1 : 1));
  const openCount = questions.filter((q) => q.status === 'open').length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Canon & questions</h1>
          <p className="lead">What is settled, what is still a proposal, and what you haven't decided yet.</p>
        </div>
      </header>

      <div className="canon-summary stagger">
        {CANON_ORDER.map((s) => (
          <button key={s} className="canon-stat" style={{ ['--cc' as string]: CANON_META[s].color }} onClick={() => (setTab('articles'), setStatusFilter(s))}>
            <b>{byStatus.get(s)?.length ?? 0}</b>
            <span><span className="canon-dot" /> {CANON_META[s].label}</span>
          </button>
        ))}
        <button className="canon-stat" style={{ ['--cc' as string]: '#7fa6e8' }} onClick={() => setTab('questions')}>
          <b>{openCount}</b>
          <span><CircleHelp size={12} /> Open questions</span>
        </button>
      </div>

      <div className="seg" style={{ marginBottom: 18 }}>
        <button className={tab === 'questions' ? 'on' : ''} onClick={() => setTab('questions')}><CircleHelp size={14} /> Questions</button>
        <button className={tab === 'articles' ? 'on' : ''} onClick={() => setTab('articles')}><BadgeCheck size={14} /> Articles by status</button>
        <button className={tab === 'passages' ? 'on' : ''} onClick={() => setTab('passages')}><Quote size={14} /> Marked passages ({passages.length})</button>
      </div>

      {tab === 'questions' && (
        <div className="two-col canon-q">
          <section className="card">
            <div className="row" style={{ marginBottom: 10 }}>
              <h2 className="grow" style={{ margin: 0 }}>Questions</h2>
              <div className="seg">
                {(['open', 'decided', 'dropped', 'all'] as const).map((f) => (
                  <button key={f} className={qFilter === f ? 'on' : ''} onClick={() => setQFilter(f)} style={{ textTransform: 'capitalize' }}>{f}</button>
                ))}
              </div>
            </div>
            {shownQs.map((q) => <QuestionItem key={q.id} q={q} showArticle />)}
            {shownQs.length === 0 && <p className="muted">{qFilter === 'open' ? 'No open questions. Everything is decided, or nothing has been asked yet.' : 'Nothing here.'}</p>}
          </section>
          <section className="card">
            <h2><Plus size={16} /> Ask a question</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!text.trim()) return;
                await addQuestion(world.id, text, about);
                setText('');
              }}
            >
              <textarea className="input" rows={3} placeholder="e.g. Is human–Ilyr offspring possible? What is Lake Tharil's outlet river?" value={text} onChange={(e) => setText(e.target.value)} />
              <div className="field" style={{ marginTop: 10 }}>
                <span>About (optional)</span>
                <ArticlePicker value={about} onChange={setAbout} placeholder="The whole world" />
              </div>
              <button className="btn primary" disabled={!text.trim()}>Add question</button>
            </form>
            <p className="muted small" style={{ marginTop: 14 }}>
              Questions attached to an article also appear on that article. When you decide, record the answer; the question stays as a record of the decision.
            </p>
          </section>
        </div>
      )}

      {tab === 'articles' && (
        <>
          <div className="chips" style={{ marginBottom: 14 }}>
            <button className={`chip ${statusFilter === null ? 'chip-on' : ''}`} onClick={() => setStatusFilter(null)}>All</button>
            {[...CANON_ORDER, 'unmarked' as const].map((s) => (
              <button key={s} className={`chip ${statusFilter === s ? 'chip-on' : ''}`} onClick={() => setStatusFilter(s)}>
                {s === 'unmarked' ? 'Unmarked' : CANON_META[s].label} · {byStatus.get(s)?.length ?? 0}
              </button>
            ))}
          </div>
          <div className="canon-board">
            {[...CANON_ORDER, 'unmarked' as const]
              .filter((s) => (statusFilter ? s === statusFilter : true) && (byStatus.get(s)?.length ?? 0) > 0)
              .map((s) => (
                <section key={s} className="card canon-col" style={{ ['--cc' as string]: s === 'unmarked' ? 'var(--line-2)' : CANON_META[s].color }}>
                  <h3>
                    {s === 'unmarked' ? 'Unmarked' : CANON_META[s].label} <span className="muted small">{byStatus.get(s)!.length}</span>
                  </h3>
                  {s !== 'unmarked' && <p className="muted small">{CANON_META[s].meaning}</p>}
                  <ul className="plain-list">
                    {byStatus.get(s)!.map((a) => {
                      const t = templateById.get(a.templateId);
                      return (
                        <li key={a.id}>
                          <Link className="list-link" to={`${base}/a/${a.id}`}>
                            <TemplateIcon name={t?.icon} size={13} color={t?.color} /> <span className="ellipsis grow">{a.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
          </div>
        </>
      )}

      {tab === 'passages' && (
        <div className="passages">
          {passages.length === 0 && (
            <p className="muted">
              No marked passages yet. In the editor, select text and use <b>Mark as…</b> (or type <code>:::provisional</code> … <code>:::</code>), or click the dot beside any field.
            </p>
          )}
          {CANON_ORDER.map((s) => {
            const list = passages.filter((p) => p.kind === s);
            if (!list.length) return null;
            return (
              <section key={s} className="card" style={{ marginBottom: 14 }}>
                <h3><CanonBadge status={s} /> <span className="muted small">{list.length}</span></h3>
                {list.map((p, i) => (
                  <Link key={i} to={`${base}/a/${p.article.id}`} className="passage">
                    <div className="small">
                      <b>{p.article.title}</b> <span className="muted">› {p.where}{p.label ? ` · ${p.label}` : ''}</span>
                    </div>
                    <div className="muted small">{plainExcerpt(p.text.startsWith('[[') && p.text.includes('],[') ? p.text.replace(/[[\]"]/g, ' ') : p.text, 180)}</div>
                  </Link>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
