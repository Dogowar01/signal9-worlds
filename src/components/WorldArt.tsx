import { useId, useMemo } from 'react';

// Procedural art seeded from a world's id, so every world gets its own consistent look.

const PALETTES = [
  { sky: ['#1b1530', '#3a2350'], planet: ['#f3c98b', '#c46a2b'], ring: '#f7e2b5', glow: '#e8a95b' },
  { sky: ['#0d1f2a', '#17445a'], planet: ['#8fd3c8', '#2f7d84'], ring: '#d4f3ee', glow: '#5fc4c4' },
  { sky: ['#1f1020', '#4a1d34'], planet: ['#f2a7a0', '#b2475a'], ring: '#ffd9d4', glow: '#e07a6f' },
  { sky: ['#101727', '#26345e'], planet: ['#b9b4f5', '#5b54b8'], ring: '#e3e0ff', glow: '#9a8cf0' },
  { sky: ['#121a12', '#2b4426'], planet: ['#cfe3a1', '#6f9a43'], ring: '#eef7d6', glow: '#8fbf6a' },
  { sky: ['#1d1710', '#45331d'], planet: ['#ead6a8', '#a8823e'], ring: '#fbf0d4', glow: '#c9a66b' },
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function worldPalette(seed: string) {
  return PALETTES[hash(seed) % PALETTES.length];
}

/** Wide banner: sky, stars, a ringed planet and a moon. */
export function WorldCover({ seed, className = '' }: { seed: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  const art = useMemo(() => {
    const r = rng(hash(seed));
    const p = worldPalette(seed);
    const stars = Array.from({ length: 70 }, () => ({ x: r() * 1200, y: r() * 300, s: r() ** 3 * 2 + 0.4, o: 0.3 + r() * 0.7 }));
    const px = 640 + r() * 200;
    const py = 130 + r() * 70;
    const pr = 85 + r() * 45;
    const tilt = -25 + r() * 50;
    const moon = { x: px - pr - 90 - r() * 140, y: 60 + r() * 90, r: 10 + r() * 14 };
    const bands = Array.from({ length: 3 }, (_, i) => ({ y: py - pr * 0.55 + i * pr * 0.45 + r() * 10, h: 6 + r() * 14 }));
    return { p, stars, px, py, pr, tilt, moon, bands, ringed: r() > 0.25 };
  }, [seed]);
  const { p, px, py, pr, tilt, moon } = art;
  return (
    <svg className={`world-cover ${className}`} viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="1" stopColor={p.sky[1]} />
        </linearGradient>
        <radialGradient id={`pl${id}`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor={p.planet[0]} />
          <stop offset="1" stopColor={p.planet[1]} />
        </radialGradient>
        <radialGradient id={`glow${id}`}>
          <stop offset="0" stopColor={p.glow} stopOpacity=".45" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`shade${id}`} cx="80%" cy="85%" r="80%">
          <stop offset="0.35" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".55" />
        </radialGradient>
        <clipPath id={`clip${id}`}>
          <circle cx={px} cy={py} r={pr} />
        </clipPath>
      </defs>
      <rect width="1200" height="300" fill={`url(#sky${id})`} />
      {art.stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o} />
      ))}
      <circle cx={px} cy={py} r={pr * 1.9} fill={`url(#glow${id})`} />
      {art.ringed && (
        <ellipse cx={px} cy={py} rx={pr * 1.75} ry={pr * 0.32} fill="none" stroke={p.ring} strokeOpacity=".35" strokeWidth="10" transform={`rotate(${tilt} ${px} ${py})`} />
      )}
      <circle cx={px} cy={py} r={pr} fill={`url(#pl${id})`} />
      <g clipPath={`url(#clip${id})`} opacity=".18">
        {art.bands.map((b, i) => (
          <rect key={i} x={px - pr} y={b.y} width={pr * 2} height={b.h} fill="#fff" />
        ))}
      </g>
      <circle cx={px} cy={py} r={pr} fill={`url(#shade${id})`} />
      {art.ringed && (
        <path
          d={`M ${px - pr * 1.75} ${py} A ${pr * 1.75} ${pr * 0.32} 0 0 0 ${px + pr * 1.75} ${py}`}
          fill="none" stroke={p.ring} strokeOpacity=".7" strokeWidth="10" transform={`rotate(${tilt} ${px} ${py})`}
        />
      )}
      <circle cx={moon.x} cy={moon.y} r={moon.r} fill={p.ring} opacity=".85" />
      <circle cx={moon.x + moon.r * 0.35} cy={moon.y + moon.r * 0.2} r={moon.r} fill="#000" opacity=".35" />
    </svg>
  );
}

/** Small round emblem for the sidebar and headers. */
export function WorldSigil({ seed, size = 28 }: { seed: string; size?: number }) {
  const id = useId().replace(/:/g, '');
  const p = worldPalette(seed);
  const tilt = (hash(seed) % 50) - 25;
  return (
    <svg className="world-sigil" width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <radialGradient id={`s${id}`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor={p.planet[0]} />
          <stop offset="1" stopColor={p.planet[1]} />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill={p.sky[1]} />
      <ellipse cx="20" cy="20" rx="17" ry="4.5" fill="none" stroke={p.ring} strokeOpacity=".4" strokeWidth="1.6" transform={`rotate(${tilt} 20 20)`} />
      <circle cx="20" cy="20" r="9.5" fill={`url(#s${id})`} />
      <path d="M 3 20 A 17 4.5 0 0 0 37 20" fill="none" stroke={p.ring} strokeOpacity=".85" strokeWidth="1.6" transform={`rotate(${tilt} 20 20)`} />
    </svg>
  );
}
