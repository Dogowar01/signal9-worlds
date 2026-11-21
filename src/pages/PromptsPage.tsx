import { useState } from 'react';
import { Dices, Lightbulb, UserPlus } from 'lucide-react';
import { useWorld } from '../lib/world';
import { useCreateArticle } from '../lib/actions';
import { generateName, NAME_STYLES, PROMPTS, randomPrompt } from '../lib/prompts';
import { Link } from 'react-router';

export function PromptsPage() {
  const { world, templates, articles } = useWorld();
  const create = useCreateArticle();
  const [prompt, setPrompt] = useState(randomPrompt);
  const [style, setStyle] = useState(NAME_STYLES[0]);
  const [names, setNames] = useState(() => Array.from({ length: 12 }, () => generateName(NAME_STYLES[0])));
  const character = templates.find((t) => t.name === 'Character')?.id;
  const stub = articles.filter((a) => a.status === 'stub');
  const [stubPick, setStubPick] = useState(() => stub[Math.floor(Math.random() * stub.length)]?.id);
  const picked = articles.find((a) => a.id === stubPick);

  const answer = (p: string) => create(p.replace(/[?.!]$/, ''), undefined, { body: `> ${p}\n\n` });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Prompts & names</h1>
          <p className="lead">For when the page is blank. Answer a prompt and it becomes a note you can link from anywhere.</p>
        </div>
      </header>
      <div className="two-col">
        <section className="card">
          <h2><Lightbulb size={16} /> Prompt</h2>
          <p className="prompt-text">{prompt}</p>
          <div className="row">
            <button className="btn primary" onClick={() => answer(prompt)}>Answer it</button>
            <button className="btn" onClick={() => setPrompt(randomPrompt())}><Dices size={15} /> Another</button>
          </div>
          {picked && (
            <>
              <h3 className="sub">Or grow a stub</h3>
              <p>
                <Link to={`/w/${world.id}/a/${picked.id}/edit`}>{picked.title}</Link> is still a stub.{' '}
                <button className="linklike" onClick={() => setStubPick(stub[Math.floor(Math.random() * stub.length)]?.id)}>Pick another</button>
              </p>
            </>
          )}
        </section>
        <section className="card">
          <h2><Dices size={16} /> Name generator</h2>
          <div className="seg wrap">
            {NAME_STYLES.map((s) => (
              <button key={s} className={style === s ? 'on' : ''} onClick={() => (setStyle(s), setNames(Array.from({ length: 12 }, () => generateName(s))))}>
                {s}
              </button>
            ))}
          </div>
          <div className="name-grid">
            {names.map((n, i) => (
              <button key={i} className="chip" title="Create a character with this name" onClick={() => create(n, character)}>
                <UserPlus size={12} /> {n}
              </button>
            ))}
          </div>
          <button className="btn" onClick={() => setNames(Array.from({ length: 12 }, () => generateName(style)))}>
            <Dices size={15} /> Reroll
          </button>
        </section>
      </div>
      <section className="card">
        <h2>All prompts</h2>
        <ul className="prompt-list">
          {PROMPTS.map((p) => (
            <li key={p}>
              <button className="linklike" onClick={() => answer(p)}>{p}</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
