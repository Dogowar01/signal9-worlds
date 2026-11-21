import Dexie, { type Table } from 'dexie';
import { defaultTemplates } from './templates';

export type FieldType = 'text' | 'textarea';
export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
}

export interface Template {
  id: string;
  worldId: string;
  name: string;
  icon: string;
  color: string;
  fields: TemplateField[];
  order: number;
}

export type Status = 'stub' | 'draft' | 'done';

export interface Article {
  id: string;
  worldId: string;
  title: string;
  aliases: string[];
  templateId: string;
  fields: Record<string, string>;
  summary: string;
  body: string;
  tags: string[];
  parentId: string | null;
  status: Status;
  gmOnly: boolean;
  pinned: boolean;
  image?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Relation {
  id: string;
  worldId: string;
  fromId: string;
  toId: string;
  type: string;
}

export interface Pin {
  id: string;
  x: number; // 0..1 relative to image width
  y: number; // 0..1 relative to image height
  label: string;
  articleId?: string | null;
  mapId?: string | null;
  color: string;
  gmOnly?: boolean;
  note?: string;
  layerId?: string | null;
}

export interface MapLayer {
  id: string;
  name: string;
  /** Optional overlay image, drawn on top of the base map at the same size. */
  image?: string | null;
  opacity: number;
  gmOnly?: boolean;
  /** Hidden when the map first opens. */
  hidden?: boolean;
}

export interface Region {
  id: string;
  name: string;
  points: [number, number][]; // 0..1 relative to image size
  color: string;
  articleId?: string | null;
  layerId?: string | null;
  gmOnly?: boolean;
  /** Fog of war: an opaque cover in player view, a hatched outline for the GM. */
  fog?: boolean;
  note?: string;
}

export interface WorldMap {
  id: string;
  worldId: string;
  name: string;
  image: string;
  width: number;
  height: number;
  pins: Pin[];
  layers?: MapLayer[];
  regions?: Region[];
  parentMapId?: string | null;
  createdAt: number;
}

export interface Timeline {
  id: string;
  worldId: string;
  name: string;
  color: string;
}

export interface TimelineEvent {
  id: string;
  worldId: string;
  timelineId: string;
  title: string;
  year: number;
  /** 1-based month and day in the world's calendar (optional). */
  month?: number | null;
  day?: number | null;
  endYear?: number | null;
  articleId?: string | null;
  description: string;
  gmOnly: boolean;
}

export interface Era {
  id: string;
  worldId: string;
  name: string;
  start: number;
  end: number;
  color: string;
}

export interface World {
  id: string;
  name: string;
  description: string;
  yearSuffix: string;
  calendar?: WorldCalendar;
  createdAt: number;
  updatedAt: number;
}

export interface CalendarMonth {
  name: string;
  days: number;
}
export interface CalendarMoon {
  name: string;
  /** Days from one full moon to the next. */
  cycle: number;
  /** Shifts the phase so the moon can be full on a chosen day. */
  offset: number;
  color?: string;
}
export interface WorldCalendar {
  months: CalendarMonth[];
  weekdays: string[];
  moons: CalendarMoon[];
  /** Weekday of day 1, month 1, year 0. */
  weekdayOffset: number;
}

export type SceneStatus = 'idea' | 'draft' | 'revised' | 'final';

export interface Manuscript {
  id: string;
  worldId: string;
  title: string;
  subtitle: string;
  wordGoal: number;
  dailyGoal: number;
  /** Total words at the end of each day, keyed YYYY-MM-DD. */
  history: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface ManuscriptNode {
  id: string;
  worldId: string;
  manuscriptId: string;
  /** Chapter id for scenes, null for chapters. */
  parentId: string | null;
  kind: 'chapter' | 'scene';
  title: string;
  synopsis: string;
  body: string;
  order: number;
  status: SceneStatus;
  povId?: string | null;
  locationId?: string | null;
  updatedAt: number;
}

export type TrashKind = 'article' | 'map' | 'event' | 'world' | 'manuscript' | 'scene';
export interface TrashItem {
  id: string;
  worldId: string;
  kind: TrashKind;
  label: string;
  deletedAt: number;
  data: unknown;
}

export interface Snapshot {
  id: string;
  worldId: string;
  articleId: string;
  title: string;
  body: string;
  fields: Record<string, string>;
  at: number;
}

export interface KV {
  key: string;
  value: unknown;
}

class WorldsDB extends Dexie {
  worlds!: Table<World, string>;
  articles!: Table<Article, string>;
  templates!: Table<Template, string>;
  relations!: Table<Relation, string>;
  maps!: Table<WorldMap, string>;
  timelines!: Table<Timeline, string>;
  events!: Table<TimelineEvent, string>;
  eras!: Table<Era, string>;
  snapshots!: Table<Snapshot, string>;
  kv!: Table<KV, string>;
  trash!: Table<TrashItem, string>;
  manuscripts!: Table<Manuscript, string>;
  scenes!: Table<ManuscriptNode, string>;

