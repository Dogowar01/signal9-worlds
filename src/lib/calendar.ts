import type { TimelineEvent, World, WorldCalendar } from '../db';

export const EMPTY_CALENDAR: WorldCalendar = { months: [], weekdays: [], moons: [], weekdayOffset: 0 };

export function getCalendar(world: Pick<World, 'calendar'>): WorldCalendar {
  return { ...EMPTY_CALENDAR, ...(world.calendar ?? {}) };
}

export const hasMonths = (c: WorldCalendar) => c.months.length > 0;
export const daysInYear = (c: WorldCalendar) => c.months.reduce((n, m) => n + Math.max(1, m.days), 0) || 365;

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Day of the year (0-based) for a month/day. */
export function dayOfYear(c: WorldCalendar, month?: number | null, day?: number | null) {
  if (!hasMonths(c) || !month) return 0;
  let d = 0;
  for (let i = 0; i < Math.min(month - 1, c.months.length); i++) d += c.months[i].days;
  return d + Math.max(0, (day ?? 1) - 1);
}

/** An absolute day number, so weekdays and moon phases line up across years. */
export function absoluteDay(c: WorldCalendar, year: number, month?: number | null, day?: number | null) {
  return year * daysInYear(c) + dayOfYear(c, month, day);
}

/** Year as a decimal, for placing events on a scale. */
export function yearPosition(c: WorldCalendar, e: Pick<TimelineEvent, 'year' | 'month' | 'day'>) {
  return e.year + (hasMonths(c) && e.month ? dayOfYear(c, e.month, e.day) / daysInYear(c) : 0);
}

export function compareEvents(c: WorldCalendar) {
  return (a: TimelineEvent, b: TimelineEvent) =>
    a.year - b.year || dayOfYear(c, a.month, a.day) - dayOfYear(c, b.month, b.day) || a.title.localeCompare(b.title);
}

export function weekdayName(c: WorldCalendar, abs: number) {
  if (!c.weekdays.length) return '';
  return c.weekdays[mod(abs + c.weekdayOffset, c.weekdays.length)];
}

/** 0 = new, 0.5 = full. */
export function moonPhase(cycle: number, offset: number, abs: number) {
  const len = Math.max(1, cycle);
  return mod(abs + offset, len) / len;
}

const GLYPHS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
export function moonGlyph(phase: number) {
  return GLYPHS[Math.round(phase * 8) % 8];
}
export function moonName(phase: number) {
  const i = Math.round(phase * 8) % 8;
  return ['New', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full', 'Waning gibbous', 'Last quarter', 'Waning crescent'][i];
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** "3rd of Frostfall, 312 AS", "Frostfall 312 AS" or just "312 AS". */
export function formatEventDate(world: Pick<World, 'calendar' | 'yearSuffix'>, e: Pick<TimelineEvent, 'year' | 'month' | 'day' | 'endYear'>) {
  const c = getCalendar(world);
  const sfx = world.yearSuffix ? ` ${world.yearSuffix}` : '';
  const range = e.endYear != null && e.endYear !== e.year ? `–${e.endYear}` : '';
  const m = hasMonths(c) && e.month ? c.months[e.month - 1] : undefined;
  if (m && e.day) return `${ordinal(e.day)} of ${m.name}, ${e.year}${range}${sfx}`;
  if (m) return `${m.name} ${e.year}${range}${sfx}`;
  return `${e.year}${range}${sfx}`;
}

/** Short form for tight spaces. */
export function formatShortDate(world: Pick<World, 'calendar' | 'yearSuffix'>, e: Pick<TimelineEvent, 'year' | 'month' | 'day' | 'endYear'>) {
  const c = getCalendar(world);
  const m = hasMonths(c) && e.month ? c.months[e.month - 1] : undefined;
  const sfx = world.yearSuffix ? ` ${world.yearSuffix}` : '';
  const range = e.endYear != null && e.endYear !== e.year ? `–${e.endYear}` : '';
  return `${m && e.day ? `${e.day} ` : ''}${m ? `${m.name.slice(0, 3)} ` : ''}${e.year}${range}${sfx}`;
}

export const CALENDAR_PRESETS: { name: string; calendar: WorldCalendar }[] = [
  {
    name: 'Earth-like (12 months)',
    calendar: {
      months: [
        ['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30],
        ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31],
      ].map(([name, days]) => ({ name: name as string, days: days as number })),
      weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      moons: [{ name: 'Moon', cycle: 29.53, offset: 0 }],
      weekdayOffset: 0,
    },
  },
  {
    name: 'Fantasy: twelve moons',
    calendar: {
      months: ['Deepwinter', 'Thawmoon', 'Seedtide', 'Rainsong', 'Bloomtide', 'Highsun', 'Emberfall', 'Harvestmoon', 'Mistreach', 'Leaffall', 'Frostfall', 'Longnight']
        .map((name) => ({ name, days: 30 })),
      weekdays: ['Sunsday', 'Moonsday', 'Tidesday', 'Hearthday', 'Forgeday', 'Starsday'],
      moons: [{ name: 'Selune', cycle: 30, offset: 15, color: '#e8e2cf' }, { name: 'The Red Eye', cycle: 73, offset: 0, color: '#e07a6f' }],
      weekdayOffset: 0,
    },
  },
  {
    name: 'Four seasons',
    calendar: {
      months: [{ name: 'Spring', days: 91 }, { name: 'Summer', days: 91 }, { name: 'Autumn', days: 91 }, { name: 'Winter', days: 92 }],
      weekdays: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Rest'],
      moons: [{ name: 'Moon', cycle: 28, offset: 0 }],
      weekdayOffset: 0,
    },
  },
  {
    name: 'Sci-fi: standard cycles',
    calendar: {
      months: Array.from({ length: 10 }, (_, i) => ({ name: `Cycle ${i + 1}`, days: 36 })),
      weekdays: ['Shift A', 'Shift B', 'Shift C', 'Shift D', 'Shift E', 'Shift F'],
      moons: [],
      weekdayOffset: 0,
    },
  },
];
