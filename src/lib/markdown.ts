import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Article, Timeline, TimelineEvent, World, WorldMap } from '../db';
import { WIKILINK_RE, stripLinks } from './links';
import { compareEvents, formatShortDate, getCalendar } from './calendar';
import { underFog } from './geometry';

marked.setOptions({ gfm: true, breaks: true });

export interface RenderCtx {
  resolve: (name: string) => Article | undefined;
  playerView: boolean;
  /** Build the href for a resolved article. Defaults to the in-app route. */
  href?: (a: Article) => string;
  /** Data for ![[embeds]]; when missing, those embeds are skipped. */
  world?: World;
  maps?: WorldMap[];
  events?: TimelineEvent[];
  timelines?: Timeline[];
  typeOf?: (a: Article) => { name: string; color: string } | undefined;
  /** Internal: set while rendering inside an embed so embeds don't nest. */
  depth?: number;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// :::secret Optional label
// hidden text
// :::
const SECRET_RE = /^:::secret[ \t]*([^\n]*)\n([\s\S]*?)^:::[ \t]*$/gm;
// ![[Article]], ![[Article#Section]], ![[map:Name]], ![[timeline]], ![[timeline:Track or Article]]
export const EMBED_RE = /!\[\[([^[\]|]+?)(?:\|([^[\]]+?))?\]\]/g;

export function stripSecrets(src: string) {
  return src.replace(SECRET_RE, '');
}

export function hasSecrets(src: string) {
  SECRET_RE.lastIndex = 0;
  return SECRET_RE.test(src);
}

function articleHref(a: Article, ctx: RenderCtx) {
  return ctx.href ? ctx.href(a) : `#/w/${a.worldId}/a/${a.id}`;
}

/** Pull one section (a heading and everything under it) out of an article. */
export function extractSection(body: string, heading: string) {
  const lines = body.split('\n');
  const want = heading.trim().toLowerCase();
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(lines[i]);
    if (!m) continue;
    if (start < 0 && m[2].toLowerCase() === want) {
      start = i;
      level = m[1].length;
    } else if (start >= 0 && m[1].length <= level) {
      return lines.slice(start + 1, i).join('\n').trim();
    }
  }
  return start >= 0 ? lines.slice(start + 1).join('\n').trim() : null;
}

function renderEmbed(target: string, alias: string | undefined, ctx: RenderCtx): string | null {
  const lower = target.toLowerCase();
  const wid = ctx.world?.id;

  if (lower.startsWith('map:')) {
    if (!ctx.maps || !wid) return '';
    const name = target.slice(4).trim().toLowerCase();
    const m = ctx.maps.find((x) => x.name.toLowerCase() === name);
    if (!m) return `<div class="embed embed-missing">No map called “${esc(target.slice(4).trim())}”</div>`;
    const hiddenLayers = new Set((m.layers ?? []).filter((l) => l.hidden || (ctx.playerView && l.gmOnly)).map((l) => l.id));
    const shown = <T extends { gmOnly?: boolean; layerId?: string | null }>(x: T) => !(ctx.playerView && x.gmOnly) && !(x.layerId && hiddenLayers.has(x.layerId));
    const regions = (m.regions ?? []).filter((r) => shown(r) || (ctx.playerView && r.fog));
    const poly = regions
      .map((r) => {
        const pts = r.points.map(([x, y]) => `${(x * 100).toFixed(2)},${(y * 100).toFixed(2)}`).join(' ');
        if (r.fog) return ctx.playerView ? `<polygon points="${pts}" fill="#0b0c10" fill-opacity="0.96" />` : `<polygon points="${pts}" fill="#000" fill-opacity="0.35" stroke="#888" stroke-dasharray="1 1" stroke-width="0.3" />`;
        return `<polygon points="${pts}" fill="${esc(r.color)}" fill-opacity="0.25" stroke="${esc(r.color)}" stroke-width="0.35" />`;
      })
      .join('');
    const pins = m.pins
      .filter((p) => shown(p) && !(ctx.playerView && underFog(p.x, p.y, m.regions)))
      .map((p) => `<span class="embed-pin" style="left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%;--pin:${esc(p.color)}" title="${esc(p.label)}"></span>`)
      .join('');
    return `<a class="embed embed-map" href="#/w/${wid}/maps/${m.id}"><div class="embed-map-frame" style="aspect-ratio:${m.width}/${m.height}"><img src="${esc(m.image)}" alt="${esc(m.name)}"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${poly}</svg>${pins}</div><div class="embed-caption">Map · ${esc(alias ?? m.name)}</div></a>`;
  }

  if (lower === 'timeline' || lower.startsWith('timeline:')) {
    if (!ctx.events || !ctx.world) return '';
    const filter = lower.startsWith('timeline:') ? target.slice(9).trim() : '';
    let list = ctx.events.filter((e) => !(ctx.playerView && e.gmOnly));
    let caption = 'Timeline';
    if (filter) {
      const track = ctx.timelines?.find((t) => t.name.toLowerCase() === filter.toLowerCase());
      const art = ctx.resolve(filter);
      if (track) {
        list = list.filter((e) => e.timelineId === track.id);
        caption = track.name;
      } else if (art) {
        list = list.filter((e) => e.articleId === art.id || e.description.toLowerCase().includes(`[[${art.title.toLowerCase()}`));
        caption = `Timeline · ${art.title}`;
      } else list = [];
    }
    list.sort(compareEvents(getCalendar(ctx.world)));
    const color = new Map((ctx.timelines ?? []).map((t) => [t.id, t.color]));
    const items = list
      .slice(0, 40)
      .map((e) => `<li style="--c:${esc(color.get(e.timelineId) ?? '#999')}"><span class="et-date">${esc(formatShortDate(ctx.world!, e))}</span><span class="et-title">${esc(stripLinks(e.title))}</span></li>`)
      .join('');
    return `<a class="embed embed-timeline" href="#/w/${ctx.world.id}/timeline"><div class="embed-caption">${esc(alias ?? caption)}</div><ol>${items || '<li class="muted">No events</li>'}</ol></a>`;
  }

  const [title, section] = target.split('#');
  const a = ctx.resolve(title);
  if (!a || (ctx.playerView && a.gmOnly)) return null; // fall back to a normal (red or plain) link
  const href = articleHref(a, ctx);
  if (section?.trim()) {
    const text = extractSection(a.body, section);
    if (text == null) return `<div class="embed embed-missing">No section “${esc(section.trim())}” in ${esc(a.title)}</div>`;
    const inner = renderMarkdown(text, { ...ctx, depth: (ctx.depth ?? 0) + 1 });
    return `<div class="embed embed-section"><a class="embed-caption" href="${href}">${esc(alias ?? `${a.title} › ${section.trim()}`)}</a>${inner}</div>`;
  }
  const t = ctx.typeOf?.(a);
  const excerpt = plainExcerpt(a.summary || a.body, 200);
  return `<a class="embed embed-card" href="${href}" style="--tc:${esc(t?.color ?? '#999')}">${a.image ? `<img src="${esc(a.image)}" alt="">` : ''}<div><div class="embed-type">${esc(t?.name ?? '')}</div><strong>${esc(alias ?? a.title)}</strong><p>${esc(excerpt)}</p></div></a>`;
}

