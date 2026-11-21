import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Download, FileArchive, HardDrive, Link2, Trash2, Unlink } from 'lucide-react';
import { db, deleteWorld } from '../db';
import { useWorld } from '../lib/world';
import {
  downloadMarkdownZip, downloadPlayerWiki, downloadWorldJson, fileSyncSupported, linkBackupFile, unlinkBackupFile, writeBackup,
} from '../lib/io';
import { timeAgo } from '../lib/actions';

export function SettingsPage() {
  const { world, allArticles } = useWorld();
  const navigate = useNavigate();
  const [name, setName] = useState(world.name);
  const [desc, setDesc] = useState(world.description);
  const [msg, setMsg] = useState('');
  const handle = useLiveQuery(() => db.kv.get(`backup:${world.id}`), [world.id]);
  const lastBackup = useLiveQuery(() => db.kv.get(`backupAt:${world.id}`), [world.id]);
  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      setMsg(`${label}…`);
      await fn();
      setMsg(`${label}: done.`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return setMsg('');
      setMsg(`${label} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>Settings & export</h1>
      </header>

      <section className="card">
        <h2>World</h2>
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && db.worlds.update(world.id, { name: name.trim() })} />
        </label>
        <label className="field">
          <span>Tagline</span>
          <textarea className="input" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => db.worlds.update(world.id, { description: desc })} />
        </label>
        <label className="field">
          <span>Year label (shown after dates, e.g. “AS” or “Third Age”)</span>
          <input className="input" value={world.yearSuffix} onChange={(e) => db.worlds.update(world.id, { yearSuffix: e.target.value })} />
        </label>
      </section>

      <section className="card">
        <h2>Your data, your files</h2>
        <p className="muted">Everything lives in this browser. Export often, or link a backup file below (for example inside your OneDrive or Dropbox folder).</p>
        <div className="export-grid">
          <button className="export" onClick={() => run('World file', () => downloadWorldJson(world.id))}>
            <Download size={20} />
            <b>World file (.json)</b>
            <span>Complete backup. Import it on any device.</span>
          </button>
          <button className="export" onClick={() => run('Markdown vault', () => downloadMarkdownZip(world.id))}>
            <FileArchive size={20} />
            <b>Markdown vault (.zip)</b>
            <span>One file per article. Opens in Obsidian, VS Code, anything.</span>
          </button>
          <button className="export" onClick={() => run('Player wiki', () => downloadPlayerWiki(world.id))}>
            <BookOpen size={20} />
            <b>Player wiki (.html)</b>
            <span>One file to share with players. Secrets and GM-only articles are stripped out.</span>
          </button>
        </div>
      </section>

      <section className="card">
        <h2>
          <HardDrive size={16} /> Automatic backup file
        </h2>
        {!fileSyncSupported() ? (
          <p className="muted">Your browser can't write to files directly. Use Chrome or Edge for automatic backups, or download the world file above.</p>
        ) : handle ? (
          <>
            <p>
              Linked to <b>{(handle.value as FileSystemFileHandle).name}</b>. It is rewritten a few seconds after each change while this world is open.
              {lastBackup && <span className="muted"> Last written {timeAgo(lastBackup.value as number)}.</span>}
            </p>
            <div className="row">
              <button className="btn" onClick={() => run('Backup', () => writeBackup(world.id))}>Write now</button>
              <button className="btn" onClick={() => unlinkBackupFile(world.id)}>
                <Unlink size={14} /> Unlink
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">Pick a file once; Signal9 keeps it up to date. Put it in a synced folder and your world is backed up off-device too.</p>
            <button className="btn primary" onClick={() => run('Link backup file', () => linkBackupFile(world.id, world.name))}>
              <Link2 size={14} /> Choose backup file…
            </button>
          </>
        )}
      </section>
      {msg && <p className="muted">{msg}</p>}

      <section className="card danger-zone">
        <h2>Danger zone</h2>
        <button
          className="btn danger"
          onClick={async () => {
            const typed = prompt(`This permanently deletes “${world.name}” and its ${allArticles.length} articles from this browser.\nType the world name to confirm:`);
            if (typed?.trim() !== world.name.trim()) return;
            await deleteWorld(world.id);
            navigate('/');
          }}
        >
          <Trash2 size={14} /> Delete this world
        </button>
      </section>
    </div>
  );
}
