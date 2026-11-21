export const PROMPTS: string[] = [
  'What do children in your world fear most, and are they right to?',
  'Describe a festival that outsiders find baffling.',
  'Which trade route would collapse the economy if it closed?',
  'What does a common soldier carry in their pack?',
  'Name a law everyone breaks. Why does nobody enforce it?',
  'What is the most valuable thing that grows in the ground here?',
  'Who keeps the official history, and what did they leave out?',
  'Describe a ruin that locals refuse to enter.',
  'What does a typical breakfast look like in your largest city?',
  'Which profession is respected everywhere but paid badly?',
  'What insult would start a duel?',
  'Describe a holy relic that is almost certainly fake.',
  'How do people tell time without clocks?',
  'What is the most dangerous animal that people still keep as pets?',
  'Which two factions should be enemies but cooperate in secret?',
  'What happens to the dead, according to three different cultures?',
  'Describe a map that is deliberately wrong.',
  'What disease or curse shaped a city\'s architecture?',
  'Write a nursery rhyme that hides a real historical event.',
  'Who is the most famous person in your world who never existed?',
  'What does magic (or technology) cost the people who use it?',
  'Describe a building that has served four different purposes.',
  'What words do sailors (or travelers) use that nobody else understands?',
  'Which border is disputed, and what is buried under it?',
  'What would a stranger notice first about the smell of your capital?',
  'Describe a game that children play. What does it secretly teach?',
  'What is the oldest living thing in the world?',
  'Who controls the water?',
  'What prophecy was fulfilled in the most disappointing way possible?',
  'What do people swear by when they want to be believed?',
  'Describe a monster from the monster\'s point of view.',
  'Which invention is banned, and who still uses it?',
  'What is a typical bribe, and to whom?',
  'Describe the worst job in the world, and the person who loves it.',
  'What is the story behind your world\'s most common surname?',
  'What do mapmakers draw at the edge of the known world?',
  'Describe a tradition around a first meeting between strangers.',
  'Which ancient war is still being fought, quietly?',
  'What does the night sky look like, and what do people see in it?',
  'Describe an heirloom and the three owners before the current one.',
];

const STYLES: Record<string, { start: string[]; mid: string[]; end: string[] }> = {
  Lyrical: {
    start: ['Ae', 'Ela', 'Ili', 'Sae', 'Lua', 'Myr', 'Thi', 'Vae', 'Nai', 'Ori', 'Cae', 'Ela'],
    mid: ['la', 'ri', 'the', 'na', 'ven', 'sil', 'wy', 'lo', 'ra', ''],
    end: ['wen', 'riel', 'thas', 'ra', 'lis', 'nor', 'eth', 'iel', 'a', 'ys'],
  },
  Harsh: {
    start: ['Kr', 'Gor', 'Dra', 'Urz', 'Brak', 'Gr', 'Thrak', 'Zug', 'Mor', 'Vok'],
    mid: ['a', 'u', 'o', 'ag', 'ur', 'ok', ''],
    end: ['gash', 'mak', 'dur', 'zak', 'thar', 'rok', 'gul', 'nash'],
  },
  Northern: {
    start: ['Bjor', 'Sig', 'Hal', 'Ey', 'Thor', 'Ulf', 'Ast', 'Rag', 'Ing', 'Fro'],
    mid: ['ga', 'ri', 'na', 'vi', 'dis', ''],
    end: ['ulf', 'rid', 'mund', 'hild', 'stein', 'var', 'dis', 'gard', 'a'],
  },
  Desert: {
    start: ['Ash', 'Kha', 'Zar', 'Sel', 'Mir', 'Tah', 'Nas', 'Ram', 'Qad', 'Jal'],
    mid: ['a', 'i', 'ra', 'ha', 'mi', ''],
    end: ['im', 'ah', 'ir', 'ani', 'esh', 'oud', 'ra', 'id'],
  },
  Imperial: {
    start: ['Aur', 'Cass', 'Val', 'Oct', 'Max', 'Sev', 'Luc', 'Tib', 'Corv', 'Mar'],
    mid: ['e', 'i', 'el', 'er', 'an', ''],
    end: ['ius', 'ia', 'ianus', 'ina', 'us', 'illa', 'or', 'ella'],
  },
};
export const NAME_STYLES = Object.keys(STYLES);

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function generateName(style: string) {
  const s = STYLES[style] ?? STYLES.Lyrical;
  const n = pick(s.start) + pick(s.mid) + pick(s.end);
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

export const randomPrompt = () => pick(PROMPTS);
