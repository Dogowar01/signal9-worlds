import type { CanonStatus } from '../db';

export const CANON_META: Record<CanonStatus, { label: string; short: string; color: string; meaning: string }> = {
  established: { label: 'Established', short: 'Est.', color: '#5fb37f', meaning: 'Accepted as the current foundation. May still be refined.' },
  provisional: { label: 'Provisional', short: 'Prov.', color: '#e0a458', meaning: 'A developed proposal or working assumption, not yet approved.' },
  unresolved: { label: 'Unresolved', short: 'Open', color: '#7fa6e8', meaning: 'Deliberately left open for a later decision.' },
  visual: { label: 'Visual reference', short: 'Visual', color: '#a99be0', meaning: 'An image or map exploring appearance; does not establish facts.' },
  notcanon: { label: 'Not canon', short: 'Not canon', color: '#e07a6f', meaning: 'Rejected, discarded or only a test. Not part of the world.' },
};

export const CANON_ORDER: CanonStatus[] = ['established', 'provisional', 'unresolved', 'visual', 'notcanon'];

export type CanonLens = 'all' | 'hideRejected' | 'established';

export const LENS_META: Record<CanonLens, { label: string; hint: string }> = {
  all: { label: 'All material', hint: 'Show everything, with canon markers' },
  hideRejected: { label: 'Hide not-canon', hint: 'Hide rejected and discarded material' },
  established: { label: 'Established only', hint: 'Show only established material (unmarked counts as established)' },
};

/** Should an article with this status be visible under the lens? Unset counts as established. */
export function visibleUnderLens(status: CanonStatus | undefined, lens: CanonLens) {
  if (lens === 'all' || !status) return true;
  if (lens === 'hideRejected') return status !== 'notcanon';
  return status === 'established';
}

/** Inline block kinds (:::provisional … :::). "not-canon" is accepted as an alias. */
export const BLOCK_KINDS = ['provisional', 'unresolved', 'established', 'visual', 'notcanon'] as const;
export const blockKind = (k: string): CanonStatus | null => {
  const n = k.toLowerCase().replace('-', '');
  return (BLOCK_KINDS as readonly string[]).includes(n) ? (n as CanonStatus) : null;
};
