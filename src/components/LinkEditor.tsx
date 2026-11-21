import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Clock, FilePlus, Map as MapIcon } from 'lucide-react';
import { useWorld } from '../lib/world';
import { searchArticles } from '../lib/search';
import { TemplateIcon } from '../icons';

export interface LinkEditorHandle {
  wrap: (before: string, after?: string, placeholder?: string) => void;
  linePrefix: (prefix: string) => void;
  insert: (text: string) => void;
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  className?: string;
  placeholder?: string;
  onSave?: () => void;
}

const MIRROR_PROPS = [
  'boxSizing', 'width', 'height', 'overflowX', 'overflowY', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
  'borderLeftWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight',
  'fontStretch', 'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize',
] as const;

function caretXY(el: HTMLTextAreaElement, pos: number) {
  const div = document.createElement('div');
  const cs = getComputedStyle(el);
  for (const p of MIRROR_PROPS) div.style[p] = cs[p];
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.textContent = el.value.slice(0, pos);
  const span = document.createElement('span');
  span.textContent = '​';
  div.appendChild(span);
  document.body.appendChild(div);
  const x = span.offsetLeft;
  const y = span.offsetTop + parseFloat(cs.lineHeight || '20');
  document.body.removeChild(div);
  return { x: x - el.scrollLeft, y: y - el.scrollTop };
}

