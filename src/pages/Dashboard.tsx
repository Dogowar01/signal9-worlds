import { useState } from 'react';
import { Link } from 'react-router';
import { Dices, HeartPulse, Lightbulb } from 'lucide-react';
import { useWorld } from '../lib/world';
import { useCreateArticle, timeAgo } from '../lib/actions';
import { randomPrompt } from '../lib/prompts';
import { plainExcerpt } from '../lib/markdown';
import { TemplateIcon } from '../icons';

export function Dashboard() {
  const { world, articles, templates, templateById, index } = useWorld();
  const create = useCreateArticle();
  const [prompt, setPrompt] = useState(randomPrompt);
  const base = `/w/${world.id}`;
  const recent = [...articles].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const stubs = articles.filter((a) => a.status === 'stub');
  const done = articles.filter((a) => a.status === 'done').length;
  const words = articles.reduce((n, a) => n + (a.body.match(/\S+/g)?.length ?? 0), 0);
  const brokenCount = index.broken.filter((b) => articles.includes(b.from)).length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{world.name}</h1>
          {world.description && <p className="lead">{world.description}</p>}
        </div>
      </header>

      <div className="stats">
        <Stat n={articles.length} label="articles" />
        <Stat n={words.toLocaleString()} label="words" />
        <Stat n={done} label="finished" />
        <Stat n={stubs.length} label="stubs to grow" />
        <Link to={`${base}/health`} className="stat link">
          <HeartPulse size={16} />
          <b>{brokenCount}</b>
          <span>unwritten links</span>
        </Link>
      </div>

      <section className="card">
        <h2>Quick create</h2>
        <div className="quick-grid">
          {templates.map((t) => (
            <button key={t.id} className="quick" onClick={() => create('Untitled', t.id)} style={{ ['--c' as string]: t.color }}>
              <TemplateIcon name={t.icon} size={18} color={t.color} />
              {t.name}
            </button>
          ))}
        </div>
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Recently edited</h2>
          {recent.length === 0 && <p className="muted">Nothing yet.</p>}
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

        <section className="card">
          <h2>
            <Lightbulb size={16} /> Prompt of the moment
          </h2>
          <p className="prompt-text">{prompt}</p>
          <div className="row">
            <button
              className="btn primary"
              onClick={() => create(prompt.replace(/[?.!]$/, ''), undefined, { body: `> ${prompt}\n\n` })}
            >
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

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="stat">
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}
