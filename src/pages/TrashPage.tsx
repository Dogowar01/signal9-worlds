import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, FileText, Map as MapIcon, NotebookPen, RotateCcw, Trash2, X } from 'lucide-react';
import { db, type TrashKind } from '../db';
import { useWorld } from '../lib/world';
import { TRASH_DAYS, emptyTrash, purgeTrash, restoreTrash } from '../lib/trash';
import { timeAgo } from '../lib/actions';

export const TRASH_ICON: Record<TrashKind, React.ReactNode> = {
  article: <FileText size={15} />,
  map: <MapIcon size={15} />,
  event: <CalendarDays size={15} />,
  manuscript: <NotebookPen size={15} />,
  scene: <NotebookPen size={15} />,
  world: <MapIcon size={15} />,
};

export function TrashPage() {
  const { world } = useWorld();
  const navigate = useNavigate();
  const items = useLiveQuery(
    () => db.trash.where('worldId').equals(world.id).filter((t) => t.kind !== 'world').reverse().sortBy('deletedAt'),
    [world.id],
  );
  const [error, setError] = useState('');

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Trash</h1>
          <p className="lead">Deleted articles, maps, events and manuscripts wait here for {TRASH_DAYS} days before they're gone for good.</p>
        </div>
        {items && items.length > 0 && (
          <button
            className="btn danger"
            onClick={async () => {
              if (confirm(`Permanently delete all ${items.length} item(s) in the trash? This can't be undone.`)) await emptyTrash(world.id);
            }}
          >
            <Trash2 size={15} /> Empty trash
          </button>
        )}
      </header>
      {error && <p className="error">{error}</p>}
      <div className="card trash-list stagger">
        {items?.map((t) => (
          <div key={t.id} className="trash-row">
            <span className="trash-icon">{TRASH_ICON[t.kind]}</span>
            <div className="grow">
              <b>{t.label}</b>
              <div className="muted small">
                {t.kind} · deleted {timeAgo(t.deletedAt)} · {Math.max(0, TRASH_DAYS - Math.floor((Date.now() - t.deletedAt) / 86_400_000))} days left
              </div>
            </div>
            <button
              className="btn sm"
              onClick={async () => {
                try {
                  setError('');
                  const route = await restoreTrash(t.id);
                  if (route) navigate(route);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              <RotateCcw size={13} /> Restore
            </button>
            <button
              className="icon-btn sm danger"
              title="Delete forever"
              onClick={async () => confirm(`Permanently delete “${t.label}”? This can't be undone.`) && purgeTrash(t.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {items && items.length === 0 && (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-icon"><Trash2 size={26} /></div>
            The trash is empty.
          </div>
        )}
      </div>
    </div>
  );
}
