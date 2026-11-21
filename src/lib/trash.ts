import {
  db, deleteArticle, deleteWorld, touch, uid, type Article, type ManuscriptNode, type Manuscript, type Relation,
  type Snapshot, type TimelineEvent, type TrashItem, type TrashKind, type WorldMap,
} from '../db';
import { exportWorld, type WorldExport } from './io';

const KEEP_DAYS = 30;

interface ArticleBundle {
  article: Article;
  relations: Relation[];
  snapshots: Snapshot[];
  childIds: string[];
  eventIds: string[];
  pins: { mapId: string; pinId: string }[];
  regions: { mapId: string; regionId: string }[];
  povScenes: string[];
  locationScenes: string[];
}

async function put(worldId: string, kind: TrashKind, label: string, data: unknown) {
  const id = uid();
  await db.trash.add({ id, worldId, kind, label, deletedAt: Date.now(), data });
  return id;
}

/** Move an article to the trash, remembering everything that pointed at it. */
export async function trashArticle(id: string) {
  const a = await db.articles.get(id);
  if (!a) return null;
  const maps = await db.maps.where('worldId').equals(a.worldId).toArray();
  const scenes = await db.scenes.where('worldId').equals(a.worldId).toArray();
  const bundle: ArticleBundle = {
    article: a,
    relations: [...(await db.relations.where('fromId').equals(id).toArray()), ...(await db.relations.where('toId').equals(id).toArray())],
    snapshots: await db.snapshots.where('articleId').equals(id).toArray(),
    childIds: (await db.articles.where('parentId').equals(id).toArray()).map((c) => c.id),
    eventIds: (await db.events.where('articleId').equals(id).toArray()).map((e) => e.id),
    pins: maps.flatMap((m) => m.pins.filter((p) => p.articleId === id).map((p) => ({ mapId: m.id, pinId: p.id }))),
    regions: maps.flatMap((m) => (m.regions ?? []).filter((r) => r.articleId === id).map((r) => ({ mapId: m.id, regionId: r.id }))),
    povScenes: scenes.filter((s) => s.povId === id).map((s) => s.id),
    locationScenes: scenes.filter((s) => s.locationId === id).map((s) => s.id),
  };
  const trashId = await put(a.worldId, 'article', a.title || 'Untitled', bundle);
  await deleteArticle(id);
  return trashId;
}

export async function trashMap(id: string) {
  const m = await db.maps.get(id);
  if (!m) return null;
  const trashId = await put(m.worldId, 'map', m.name, m);
  await db.maps.delete(id);
  await touch(m.worldId);
  return trashId;
}

export async function trashEvent(id: string) {
  const e = await db.events.get(id);
  if (!e) return null;
  const trashId = await put(e.worldId, 'event', e.title, e);
  await db.events.delete(id);
  await touch(e.worldId);
  return trashId;
}

export async function trashManuscript(id: string) {
  const m = await db.manuscripts.get(id);
  if (!m) return null;
  const nodes = await db.scenes.where('manuscriptId').equals(id).toArray();
  const trashId = await put(m.worldId, 'manuscript', m.title, { manuscript: m, nodes });
  await db.scenes.bulkDelete(nodes.map((n) => n.id));
  await db.manuscripts.delete(id);
  await touch(m.worldId);
  return trashId;
}

/** A chapter takes its scenes with it. */
export async function trashScene(id: string) {
  const n = await db.scenes.get(id);
  if (!n) return null;
  const nodes = n.kind === 'chapter' ? [n, ...(await db.scenes.where('parentId').equals(id).toArray())] : [n];
  const trashId = await put(n.worldId, 'scene', `${n.kind === 'chapter' ? 'Chapter' : 'Scene'}: ${n.title || 'Untitled'}`, nodes);
  await db.scenes.bulkDelete(nodes.map((x) => x.id));
  await touch(n.worldId);
  return trashId;
}

export async function trashWorld(worldId: string) {
  const data = await exportWorld(worldId);
  const extra = {
    snapshots: await db.snapshots.where('worldId').equals(worldId).toArray(),
  };
  const trashId = await put(worldId, 'world', data.world.name, { ...data, ...extra });
  await deleteWorld(worldId);
  return trashId;
}