/** Textarea with [[wiki link]] autocomplete and formatting helpers. */
export const LinkEditor = forwardRef<LinkEditorHandle, Props>(function LinkEditor({ value, onChange, rows = 12, className, placeholder, onSave }, ref) {
  const { allArticles, templateById, maps, timelines } = useWorld();
  const ta = useRef<HTMLTextAreaElement>(null);
  const [ac, setAc] = useState<{ query: string; start: number; x: number; y: number; embed: boolean } | null>(null);
  const [sel, setSel] = useState(0);

  type Opt = { key: string; label: string; insert: string; icon: React.ReactNode };
  const opts: Opt[] = [];
  if (ac) {
    const q = ac.query.trim().toLowerCase();
    if (ac.embed) {
      // embeds can also show maps and timelines
      const mq = q.replace(/^map:/, '');
      for (const m of maps.filter((m) => !mq || m.name.toLowerCase().includes(mq)).slice(0, 4))
        opts.push({ key: `m${m.id}`, label: `Map: ${m.name}`, insert: `map:${m.name}`, icon: <MapIcon size={13} /> });
      if (!q || 'timeline'.includes(q.split(':')[0]) || q.startsWith('timeline')) {
        opts.push({ key: 'tl', label: 'Timeline (all events)', insert: 'timeline', icon: <Clock size={13} /> });
        const tq = q.replace(/^timeline:?/, '');
        for (const t of timelines.filter((t) => !tq || t.name.toLowerCase().includes(tq)).slice(0, 3))
          opts.push({ key: `t${t.id}`, label: `Timeline: ${t.name}`, insert: `timeline:${t.name}`, icon: <Clock size={13} color={t.color} /> });
      }
    }
    const arts = q ? searchArticles(allArticles, ac.query, 8).map((h) => h.article) : [...allArticles].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
    for (const a of arts) {
      const t = templateById.get(a.templateId);
      opts.push({ key: a.id, label: a.title, insert: a.title, icon: <TemplateIcon name={t?.icon} size={13} color={t?.color} /> });
    }
    if (q && !ac.embed && !allArticles.some((a) => a.title.toLowerCase() === q))
      opts.push({ key: 'new', label: `Link to new “${ac.query.trim()}”`, insert: ac.query.trim(), icon: <FilePlus size={13} /> });
  }
  const optionCount = opts.length;

  const setText = (text: string, caretStart: number, caretEnd = caretStart) => {
    onChange(text);
    requestAnimationFrame(() => {
      const el = ta.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caretStart, caretEnd);
    });
  };

  useImperativeHandle(ref, () => ({
    focus: () => ta.current?.focus(),
    wrap(before, after = before, placeholderText = 'text') {
      const el = ta.current!;
      const { selectionStart: s, selectionEnd: e } = el;
      const inner = value.slice(s, e) || placeholderText;
      setText(value.slice(0, s) + before + inner + after + value.slice(e), s + before.length, s + before.length + inner.length);
    },
    linePrefix(prefix) {
      const el = ta.current!;
      const s = el.selectionStart;
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      setText(value.slice(0, lineStart) + prefix + value.slice(lineStart), s + prefix.length);
    },
    insert(text) {
      const el = ta.current!;
      const { selectionStart: s, selectionEnd: e } = el;
      setText(value.slice(0, s) + text + value.slice(e), s + text.length);
    },
  }));

  const detect = () => {
    const el = ta.current;
    if (!el) return;
    const pos = el.selectionStart;
    const before = el.value.slice(0, pos);
    const m = /\[\[([^[\]\n|]{0,60})$/.exec(before);
    if (m && el.selectionStart === el.selectionEnd) {
      const { x, y } = caretXY(el, pos);
      const start = pos - m[1].length;
      setAc({ query: m[1], start, x, y, embed: el.value[start - 3] === '!' });
      setSel(0);
    } else setAc(null);
  };

  const choose = (title: string) => {
    if (!ac) return;
    const el = ta.current!;
    const pos = el.selectionStart;
    const after = value.slice(pos);
    const closing = after.startsWith(']]') ? '' : ']]';
    const text = value.slice(0, ac.start) + title + closing + after;
    setAc(null);
    setText(text, ac.start + title.length + 2);
  };

  return (
    <div className="link-editor">
      <textarea
        ref={ta}
        className={`input editor ${className ?? ''}`}
        rows={rows}
        value={value}
        placeholder={placeholder}
        spellCheck
        onChange={(e) => {
          onChange(e.target.value);
          requestAnimationFrame(detect);
        }}
        onClick={detect}
        onBlur={() => setTimeout(() => setAc(null), 150)}
        onKeyDown={(e) => {
          if (ac && optionCount > 0) {
            if (e.key === 'ArrowDown') return (e.preventDefault(), setSel((s) => (s + 1) % optionCount));
            if (e.key === 'ArrowUp') return (e.preventDefault(), setSel((s) => (s - 1 + optionCount) % optionCount));
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              return choose(opts[sel]?.insert ?? ac.query.trim());
            }
            if (e.key === 'Escape') return (e.preventDefault(), setAc(null));
          }
          const mod = e.ctrlKey || e.metaKey;
          if (mod && e.key.toLowerCase() === 's') {
            e.preventDefault();
            onSave?.();
          } else if (mod && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            const el = ta.current!;
            const { selectionStart: s, selectionEnd: en } = el;
            const inner = value.slice(s, en) || 'bold';
            setText(value.slice(0, s) + '**' + inner + '**' + value.slice(en), s + 2, s + 2 + inner.length);
          } else if (mod && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            const el = ta.current!;
            const { selectionStart: s, selectionEnd: en } = el;
            const inner = value.slice(s, en) || 'italic';
            setText(value.slice(0, s) + '_' + inner + '_' + value.slice(en), s + 1, s + 1 + inner.length);
          } else if (e.key === '[' && !mod) {
            // auto-close [[ ]]
            const el = ta.current!;
            const s = el.selectionStart;
            if (value[s - 1] === '[' && el.selectionStart === el.selectionEnd && value.slice(s, s + 1) !== ']') {
              e.preventDefault();
              setText(value.slice(0, s) + '[]]' + value.slice(s), s + 1);
              requestAnimationFrame(detect);
            }
          }
        }}
        onKeyUp={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) detect();
        }}
      />
      {ac && optionCount > 0 && (
        <div className="ac-menu" style={{ left: Math.min(ac.x, (ta.current?.clientWidth ?? 400) - 260), top: ac.y + 4 }}>
          {ac.embed && <div className="ac-head">Embed</div>}
          {opts.map((o, i) => (
            <button key={o.key} type="button" className={`palette-item ${i === sel ? 'sel' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o.insert)}>
              {o.icon}
              <span className="ellipsis">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
