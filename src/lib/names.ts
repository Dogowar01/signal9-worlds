// Spot invented names that are the same, or easy to confuse (Serevan / Serevann, Serrath / Sarrath).

export interface NameEntry {
  name: string;
  kind: string; // "Character", "map pin", "region"…
  /** Things with the same owner (an article and its own aliases) never clash with each other. */
  owner: string;
  link?: string;
}

export interface Clash {
  a: NameEntry;
  b: NameEntry;
  reason: 'same' | 'similar';
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, '');

/** Doubled letters and similar-sounding vowels squeezed out: Serevann → srvn-ish skeleton. */
const skeleton = (s: string) => fold(s).replace(/(.)\1+/g, '$1').replace(/[aeiouy]+/g, 'a');

function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const GENERIC = new Set(
  'the of and reach desert river rivers mountains mountain range forest wood woods isles isle island islands pass harbour harbor port keep mines mine lake sea ocean bay coast vale valley valleys highlands highland plains plain marsh marshes delta deltas basin fields field spire city town hills hill fen mere ford march marches circle circles house court'.split(' '),
);
const coreWords = (s: string) =>
  s
    .split(/[\s\-–—_/]+/)
    .map(fold)
    .filter((w) => w.length >= 5 && !GENERIC.has(w));

function similarWhole(fa: string, fb: string, a: string, b: string) {
  const short = Math.min(fa.length, fb.length);
  if (short < 4) return false;
  if (skeleton(a) === skeleton(b)) return true;
  const max = short >= 8 ? 2 : 1;
  return distance(fa, fb, max) <= max;
}

export function similar(a: string, b: string): 'same' | 'similar' | null {
  const fa = fold(a);
  const fb = fold(b);
  if (!fa || !fb) return null;
  if (fa === fb) return 'same';
  if (similarWhole(fa, fb, a, b)) return 'similar';
  // distinctive words inside longer names: "Serrath Reach" vs "Sarrath Desert".
  // Identical words (shared surnames, "Vel Ashara Harbor") are deliberate, so only near-misses count.
  for (const wa of coreWords(a)) for (const wb of coreWords(b)) if (wa !== wb && similarWhole(wa, wb, wa, wb)) return 'similar';
  return null;
}

export function findClashes(entries: NameEntry[], limit = 200): Clash[] {
  const out: Clash[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.owner === b.owner) continue;
      const r = similar(a.name, b.name);
      if (!r) continue;
      // a pin or region named after the article it links to is expected, not a clash
      if (r === 'same' && (a.link && a.link === b.owner || b.link && b.link === a.owner)) continue;
      const key = [fold(a.name), fold(b.name), a.owner, b.owner].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ a, b, reason: r });
      if (out.length >= limit) return out;
    }
  }
  return out.sort((x, y) => (x.reason === y.reason ? 0 : x.reason === 'same' ? -1 : 1));
}

/** Names that look like `name`, for warnings while typing a title. */
export function similarTo(name: string, entries: NameEntry[], exceptOwner?: string) {
  if (fold(name).length < 3) return [];
  return entries.filter((e) => e.owner !== exceptOwner && similar(name, e.name)).slice(0, 5);
}
