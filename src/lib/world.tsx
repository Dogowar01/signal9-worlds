import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Ghost } from 'lucide-react';
import { db, type Article, type Relation, type Template, type Timeline, type TimelineEvent, type World, type WorldMap } from '../db';
import { buildIndex, type LinkIndex } from './links';
import { usePrefs } from './prefs';
import type { RenderCtx } from './markdown';
import { visibleUnderLens } from './canon';

interface WorldData {
  world: World;
  /** Every article (including GM-only). */
  allArticles: Article[];
  /** Articles visible in the current view mode. */
  articles: Article[];
  templates: Template[];
  templateById: Map<string, Template>;
  relations: Relation[];
  maps: WorldMap[];
  events: TimelineEvent[];
  timelines: Timeline[];
  index: LinkIndex;
  renderCtx: RenderCtx;
}

const Ctx = createContext<WorldData | null>(null);

export function WorldProvider({ worldId, children, fallback }: { worldId: string; children: ReactNode; fallback: ReactNode }) {
  const { playerView, canonLens } = usePrefs();
  const world = useLiveQuery(() => db.worlds.get(worldId), [worldId], null);
  const allArticles = useLiveQuery(() => db.articles.where('worldId').equals(worldId).toArray(), [worldId]);
  const templates = useLiveQuery(() => db.templates.where('worldId').equals(worldId).sortBy('order'), [worldId]);
  const relations = useLiveQuery(() => db.relations.where('worldId').equals(worldId).toArray(), [worldId]);
  const maps = useLiveQuery(() => db.maps.where('worldId').equals(worldId).toArray(), [worldId]);
  const events = useLiveQuery(() => db.events.where('worldId').equals(worldId).toArray(), [worldId]);
  const timelines = useLiveQuery(() => db.timelines.where('worldId').equals(worldId).toArray(), [worldId]);

  const value = useMemo<WorldData | null>(() => {
    if (!world || !allArticles || !templates || !relations || !maps || !events || !timelines) return null;
    const articles = allArticles.filter((a) => !(playerView && a.gmOnly) && (playerView ? a.canon !== 'notcanon' : visibleUnderLens(a.canon, canonLens)));
    const index = buildIndex(allArticles);
    const templateById = new Map(templates.map((t) => [t.id, t]));
    return {
      world,
      allArticles,
      articles,
      templates,
      templateById,
      relations: playerView
        ? relations.filter((r) => !index.byId.get(r.fromId)?.gmOnly && !index.byId.get(r.toId)?.gmOnly)
        : relations,
      maps,
      events,
      timelines,
      index,
      renderCtx: {
        resolve: index.resolve,
        playerView,
        canonLens,
        world,
        maps,
        events,
        timelines,
        typeOf: (a) => {
          const t = templateById.get(a.templateId);
          return t ? { name: t.name, color: t.color } : undefined;
        },
      },
    };
  }, [world, allArticles, templates, relations, maps, events, timelines, playerView, canonLens]);

  if (world === undefined)
    return (
      <div className="empty-state">
        <div className="empty-icon"><Ghost size={28} /></div>
        That world doesn't exist (any more). It may be in the trash on the home screen.
      </div>
    );
  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorld() {
  const w = useContext(Ctx);
  if (!w) throw new Error('WorldProvider missing');
  return w;
}
