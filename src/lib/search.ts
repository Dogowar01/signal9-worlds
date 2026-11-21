import type { Article } from '../db';
import { plainExcerpt } from './markdown';

export interface Hit {
  article: Article;
  score: number;
  snippet?: string;
}

function subsequence(needle: string, hay: string) {
  let i = 0;
  for (const c of hay) if (c === needle[i]) i++;
  return i === needle.length;
}

export function searchArticles(articles: Article[], query: string, limit = 30): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  const hits: Hit[] = [];
  for (const a of articles) {
    const title = a.title.toLowerCase();
    let score = 0;
    let snippet: string | undefined;
    if (title === q) score += 200;
    else if (title.startsWith(q)) score += 120;
    else if (title.includes(q)) score += 80;
    else if (subsequence(q.replace(/\s+/g, ''), title)) score += 25;
    if (a.aliases.some((al) => al.toLowerCase().includes(q))) score += 60;
    if (a.tags.some((t) => t.toLowerCase() === q.replace(/^#/, ''))) score += 50;
    const body = `${a.summary}\n${a.body}\n${Object.values(a.fields).join('\n')}`.toLowerCase();
    if (words.every((w) => body.includes(w) || title.includes(w))) {
      score += 15;
      const idx = body.indexOf(words[0]);
      if (idx >= 0 && score < 60) {
        const raw = `${a.summary}\n${a.body}\n${Object.values(a.fields).join('\n')}`;
        snippet = plainExcerpt(raw.slice(Math.max(0, idx - 60), idx + 140), 160);
      }
    }
    if (score > 0) {
      if (a.pinned) score += 5;
      hits.push({ article: a, score, snippet });
    }
  }
  return hits.sort((x, y) => y.score - x.score || x.article.title.localeCompare(y.article.title)).slice(0, limit);
}
