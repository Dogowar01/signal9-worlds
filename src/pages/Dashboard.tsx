import { useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, CheckCircle2, Dices, Feather, Link2Off, Lightbulb, Sprout } from 'lucide-react';
import { useWorld } from '../lib/world';
import { useCreateArticle, timeAgo } from '../lib/actions';
import { randomPrompt } from '../lib/prompts';
import { plainExcerpt } from '../lib/markdown';
import { useCountUp } from '../lib/useCountUp';
import { TemplateIcon } from '../icons';
import { WorldCover } from '../components/WorldArt';

export function Dashboard() {
  const { world, articles, templates, templateById, index } = useWorld();
  const create = useCreateArticle();
  const [prompt, setPrompt] = useState(randomPrompt);
  const base = `/w/${world.id}`;
  const recent = [...articles].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const stubs = articles.filter((a) => a.status === 'stub');
  const done = articles.filter((a) => a.status === 'done').length;
  const words = articles.reduce((n, a) => n + (a.body.match(/\S+/g)?.length ?? 0), 0);
  const ids = new Set(articles.map((a) => a.id));
  const brokenCount = new Set(index.broken.filter((b) => ids.has(b.from.id)).map((b) => b.target)).size;

  return (
    <div className="page">
      <header className="world-hero">
        <WorldCover seed={world.id} />
        <div className="world-hero-text">
          <div className="eyebrow">World overview</div>
          <h1>{world.name}</h1>
          {world.description && <p className="lead">{world.description}</p>}
        </div>
      </header>

      <div className="stats stagger">
        <Stat n={articles.length} label="articles" icon={<BookOpen size={16} />} />
        <Stat n={words} label="words written" icon={<Feather size={16} />} />
        <Stat n={done} label="finished" icon={<CheckCircle2 size={16} />} />
        <Stat n={stubs.length} label="stubs to grow" icon={<Sprout size={16} />} />
        <Link to={`${base}/health`} className="stat link">
          <span className="stat-icon"><Link2Off size={16} /></span>
          <CountUp n={brokenCount} />
          <span>unwritten links</span>
        </Link>
      </div>

      <section className="card" style={{ animation: 'fadeUp .5s .15s both' }}>
        <h2>Create something</h2>
        <div className="quick-grid">
          {templates.map((t) => (
            <button key={t.id} className="quick" onClick={() => create('Untitled', t.id)} style={{ ['--c' as string]: t.color }}>
              <span className="qi">
                <TemplateIcon name={t.icon} size={16} color={t.color} />
              </span>
              {t.name}
            </button>
          ))}
        </div>
      </section>

      <div className="two-col" style={{ animation: 'fadeUp .5s .25s both' }}>
        <section className="card">
          <h2>Recently edited</h2>
          {recent.length === 0 && <p className="muted">Nothing yet. Pick a type above to write your first article.</p>}
          <ul className="plain-list">
            {recent.map((a) => {
              const t = templateById.get(a.templateId);
              return (
                <li key={a.id}>
                  <Link to={`${base}/a/${a.id}`} className="list-link">
                    <TemplateIcon name={t?.icon} size={14} color={t?.color} />
                    <span className="ellipsis grow">{a.title}</span>
                    <span className="muted small">{timeAgo(a.updatedAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card prompt-card">
          <h2>
            <Lightbulb size={16} /> Prompt of the moment
          </h2>
          <p className="prompt-text" key={prompt} style={{ animation: 'fadeUp .4s both' }}>{prompt}</p>
          <div className="row">
            <button className="btn primary" onClick={() => create(prompt.replace(/[?.!]$/, ''), undefined, { body: `> ${prompt}\n\n` })}>
              Answer it
            </button>
            <button className="btn" onClick={() => setPrompt(randomPrompt())}>
              <Dices size={15} /> Another
            </button>
          </div>
          {stubs.length > 0 && (
            <>
              <h3 className="sub">Stubs waiting for you</h3>
              <ul className="plain-list">
                {stubs.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link to={`${base}/a/${a.id}/edit`} className="list-link">
                      <Sprout size={13} className="warn" />
                      <span className="ellipsis grow">{a.title}</span>
                      <span className="muted small ellipsis">{plainExcerpt(a.summary, 40)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function CountUp({ n }: { n: number }) {
  const v = useCountUp(n);
  return <b>{v.toLocaleString()}</b>;
}

function Stat({ n, label, icon }: { n: number; label: string; icon: React.ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-icon">{icon}</span>
      <CountUp n={n} />
      <span>{label}</span>
    </div>
  );
}
