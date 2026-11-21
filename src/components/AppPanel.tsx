import { useState } from 'react';
import { Check, Download, RefreshCw } from 'lucide-react';
import { APP_VERSION, BUILD_TIME, applyUpdate, checkForUpdate, promptInstall, useAppStatus } from '../lib/appUpdate';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);

/** Version, update check and install instructions (Settings page). */
export function AppPanel() {
  const { updateAvailable, checking, lastChecked, installPrompt, installed } = useAppStatus();
  const [msg, setMsg] = useState('');

  return (
    <section className="card">
      <h2>App</h2>
      <p>
        Version <b>{APP_VERSION}</b> <span className="muted">· built {new Date(BUILD_TIME).toLocaleString()}</span>
      </p>
      <div className="row wrap">
        {updateAvailable ? (
          <button className="btn primary" onClick={applyUpdate}>
            <RefreshCw size={14} /> Update to the latest version
          </button>
        ) : (
          <button
            className="btn"
            disabled={checking}
            onClick={async () => {
              if (!import.meta.env.PROD) return setMsg('Update checks run in the published app, not the local dev server.');
              const newer = await checkForUpdate();
              setMsg(newer ? '' : 'You have the latest version.');
            }}
          >
            <RefreshCw size={14} className={checking ? 'spin' : ''} /> Check for updates
          </button>
        )}
        {installed ? (
          <span className="muted small row">
            <Check size={14} /> Installed as an app
          </span>
        ) : installPrompt ? (
          <button className="btn" onClick={promptInstall}>
            <Download size={14} /> Install as an app
          </button>
        ) : null}
      </div>
      {msg && <p className="muted small">{msg}</p>}
      {lastChecked && !msg && <p className="muted small">Last checked {new Date(lastChecked).toLocaleTimeString()}. The app also checks by itself every 30 minutes.</p>}
      {!installed && !installPrompt && (
        <p className="muted small">
          {isMac && isSafari
            ? 'To install in Safari: File → Add to Dock.'
            : 'To install: open this site in Chrome or Edge and use the install icon at the right of the address bar (or ⋮ menu → Cast, save and share → Install page as app).'}
        </p>
      )}
    </section>
  );
}
