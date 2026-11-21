import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes, useLocation, useParams } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateToast } from './components/UpdateToast';
import { Menu } from 'lucide-react';
import { PrefsProvider } from './lib/prefs';
import { WorldProvider } from './lib/world';
import { Sidebar } from './components/Sidebar';
import { CommandPalette } from './components/CommandPalette';
import { BackupSync } from './components/BackupSync';
import { WorldsPage } from './pages/WorldsPage';
import { Dashboard } from './pages/Dashboard';
import { ArticleView } from './pages/ArticleView';
import { ArticleEdit } from './pages/ArticleEdit';
import { MapsPage } from './pages/MapsPage';
import { MapView } from './pages/MapView';
import { TimelinePage } from './pages/TimelinePage';
import { GraphPage } from './pages/GraphPage';
import { HealthPage } from './pages/HealthPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { PromptsPage } from './pages/PromptsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TrashPage } from './pages/TrashPage';
import { CanonPage } from './pages/CanonPage';
import { FamilyTreePage } from './pages/FamilyTreePage';
import { ManuscriptsPage } from './pages/ManuscriptsPage';
import { ManuscriptView } from './pages/ManuscriptView';
import { UndoToast } from './components/UndoToast';

export function App() {
  return (
    <PrefsProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<WorldsPage />} />
          <Route path="/w/:worldId/*" element={<WorldShell />} />
          <Route path="*" element={<WorldsPage />} />
        </Routes>
        <UndoToast />
      </HashRouter>
      <UpdateToast />
    </PrefsProvider>
  );
}

function WorldShell() {
  const { worldId = '' } = useParams();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <WorldProvider worldId={worldId} fallback={<div className="loading">Opening world…</div>}>
      <div className={`shell ${navOpen ? 'nav-open' : ''}`}>
        <Sidebar onSearch={() => setPaletteOpen(true)} onNavigate={() => setNavOpen(false)} />
        <div className="scrim" onClick={() => setNavOpen(false)} />
        <main className="main">
          <button className="icon-btn mobile-menu" onClick={() => setNavOpen(true)} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <ErrorBoundary resetKey={location.pathname}>
          <div className="route-anim" key={location.pathname.replace(/\/edit$/, '')}>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="a/:articleId" element={<ArticleView />} />
            <Route path="a/:articleId/edit" element={<ArticleEdit />} />
            <Route path="maps" element={<MapsPage />} />
            <Route path="maps/:mapId" element={<MapView />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="graph" element={<GraphPage />} />
            <Route path="health" element={<HealthPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="prompts" element={<PromptsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="trash" element={<TrashPage />} />
            <Route path="canon" element={<CanonPage />} />
            <Route path="family" element={<FamilyTreePage />} />
            <Route path="write" element={<ManuscriptsPage />} />
            <Route path="write/:msId" element={<ManuscriptView />} />
          </Routes>
          </div>
          </ErrorBoundary>
        </main>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      <BackupSync />
    </WorldProvider>
  );
}
