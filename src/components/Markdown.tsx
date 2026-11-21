import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { useWorld } from '../lib/world';
import { useCreateArticle } from '../lib/actions';
import { plainExcerpt, renderInline, renderMarkdown } from '../lib/markdown';
import { TemplateIcon } from '../icons';

interface Props {
  source: string;
  inline?: boolean;
  className?: string;
}

/** Rendered markdown with [[wiki links]], hover previews and click-to-create red links. */
export function Markdown({ source, inline, className }: Props) {
  const { renderCtx } = useWorld();
  const html = inline ? renderInline(source, renderCtx) : renderMarkdown(source, renderCtx);
  const handlers = useLinkBehaviour();
  const Tag = inline ? 'span' : 'div';
  return (
    <>
      <Tag className={`${inline ? '' : 'prose'} ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} {...handlers.events} />
      {handlers.preview}
    </>
  );
}

export function useLinkBehaviour() {
  const { index, templateById, world } = useWorld();
  const create = useCreateArticle();
  const navigate = useNavigate();
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const onClick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest('a.wikilink') as HTMLAnchorElement | null;
    if (!el) return;
    const missing = el.dataset.create;
    if (missing) {
      e.preventDefault();
      create(missing);
    } else if (el.dataset.id) {
      e.preventDefault();
      setHover(null);
      navigate(`/w/${world.id}/a/${el.dataset.id}`);
    }
  };
  const onMouseOver = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest('a.wikilink[data-id]') as HTMLAnchorElement | null;
    if (!el) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      setHover({ id: el.dataset.id!, x: r.left, y: r.bottom + 6 });
    }, 250);
  };
  const onMouseOut = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a.wikilink')) {
      window.clearTimeout(timer.current);
      setHover(null);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).matches('a.wikilink.missing')) onClick(e as unknown as MouseEvent);
  };

  const a = hover ? index.byId.get(hover.id) : undefined;
  const t = a ? templateById.get(a.templateId) : undefined;
  const preview = a ? (
    <div
      className="link-preview"
      style={{ left: Math.min(hover!.x, window.innerWidth - 340), top: Math.min(hover!.y, window.innerHeight - 200) }}
    >
      {a.image && <img src={a.image} alt="" />}
      <div>
        <div className="type-label" style={{ color: t?.color }}>
          <TemplateIcon name={t?.icon} size={12} /> {t?.name}
        </div>
        <strong>{a.title}</strong>
        <p>{plainExcerpt(a.summary || a.body, 180) || <em>Nothing written yet.</em>}</p>
      </div>
    </div>
  ) : null;

  return { events: { onClick, onMouseOver, onMouseOut, onKeyDown }, preview };
}
