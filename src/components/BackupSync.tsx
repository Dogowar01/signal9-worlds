import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useWorld } from '../lib/world';
import { backupPermission, getBackupHandle, writeBackup } from '../lib/io';

/** Silently keeps a linked backup file up to date while the world is open. */
export function BackupSync() {
  const { world } = useWorld();
  const handleRow = useLiveQuery(() => db.kv.get(`backup:${world.id}`), [world.id]);
  const [needsPermission, setNeedsPermission] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!handleRow) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const h = await getBackupHandle(world.id);
      if (!h) return;
      const p = await backupPermission(h, false);
      if (p !== 'granted') {
        setNeedsPermission(true);
        return;
      }
      try {
        await writeBackup(world.id, h);
      } catch (err) {
        console.warn('Backup write failed', err);
      }
    }, 2500);
    return () => window.clearTimeout(timer.current);
  }, [world.updatedAt, handleRow, world.id]);

  if (!needsPermission) return null;
  return (
    <div className="toast">
      Your linked backup file needs permission again.
      <button
        className="btn sm primary"
        onClick={async () => {
          const h = await getBackupHandle(world.id);
          if (h && (await backupPermission(h, true)) === 'granted') {
            setNeedsPermission(false);
            await writeBackup(world.id, h);
          }
        }}
      >
        Reconnect
      </button>
      <button className="btn sm" onClick={() => setNeedsPermission(false)}>Later</button>
    </div>
  );
}