/** Put a trashed item back where it was. Returns a route to open it, if any. */
export async function restoreTrash(trashId: string): Promise<string | null> {
  const t = await db.trash.get(trashId);
  if (!t) return null;
  let route: string | null = null;
  switch (t.kind) {
    case 'article': {
      const b = t.data as ArticleBundle;
      const a = b.article;
      await db.articles.put({ ...a, parentId: a.parentId && (await db.articles.get(a.parentId)) ? a.parentId : null });
      const alive = async (rid: string) => rid === a.id || !!(await db.articles.get(rid));
      for (const r of b.relations) if ((await alive(r.fromId)) && (await alive(r.toId))) await db.relations.put(r);
      if (b.snapshots.length) await db.snapshots.bulkPut(b.snapshots);
      for (const cid of b.childIds) {
        const c = await db.articles.get(cid);
        if (c && !c.parentId) await db.articles.update(cid, { parentId: a.id });
      }
      for (const eid of b.eventIds) {
        const e = await db.events.get(eid);
        if (e && !e.articleId) await db.events.update(eid, { articleId: a.id });
      }
      const mapIds = new Set([...b.pins.map((p) => p.mapId), ...b.regions.map((r) => r.mapId)]);
      for (const mid of mapIds) {
        const m = await db.maps.get(mid);
        if (!m) continue;
        const pinIds = new Set(b.pins.filter((p) => p.mapId === mid).map((p) => p.pinId));
        const regIds = new Set(b.regions.filter((r) => r.mapId === mid).map((r) => r.regionId));
        await db.maps.update(mid, {
          pins: m.pins.map((p) => (pinIds.has(p.id) && !p.articleId ? { ...p, articleId: a.id } : p)),
          regions: (m.regions ?? []).map((r) => (regIds.has(r.id) && !r.articleId ? { ...r, articleId: a.id } : r)),
        });
      }
      for (const sid of b.povScenes) await db.scenes.update(sid, { povId: a.id });
      for (const sid of b.locationScenes) await db.scenes.update(sid, { locationId: a.id });
      route = `/w/${a.worldId}/a/${a.id}`;
      break;
    }
    case 'map': {
      const m = t.data as WorldMap;
      await db.maps.put(m);
      route = `/w/${m.worldId}/maps/${m.id}`;
      break;
    }
    case 'event': {
      const e = t.data as TimelineEvent;
      if (!(await db.timelines.get(e.timelineId))) {
        const first = await db.timelines.where('worldId').equals(e.worldId).first();
        if (first) e.timelineId = first.id;
      }
      await db.events.put(e);
      route = `/w/${e.worldId}/timeline#ev-${e.id}`;
      break;
    }
    case 'manuscript': {
      const { manuscript, nodes } = t.data as { manuscript: Manuscript; nodes: ManuscriptNode[] };
      await db.manuscripts.put(manuscript);
      await db.scenes.bulkPut(nodes);
      route = `/w/${manuscript.worldId}/write/${manuscript.id}`;
      break;
    }
    case 'scene': {
      const nodes = t.data as ManuscriptNode[];
      if (!(await db.manuscripts.get(nodes[0].manuscriptId))) throw new Error('Restore the manuscript first; this scene belonged to it.');
      for (const n of nodes) {
        if (n.parentId && !nodes.some((x) => x.id === n.parentId) && !(await db.scenes.get(n.parentId))) n.parentId = null;
      }
      await db.scenes.bulkPut(nodes);
      route = `/w/${nodes[0].worldId}/write/${nodes[0].manuscriptId}`;
      break;
    }
    case 'world': {
      const d = t.data as WorldExport & { snapshots?: Snapshot[] };
      await db.transaction('rw', [db.worlds, db.articles, db.templates, db.relations, db.maps, db.timelines, db.events, db.eras, db.snapshots, db.manuscripts, db.scenes, db.questions], async () => {
        await db.worlds.put({ ...d.world, updatedAt: Date.now() });
        await db.templates.bulkPut(d.templates);
        await db.articles.bulkPut(d.articles);
        await db.relations.bulkPut(d.relations);
        await db.maps.bulkPut(d.maps);
        await db.timelines.bulkPut(d.timelines);
        await db.events.bulkPut(d.events);
        await db.eras.bulkPut(d.eras ?? []);
        await db.manuscripts.bulkPut(d.manuscripts ?? []);
        await db.scenes.bulkPut(d.scenes ?? []);
        await db.questions.bulkPut(d.questions ?? []);
        if (d.snapshots?.length) await db.snapshots.bulkPut(d.snapshots);
      });
      route = `/w/${d.world.id}`;
      break;
    }
  }
  await db.trash.delete(trashId);
  if (t.kind !== 'world') await touch(t.worldId);
  return route;
}

export async function purgeTrash(trashId: string) {
  await db.trash.delete(trashId);
}

export async function emptyTrash(worldId: string) {
  await db.trash.where('worldId').equals(worldId).filter((t) => t.kind !== 'world').delete();
}

/** Called on start-up: anything older than 30 days is removed for good. */
export async function autoPurgeTrash() {
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  await db.trash.where('deletedAt').below(cutoff).delete();
}

export const TRASH_DAYS = KEEP_DAYS;
export type { TrashItem };
