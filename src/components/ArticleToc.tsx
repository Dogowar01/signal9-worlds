import { useEffect, useState, type RefObject } from 'react';
import { ListTree } from 'lucide-react';
import { slug } from './ArticleSections';

interface Item { id: string; text: string; level: number }

/** Contents for long articles, highlighting the section you're reading. */
export function ArticleToc({ container, watch }: { container: RefObject<HTMLElement | null>; watch: unknown }) {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const used = new Set<string>();
    const heads = [...root.querySelectorAll<HTMLElement>('h2, h3')].filter((h) => !h.closest('.embed, .backlinks, .subpages, .questions'));
    const list = heads.map((h) => {
      if (!h.id) {
        let id = `h-${slug(h.textContent ?? '')}`;
        while (used.has(id) || document.getElementById(id)) id += '-2';
        h.id = id;
      }
      used.add(h.id);
      return { id: h.id, text: (h.textContent ?? '').replace(/\s*\d+$/, '').replace(/\s+(Est\.|Prov\.|Open|Visual|Not canon)$/, '').trim(), level: h.tagName === 'H2' ? 2 : 3 };
    });
    setItems(list);

    const scroller = document.querySelector('.main');
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { root: scroller, rootMargin: '0px 0px -65% 0px' },
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [container, watch]);

  if (items.length < 3) return null;
  return (
    <nav className="toc card" aria-label="Contents">
      <div className="toc-title">
        <ListTree size={13} /> Contents
      </div>
      <ol>
        {items.map((it) => (
          <li key={it.id} className={`lvl-${it.level} ${active === it.id ? 'active' : ''}`}>
            <a
              href={`#${it.id}`}
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('s9-reveal', { detail: it.id }));
                requestAnimationFrame(() => setTimeout(() => document.getElementById(it.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60));
                setActive(it.id);
              }}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
