import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ImagePlus, MapPin } from 'lucide-react';
import { db, touch, uid } from '../db';
import { useWorld } from '../lib/world';
import { usePrefs } from '../lib/prefs';
import { imageFileToDataUrl } from '../lib/io';

export function MapsPage() {
  const { world } = useWorld();
  const { playerView } = usePrefs();
  const navigate = useNavigate();
  const maps = useLiveQuery(() => db.maps.where('worldId').equals(world.id).sortBy('createdAt'), [world.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Maps</h1>
          <p className="lead">Upload any image: a continent, a city, a dungeon. Drop pins that link to articles or to other maps.</p>
        </div>
        <label className={`btn primary ${busy ? 'disabled' : ''}`}>
          <ImagePlus size={16} /> {busy ? 'Loading…' : 'New map from image'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              setBusy(true);
              setError('');
              try {
                const { url, width, height } = await imageFileToDataUrl(f, 4096);
                const id = uid();
                await db.maps.add({ id, worldId: world.id, name: f.name.replace(/\.[^.]+$/, ''), image: url, width, height, pins: [], createdAt: Date.now() });
                await touch(world.id);
                navigate(`/w/${world.id}/maps/${id}`);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="map-grid">
        {maps?.map((m) => (
          <Link key={m.id} to={`/w/${world.id}/maps/${m.id}`} className="card map-card">
            <div className="map-thumb" style={{ backgroundImage: `url("${m.image.replace(/"/g, '%22')}")` }} />
            <div className="row">
              <b className="grow ellipsis">{m.name}</b>
              <span className="muted small">
                <MapPin size={12} /> {m.pins.filter((p) => !(playerView && p.gmOnly)).length}
              </span>
            </div>
          </Link>
        ))}
      </div>
      {maps && maps.length === 0 && <p className="muted">No maps yet. Any PNG, JPG, WebP or SVG works; drawn, generated or scanned.</p>}
    </div>
  );
}
