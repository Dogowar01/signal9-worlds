import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { CanonStatus } from '../db';
import { CANON_META, CANON_ORDER, type CanonLens } from '../lib/canon';

export function CanonBadge({ status, compact }: { status?: CanonStatus; compact?: boolean }) {
  if (!status) return null;
  const m = CANON_META[status];
  return (
    <span className={`canon-badge ${compact ? 'compact' : ''}`} style={{ ['--cc' as string]: m.color }} title={`${m.label}: ${m.meaning}`}>
      <span className="canon-dot" /> {compact ? m.short : m.label}
    </span>
  );
}

/** Click to choose a canon status. `variant="dot"` is a tiny trigger for individual fields. */
export function CanonPicker({ value, onChange, variant = 'badge', placeholder = 'Set canon status' }: {
  value?: CanonStatus;
  onChange: (s: CanonStatus | undefined) => void;
  variant?: 'badge' | 'dot';
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const m = value ? CANON_META[value] : undefined;

  return (
    <span className="canon-picker" ref={ref}>
      {variant === 'dot' ? (
        <button
          type="button"
          className={`canon-dot-btn ${value ? 'set' : ''}`}
          style={{ ['--cc' as string]: m?.color ?? 'var(--line-2)' }}
          onClick={() => setOpen(!open)}
          title={m ? `${m.label} (click to change)` : 'Mark canon status'}
          aria-label={m ? `Canon status: ${m.label}` : 'Mark canon status'}
        />
      ) : (
        <button type="button" className={`canon-badge trigger ${value ? '' : 'unset'}`} style={{ ['--cc' as string]: m?.color ?? 'var(--muted)' }} onClick={() => setOpen(!open)}>
          <span className="canon-dot" /> {m ? m.label : placeholder}
        </button>
      )}
      {open && (
        <span className="canon-menu" role="menu">
          {CANON_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              className={`canon-option ${value === s ? 'on' : ''}`}
              style={{ ['--cc' as string]: CANON_META[s].color }}
              onClick={() => (onChange(s), setOpen(false))}
            >
              <span className="canon-dot" />
              <span className="grow">
                <b>{CANON_META[s].label}</b>
                <span className="muted small">{CANON_META[s].meaning}</span>
              </span>
              {value === s && <Check size={14} />}
            </button>
          ))}
          {value && (
            <button type="button" className="canon-option clear" onClick={() => (onChange(undefined), setOpen(false))}>
              <X size={13} /> <span className="grow">Clear status</span>
            </button>
          )}
        </span>
      )}
    </span>
  );
}

/** Should a field (or passage) with this status be shown? */
export function canonShown(status: CanonStatus | undefined, lens: CanonLens, playerView: boolean) {
  if (!status) return true;
  if (playerView) return status === 'established' || status === 'provisional';
  if (lens === 'all') return true;
  if (lens === 'hideRejected') return status !== 'notcanon';
  return status === 'established';
}