  constructor() {
    super('signal9-worlds');
    this.version(1).stores({
      worlds: 'id, updatedAt',
      articles: 'id, worldId, templateId, parentId, updatedAt',
      templates: 'id, worldId',
      relations: 'id, worldId, fromId, toId',
      maps: 'id, worldId',
      timelines: 'id, worldId',
      events: 'id, worldId, timelineId, articleId',
      eras: 'id, worldId',
      snapshots: 'id, articleId, worldId, at',
      kv: 'key',
    });
    this.version(2).stores({
      trash: 'id, worldId, deletedAt',
      manuscripts: 'id, worldId',
      scenes: 'id, worldId, manuscriptId, parentId',
    });
  }
}

export const db = new WorldsDB();

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Mark a world as changed (drives "recently edited" and linked-file autosave). */
export function touch(worldId: string) {
  return db.worlds.update(worldId, { updatedAt: Date.now() });
}

// ---------- Worlds ----------

export async function createWorld(name: string, description = ''): Promise<World> {
  const now = Date.now();
  const world: World = { id: uid(), name, description, yearSuffix: '', createdAt: now, updatedAt: now };
  await db.transaction('rw', db.worlds, db.templates, db.timelines, async () => {
    await db.worlds.add(world);
    await db.templates.bulkAdd(defaultTemplates().map((t, i) => ({ ...t, id: uid(), worldId: world.id, order: i })));
    await db.timelines.add({ id: uid(), worldId: world.id, name: 'History', color: '#e0a458' });
  });
  return world;
}

export async function deleteWorld(worldId: string) {
  await db.transaction(
    'rw',
    [db.worlds, db.articles, db.templates, db.relations, db.maps, db.timelines, db.events, db.eras, db.snapshots, db.kv, db.manuscripts, db.scenes, db.trash],
    async () => {
      await db.worlds.delete(worldId);
      for (const t of [db.articles, db.templates, db.relations, db.maps, db.timelines, db.events, db.eras, db.snapshots, db.manuscripts, db.scenes]) {
        await (t as Table<{ worldId: string }, string>).where('worldId').equals(worldId).delete();
      }
      // items in this world's trash go too (a trashed copy of the world itself is kept)
      await db.trash.where('worldId').equals(worldId).filter((t) => t.kind !== 'world').delete();
      await db.kv.delete(`backup:${worldId}`);
    },
  );
}

// ---------- Articles ----------

export async function createArticle(
  worldId: string,
  init: Partial<Article> & { title: string; templateId: string },
): Promise<Article> {
  const now = Date.now();
  const article: Article = {
    id: uid(),
    worldId,
    aliases: [],
    fields: {},
    summary: '',
    body: '',
    tags: [],
    parentId: null,
    status: 'stub',
    gmOnly: false,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    ...init,
  };
  await db.articles.add(article);
  await touch(worldId);
  return article;
}

export async function updateArticle(id: string, changes: Partial<Article>) {
  const a = await db.articles.get(id);
  if (!a) return;
  await db.articles.update(id, { ...changes, updatedAt: Date.now() });
  await touch(a.worldId);
}

export async function deleteArticle(id: string) {
  const a = await db.articles.get(id);
  if (!a) return;
  await db.transaction('rw', [db.articles, db.relations, db.snapshots, db.maps, db.events, db.worlds, db.scenes], async () => {
    await db.articles.delete(id);
    await db.scenes.where('worldId').equals(a.worldId).filter((s) => s.povId === id || s.locationId === id)
      .modify((s) => { if (s.povId === id) s.povId = null; if (s.locationId === id) s.locationId = null; });
    await db.relations.where('fromId').equals(id).delete();
    await db.relations.where('toId').equals(id).delete();
    await db.snapshots.where('articleId').equals(id).delete();
    await db.articles.where('parentId').equals(id).modify({ parentId: null });
    await db.events.where('articleId').equals(id).modify({ articleId: null });
    const maps = await db.maps.where('worldId').equals(a.worldId).toArray();
    for (const m of maps) {
      if (m.pins.some((p) => p.articleId === id) || m.regions?.some((r) => r.articleId === id)) {
        await db.maps.update(m.id, {
          pins: m.pins.map((p) => (p.articleId === id ? { ...p, articleId: null } : p)),
          regions: (m.regions ?? []).map((r) => (r.articleId === id ? { ...r, articleId: null } : r)),
        });
      }
    }
    await touch(a.worldId);
  });
}

/** Save a version of an article so it can be restored later. Keeps the newest 30. */
export async function snapshotArticle(a: Article) {
  await db.snapshots.add({
    id: uid(),
    worldId: a.worldId,
    articleId: a.id,
    title: a.title,
    body: a.body,
    fields: { ...a.fields },
    at: Date.now(),
  });
  const all = await db.snapshots.where('articleId').equals(a.id).sortBy('at');
  if (all.length > 30) await db.snapshots.bulkDelete(all.slice(0, all.length - 30).map((s) => s.id));
}

/** Rewrite [[Old Title]] / [[Old Title|alias]] links across the world after a rename. */
export async function propagateRename(worldId: string, oldTitle: string, newTitle: string, skipId?: string) {
  if (!oldTitle.trim() || oldTitle.trim().toLowerCase() === newTitle.trim().toLowerCase()) return 0;
  const esc = oldTitle.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // matches [[Old]], [[Old|alias]], [[Old#Section]] and the same inside ![[embeds]] and timeline:Old filters
  const re = new RegExp(`\\[\\[(\\s*(?:timeline:)?)\\s*${esc}\\s*(#[^\\]|]*)?(\\|[^\\]]*)?\\]\\]`, 'gi');
  const fix = (s: string) =>
    s.replace(re, (_m, pre: string, sec: string | undefined, alias: string | undefined) => `[[${pre.trim()}${newTitle.trim()}${sec ?? ''}${alias ?? ''}]]`);
  let count = 0;
  const articles = await db.articles.where('worldId').equals(worldId).toArray();
  for (const a of articles) {
    if (a.id === skipId) continue;
    const body = fix(a.body);
    const summary = fix(a.summary);
    const fields = Object.fromEntries(Object.entries(a.fields).map(([k, v]) => [k, fix(v)]));
    if (body !== a.body || summary !== a.summary || JSON.stringify(fields) !== JSON.stringify(a.fields)) {
      await db.articles.update(a.id, { body, summary, fields });
      count++;
    }
  }
  const events = await db.events.where('worldId').equals(worldId).toArray();
  for (const e of events) {
    const d = fix(e.description);
    if (d !== e.description) await db.events.update(e.id, { description: d });
  }
  const scenes = await db.scenes.where('worldId').equals(worldId).toArray();
  for (const s of scenes) {
    const body = fix(s.body);
    const synopsis = fix(s.synopsis);
    if (body !== s.body || synopsis !== s.synopsis) {
      await db.scenes.update(s.id, { body, synopsis });
      count++;
    }
  }
  if (count) await touch(worldId);
  return count;
}
