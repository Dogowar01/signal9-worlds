import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Article } from '../db';
import { WIKILINK_RE } from './links';

marked.setOptions({ gfm: true, breaks: true });

export interface RenderCtx {
  resolve: (name: string) => Article | undefined;
  playerView: boolean;
  /** Build the href for a resolved article. Defaults to the in-app route. */
  href?: (a: Article) => string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// :::secret Optional label
// hidden text
// :::
const SECRET_RE = /^:::secret[ \t]*([^\n]*)\n([\s\S]*?)^:::[ \t]*$/gm;

export function stripSecrets(src: string) {
  return src.replace(SECRET_RE, '');
}

export function hasSecrets(src: string) {
  SECRET_RE.lastIndex = 0;
  return SECRET_RE.test(src);
}

function preprocess(src: string, ctx: RenderCtx) {
  let s = src.replace(SECRET_RE, (_m, label: string, inner: string) =>
    ctx.playerView
      ? ''
      : `\n<div class="secret" data-label="${esc(label.trim() || 'Secret')}">\n\n${inner}\n</div>\n`,
  );
  s = s.replace(WIKILINK_RE, (_m, target: string, alias?: string) => {
    const t = target.trim();
    const label = esc((alias ?? target).trim());
    const a = ctx.resolve(t);
    if (!a) {
      return ctx.playerView
        ? label
        : `<a class="wikilink missing" role="link" tabindex="0" data-create="${esc(t)}" title="Not written yet. Click to create">${label}</a>`;
    }
    if (a.gmOnly && ctx.playerView) return label;
    const href = ctx.href ? ctx.href(a) : `#/w/${a.worldId}/a/${a.id}`;
    return `<a class="wikilink${a.gmOnly ? ' gm' : ''}" href="${href}" data-id="${a.id}">${label}</a>`;
  });
  return s;
}

export function renderMarkdown(src: string, ctx: RenderCtx): string {
  const html = marked.parse(preprocess(src || '', ctx), { async: false }) as string;
  return DOMPurify.sanitize(html);
}

export function renderInline(src: string, ctx: RenderCtx): string {
  const html = marked.parseInline(preprocess(src || '', ctx), { async: false }) as string;
  return DOMPurify.sanitize(html);
}

/** Plain-text excerpt (for previews and search snippets). */
export function plainExcerpt(src: string, len = 220) {
  const t = (src || '')
    .replace(SECRET_RE, '')
    .replace(WIKILINK_RE, (_m, t: string, a?: string) => a ?? t)
    .replace(/[#*_>`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > len ? t.slice(0, len).trimEnd() + '…' : t;
}
