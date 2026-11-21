import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { applyUpdate, useAppStatus } from '../lib/appUpdate';

/** Shown anywhere in the app when a newer version has been deployed. */
export function UpdateToast() {
  const { updateAvailable } = useAppStatus();
  const [dismissed, setDismissed] = useState(false);
  if (!updateAvailable || dismissed) return null;
  return (
    <div className="toast" role="status">
      <RefreshCw size={16} className="accent" />
      A new version of Signal9 Worlds is ready.
      <button className="btn sm primary" onClick={applyUpdate}>Update now</button>
      <button className="btn sm" onClick={() => setDismissed(true)}>Later</button>
    </div>
  );
}
