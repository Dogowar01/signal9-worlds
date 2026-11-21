import { db, touch, uid, type Manuscript, type ManuscriptNode, type SceneStatus } from '../db';

export const wordCount = (s: string) => s.match(/[\p{L}\p{N}'’-]+/gu)?.length ?? 0;

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const STATUS_META: Record<SceneStatus, { label: string; color: string }> = {
  idea: { label: 'Idea', color: '#9aa0a6' },
  draft: { label: 'Draft', color: '#e0a458' },
  revised: { label: 'Revised', color: '#6ab0de' },
  final: { label: 'Final', color: '#6fc28c' },
};

export function totalWords(nodes: ManuscriptNode[]) {
  return nodes.reduce((n, s) => n + wordCount(s.body), 0);
}

/** Words written today = total now minus the total at the end of the last day before today. */
export function todayWords(ms: Manuscript, total: number) {
  const today = dayKey();
  const prev = Object.keys(ms.history).filter((k) => k < today).sort().pop();
  return Math.max(0, total - (prev ? ms.history[prev] : 0));
}

/** Days in a row (ending today or yesterday) on which the word count went up. */
export function streak(ms: Manuscript) {
  const days = Object.keys(ms.history).sort();
  let count = 0;
  const today = dayKey();
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  if (!days.length || (days[days.length - 1] !== today && days[days.length - 1] !== yesterday)) return 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const prevVal = i > 0 ? ms.history[days[i - 1]] : 0;
    if (ms.history[days[i]] > prevVal) count++;
    else break;
    if (i > 0) {
      const gap = (Date.parse(days[i]) - Date.parse(days[i - 1])) / 86_400_000;
      if (gap > 1.5) break;
    }
  }
  return count;
}

export async function recordProgress(msId: string) {
  const ms = await db.manuscripts.get(msId);
  if (!ms) return;
  const nodes = await db.scenes.where('manuscriptId').equals(msId).toArray();
  await db.manuscripts.update(msId, { history: { ...ms.history, [dayKey()]: totalWords(nodes) }, updatedAt: Date.now() });
}

export async function createManuscript(worldId: string, title: string) {
  const now = Date.now();
  const ms: Manuscript = { id: uid(), worldId, title, subtitle: '', wordGoal: 80000, dailyGoal: 500, history: {}, createdAt: now, updatedAt: now };
  const chapter: ManuscriptNode = { id: uid(), worldId, manuscriptId: ms.id, parentId: null, kind: 'chapter', title: 'Chapter One', synopsis: '', body: '', order: 0, status: 'idea', updatedAt: now };
  const scene: ManuscriptNode = { ...chapter, id: uid(), parentId: chapter.id, kind: 'scene', title: 'Opening scene' };
  await db.manuscripts.add(ms);
  await db.scenes.bulkAdd([chapter, scene]);
  await touch(worldId);
  return { ms, scene };
}

export async function addNode(ms: Manuscript, kind: 'chapter' | 'scene', parentId: string | null, siblings: ManuscriptNode[]) {
  const now = Date.now();
  const n: ManuscriptNode = {
    id: uid(),
    worldId: ms.worldId,
    manuscriptId: ms.id,
    parentId,
    kind,
    title: kind === 'chapter' ? `Chapter ${siblings.length + 1}` : 'New scene',
    synopsis: '',
    body: '',
    order: siblings.length ? Math.max(...siblings.map((s) => s.order)) + 1 : 0,
    status: 'idea',
    updatedAt: now,
  };
  await db.scenes.add(n);
  return n;
}

/** Swap a node with its neighbour among siblings. */
export async function moveNode(node: ManuscriptNode, siblings: ManuscriptNode[], dir: -1 | 1) {
  const sorted = [...siblings].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((s) => s.id === node.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return;
  const other = sorted[j];
  await db.transaction('rw', db.scenes, async () => {
    await db.scenes.update(node.id, { order: other.order });
    await db.scenes.update(other.id, { order: node.order === other.order ? node.order + dir : node.order });
  });
}
