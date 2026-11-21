import { useNavigate } from 'react-router';
import { createArticle, type Article } from '../db';
import { useWorld } from './world';

/** Create an article and jump straight into the editor. */
export function useCreateArticle() {
  const { world, templates } = useWorld();
  const navigate = useNavigate();
  return async (title = 'Untitled', templateId?: string, extra: Partial<Article> = {}) => {
    const tpl = templateId ?? templates.find((t) => t.name === 'Note')?.id ?? templates[0]?.id ?? '';
    const a = await createArticle(world.id, { ...extra, title, templateId: tpl });
    navigate(`/w/${world.id}/a/${a.id}/edit`);
    return a;
  };
}

export function formatYear(year: number, suffix: string, endYear?: number | null) {
  return `${year}${endYear != null && endYear !== year ? `–${endYear}` : ''}${suffix ? ` ${suffix}` : ''}`;
}

export function timeAgo(t: number) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString();
}