function preprocess(src: string, ctx: RenderCtx, embeds: string[] | null) {
  let s = src.replace(SECRET_RE, (_m, label: string, inner: string) =>
    ctx.playerView
      ? ''
      : `\n<div class="secret" data-label="${esc(label.trim() || 'Secret')}">\n\n${inner}\n</div>\n`,
  );
  s = s.replace(EMBED_RE, (m, target: string, alias?: string) => {
    if (!embeds || (ctx.depth ?? 0) > 0) return m.slice(1); // inline text or nested: plain link
    const html = renderEmbed(target.trim(), alias?.trim(), ctx);
    if (html == null) return m.slice(1);
    embeds.push(html);
    return `\n\nS9EMBED${embeds.length - 1}X\n\n`;
  });
  s = s.replace(WIKILINK_RE, (_m, target: string, alias?: string) => {
    const t = target.trim();
    const label = esc((alias ?? target).trim());
    const a = ctx.resolve(t.split('#')[0]);
    if (!a) {
      return ctx.playerView
        ? label
        : `<a class="wikilink missing" role="link" tabindex="0" data-create="${esc(t)}" title="Not written yet. Click to create">${label}</a>`;
    }
    if (a.gmOnly && ctx.playerView) return label;
    return `<a class="wikilink${a.gmOnly ? ' gm' : ''}" href="${articleHref(a, ctx)}" data-id="${a.id}">${label}</a>`;
  });
  return s;
}

export function renderMarkdown(src: string, ctx: RenderCtx): string {
  const embeds: string[] = [];
  let html = marked.parse(preprocess(src || '', ctx, embeds), { async: false }) as string;
  if (embeds.length) html = html.replace(/<p>S9EMBED(\d+)X<\/p>|S9EMBED(\d+)X/g, (_m, a?: string, b?: string) => embeds[Number(a ?? b)] ?? '');
  return DOMPurify.sanitize(html);
}

export function renderInline(src: string, ctx: RenderCtx): string {
  const html = marked.parseInline(preprocess(src || '', ctx, null), { async: false }) as string;
  return DOMPurify.sanitize(html);
}

/** Plain-text excerpt (for previews and search snippets). */
export function plainExcerpt(src: string, len = 220) {
  const t = (src || '')
    .replace(SECRET_RE, '')
    .replace(/!\[\[/g, '[[')
    .replace(WIKILINK_RE, (_m, t: string, a?: string) => a ?? t)
    .replace(/[#*_>`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > len ? t.slice(0, len).trimEnd() + '…' : t;
}
