import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Flame, NotebookPen, Plus } from 'lucide-react';
import { db } from '../db';
import { useWorld } from '../lib/world';
import { createManuscript, streak, todayWords, totalWords } from '../lib/manuscript';
import { timeAgo } from '../lib/actions';

export function ManuscriptsPage() {
  const { world } = useWorld();
  const navigate = useNavigate();
  const manuscripts = useLiveQuery(() => db.manuscripts.where('worldId').equals(world.id).toArray(), [world.id]);
  const nodes = useLiveQuery(() => db.scenes.where('worldId').equals(world.id).toArray(), [world.id]) ?? [];
  const [title, setTitle] = useState('');

  const make = async () => {
    if (!title.trim()) return;
    const { ms, scene } = await createManuscript(world.id, title.trim());
    navigate(`/w/${world.id}/write/${ms.id}?scene=${scene.id}`);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Manuscripts</h1>
          <p className="lead">Write your novels, novellas and campaign journals right next to your lore. Every [[link]] in a scene stays live.</p>
        </div>
      </header>
      <section className="card new-world" style={{ marginBottom: 22 }}>
        <form className="row" onSubmit={(e) => (e.preventDefault(), make())}>
          <input className="input grow" placeholder="Title of your book, e.g. The Glass Tide" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn primary" disabled={!title.trim()}>
            <Plus size={16} /> New manuscript
          </button>
        </form>
      </section>
      <div className="ms-grid stagger">
        {manuscripts?.map((ms) => {
          const mine = nodes.filter((n) => n.manuscriptId === ms.id);
          const words = totalWords(mine);
          const chapters = mine.filter((n) => n.kind === 'chapter').length;
          const scenes = mine.filter((n) => n.kind === 'scene').length;
          const pct = Math.min(100, (words / Math.max(1, ms.wordGoal)) * 100);
          const today = todayWords(ms, words);
          const s = streak(ms);
          return (
            <Link key={ms.id} to={`/w/${world.id}/write/${ms.id}`} className="card ms-card">
              <div className="ms-spine" />
              <div className="ms-body">
                <h3>{ms.title}</h3>
                {ms.subtitle && <p className="muted ms-sub">{ms.subtitle}</p>}
                <div className="ms-progress"><span style={{ width: `${pct}%` }} /></div>
                <div className="row small muted">
                  <span className="grow">
                    <b className="ms-words">{words.toLocaleString()}</b> / {ms.wordGoal.toLocaleString()} words
                  </span>
                  {s > 1 && (
                    <span className="streak"><Flame size={13} /> {s} days</span>
                  )}
                </div>
                <div className="small muted">
                  {chapters} chapter{chapters === 1 ? '' : 's'} · {scenes} scene{scenes === 1 ? '' : 's'} · {today ? `${today.toLocaleString()} words today` : `edited ${timeAgo(ms.updatedAt)}`}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {manuscripts && manuscripts.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon"><NotebookPen size={26} /></div>
          No manuscripts yet. Give your book a title above to start.
        </div>
      )}
    </div>
  );
}
