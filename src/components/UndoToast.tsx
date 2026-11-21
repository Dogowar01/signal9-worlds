import { useNavigate } from 'react-router';
import { Trash2, Undo2 } from 'lucide-react';
import { clearUndo, useUndo } from '../lib/undo';
import { restoreTrash } from '../lib/trash';

export function UndoToast() {
  const u = useUndo();
  const navigate = useNavigate();
  if (!u) return null;
  return (
    <div className="toast undo-toast" key={u.key} role="status">
      <Trash2 size={15} className="muted" />
      <span className="ellipsis" style={{ maxWidth: 260 }}>
        Moved <b>{u.label}</b> to the trash
      </span>
      <button
        className="btn sm primary"
        onClick={async () => {
          clearUndo();
          const route = await restoreTrash(u.trashId);
          if (route) navigate(route);
        }}
      >
        <Undo2 size={14} /> Undo
      </button>
      <span className="undo-timer" />
    </div>
  );
}
