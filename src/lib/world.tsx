import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Article, type Relation, type Template, type World } from '../db';
import { buildIndex, type LinkIndex } from './links';
import { usePrefs } from './prefs';
import type { RenderCtx } from './markdown';

interface WorldData {
  world: World;
  /** Every article (including GM-only). */
  allArticles: Article[];
  /** Articles visible in the current view mode. */
  articles: Article[];
  templates: Template[];
  templateById: Map<string, Template>;
  relations: Relation[];
  index: LinkIndex;
  renderCtx: RenderCtx;
}

const Ctx = createContext<WorldData | null>(null);

export function WorldProvider({ worldId, children, fallback }: { worldId: string; children: ReactNode; fallback: ReactNode }) {
  const { playerView } = usePrefs();
  const world = useLiveQuery(() => db.worlds.get(worldId), [worldId], null);
  const allArticles = useLiveQuery(() => db.articles.where('worldId').equals(worldId).toArray(), [worldId]);
  const templates = useLiveQuery(() => db.templates.where('worldId').equals(worldId).sortBy('order'), [worldId]);
  const relations = useLiveQuery(() => db.relations.where('worldId').equals(worldId).toArray(), [worldId]);

  const value = useMemo<WorldData | null>(() => {
    if (!world || !allArticles || !templates || !relations) return null;
    const articles = playerView ? allArticles.filter((a) => !a.gmOnly) : allArticles;
    const index = buildIndex(allArticles);
    return {
      world,
      allArticles,
      articles,
      templates,
      templateById: new Map(templates.map((t) => [t.id, t])),
      relations: playerView
        ? relations.filter((r) => !index.byId.get(r.fromId)?.gmOnly && !index.byId.get(r.toId)?.gmOnly)
        : relations,
      index,
      renderCtx: { resolve: index.resolve, playerView },
    };
  }, [world, allArticles, templates, relations, playerView]);

  if (world === undefined) return <div className="empty-state">That world doesn't exist (any more).</div>;
  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorld() {
  const w = useContext(Ctx);
  if (!w) throw new Error('WorldProvider missing');
  return w;
}
