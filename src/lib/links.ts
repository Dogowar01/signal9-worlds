import type { Article, Relation } from '../db';

export const WIKILINK_RE = /\[\[([^[\]|]+?)(?:\|([^[\]]+?))?\]\]/g;

export const norm = (s: string) => s.trim().toLowerCase();

/** All [[targets]] referenced in a piece of text (normalised). */
export function extractTargets(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(WIKILINK_RE)) out.push(norm(m[1]));
  return out;
}

export function articleText(a: Article) {
  return [a.summary, a.body, ...Object.values(a.fields)].join('\n');
}

export interface LinkIndex {
  byId: Map<string, Article>;
  resolve: (name: string) => Article | undefined;
  outgoing: Map<string, Set<string>>;
  incoming: Map<string, Set<string>>;
  broken: { from: Article; target: string }[];
  children: Map<string, Article[]>;
}

export function buildIndex(articles: Article[]): LinkIndex {
  const byId = new Map<string, Article>();
  const byName = new Map<string, Article>();
  // aliases first so real titles win on collision
  for (const a of articles) for (const al of a.aliases) if (al.trim()) byName.set(norm(al), a);
  for (const a of articles) {
    byId.set(a.id, a);
    byName.set(norm(a.title), a);
  }
  const resolve = (name: string) => byName.get(norm(name));

  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  const broken: LinkIndex['broken'] = [];
  const children = new Map<string, Article[]>();

  for (const a of articles) {
    const out = new Set<string>();
    const seenBroken = new Set<string>();
    for (const t of extractTargets(articleText(a))) {
      const target = byName.get(t);
      if (target) {
        if (target.id !== a.id) out.add(target.id);
      } else if (!seenBroken.has(t)) {
        seenBroken.add(t);
        broken.push({ from: a, target: t });
      }
    }
    outgoing.set(a.id, out);
    for (const id of out) {
      if (!incoming.has(id)) incoming.set(id, new Set());
      incoming.get(id)!.add(a.id);
    }
    if (a.parentId) {
      if (!children.has(a.parentId)) children.set(a.parentId, []);
      children.get(a.parentId)!.push(a);
    }
  }
  for (const list of children.values()) list.sort((x, y) => x.title.localeCompare(y.title));
  return { byId, resolve, outgoing, incoming, broken, children };
}

/** Titles of broken links keep their original casing where we can find it. */
export function originalCasing(text: string, normalised: string) {
  for (const m of text.matchAll(WIKILINK_RE)) if (norm(m[1]) === normalised) return m[1].trim();
  return normalised;
}

export function relationsFor(id: string, relations: Relation[]) {
  return {
    out: relations.filter((r) => r.fromId === id),
    in: relations.filter((r) => r.toId === id),
  };
}
