import type { Template, TemplateField } from './db';

export const fieldKey = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** A short fact shown in the infobox. */
const f = (label: string, type: TemplateField['type'] = 'text', hint?: string): TemplateField => ({ key: fieldKey(label), label, type, ...(hint ? { hint } : {}) });

/** A long-form part of the article, grouped under a heading, with a guiding question. */
const sec = (group: string, label: string, hint: string, key?: string): TemplateField => ({
  key: key ?? fieldKey(label), label, type: 'textarea', placement: 'section', group, hint,
});

/** A table section, e.g. life stages. */
const tbl = (group: string, label: string, columns: string[], hint: string): TemplateField => ({
  key: fieldKey(label), label, type: 'table', placement: 'section', group, hint, columns,
});

type Seed = Omit<Template, 'id' | 'worldId' | 'order'>;

// ---------- Detailed types ----------

const SPECIES: Seed = {
  name: 'Species',
  icon: 'PawPrint',
  color: '#c58fd6',
  fields: [
    f('Classification'), f('Sapient'), f('Lifespan'), f('Average size'), f('Habitat'), f('Diet'),
    f('Homeland'), f('Population'), f('Languages'), f('Cultures'),
    sec('Overview', 'Core concept', 'What are they, in a paragraph? Just as important: what are they NOT?'),
    sec('Overview', 'Foundational principles', 'The rules that must stay true whenever you write them.'),
    sec('Biology & Anatomy', 'Body plan & build', 'Overall shape, height, proportions, musculature. How do they differ from humans?'),
    sec('Biology & Anatomy', 'Head & face', 'Skull, eyes, breathing, mouth, ears or their equivalents. What gives the head its silhouette?'),
    sec('Biology & Anatomy', 'Skin & coloration', 'Skin, hide or surface; texture, patterns, colour, and how it changes over a lifetime.'),
    sec('Biology & Anatomy', 'Senses & perception', 'What can they sense that humans can\'t, and what are they blind to?'),
    sec('Biology & Anatomy', 'Breathing, diet & metabolism', 'What they eat and drink, how they breathe, what they need to stay healthy.'),
    sec('Biology & Anatomy', 'Distinctive traits', 'Anything else about their bodies that sets them apart.', 'traits'),
    sec('Biology & Anatomy', 'Strengths & vulnerabilities', 'Where they cope better than humans, and where worse. Remember individual variation.'),
    sec('Biology & Anatomy', 'Health, illness & medicine', 'Common ailments, injuries, medical knowledge and care.'),
    tbl('Life Cycle', 'Life stages', ['Stage', 'Age', 'Development'], 'Name each stage, its rough age range, and what changes.'),
    sec('Life Cycle', 'Birth & infancy', 'What does a newborn look like and need? How dependent are infants?'),
    sec('Life Cycle', 'Childhood & development', 'How do children grow, learn and change? What can go wrong?'),
    sec('Life Cycle', 'Adulthood & maturity', 'When are they considered adults, physically and socially? Is it the same thing?'),
    sec('Life Cycle', 'Old age & death', 'How does ageing show? How do they die, and how are the dead treated?'),
    sec('Reproduction & Family', 'Reproduction', 'How do they reproduce? Gestation, births, fertility across life.'),
    sec('Reproduction & Family', 'Family & household', 'Who lives together? Immediate, extended and chosen households.'),
    sec('Reproduction & Family', 'Parenting & care', 'Who raises children? Attachment, neglect, orphans, institutions.'),
    sec('Reproduction & Family', 'Kinship, inheritance & adoption', 'How are relatives counted, property passed on, adoption treated?'),
    sec('Mind & Communication', 'Language & voice', 'How do they speak? Sounds humans can\'t make, dialects, mixed languages.'),
    sec('Mind & Communication', 'Non-verbal communication', 'Expression, posture, signals. What can be faked or hidden?'),
    sec('Mind & Communication', 'Psychology & individual variation', 'Common tendencies, and how much individuals differ from them.'),
    sec('Mind & Communication', 'Names & naming customs', 'How names are given, changed (or not) and used.'),
    sec('Society & Politics', 'Social institutions', 'Guilds, circles, councils, temples: what holds society together?'),
    sec('Society & Politics', 'Political forms', 'One nation or many? City-states, councils, hereditary rule, leagues…'),
    sec('Society & Politics', 'Law & legal personhood', 'Who is a legal person? Contracts, crimes, courts, records.'),
    sec('Society & Politics', 'Economy & work', 'What they produce, trade and are known for. How work is organised.'),
    sec('Society & Politics', 'Wealth & inequality', 'Who has power and money, who doesn\'t, and what that changes.'),
    sec('Culture & Belief', 'Philosophies & religion', 'What do they believe, and how much do they disagree about it?'),
    sec('Culture & Belief', 'Customs & rites', 'Festivals, rites of passage, mourning. Which are universal, which regional?'),
    sec('Culture & Belief', 'Memory, records & arts', 'How do they keep history and make art? How reliable are their records?'),
    sec('Culture & Belief', 'Taboos', 'What is forbidden, shameful or simply not done?'),
    sec('Geography & History', 'Homeland & distribution', 'Where did they come from, and where are they found now?'),
    sec('Geography & History', 'Regional variation', 'How do they differ from place to place, physically and culturally?'),
    sec('Geography & History', 'Origins & migration', 'How did they spread? Overland, by sea, through conquest or trade?'),
    sec('Geography & History', 'Key historical periods', 'The eras that shaped them. Link to timeline events where you can.'),
    sec('Relations with Others', 'Relations with other peoples', 'Trade partners, rivals, neighbours, enemies. How does it vary locally?'),
    sec('Relations with Others', 'Mixed families & compatibility', 'Partnerships, marriages, adoption across peoples. Are offspring possible?'),
    sec('Relations with Others', 'Prejudices', 'What do some of them think of others, and others of them? Who disagrees?'),
    sec('Visual Reference', 'Visual direction', 'How they should look in art. Link concept images and note what is final.'),
    sec('Visual Reference', 'Design rules', 'What to avoid. The traps that would make them look generic.'),
  ],
};

const CULTURE: Seed = {
  name: 'Culture',
  icon: 'Users',
  color: '#d98b7a',
  fields: [
    f('People'), f('Homeland'), f('Language'), f('Religion'), f('Population'),
    sec('Way of Life', 'Overview', 'Who are they, and what makes their way of life distinct?'),
    sec('Way of Life', 'Daily life', 'An ordinary day for an ordinary person. Food, dress, work, home.'),
    sec('Way of Life', 'Economy & occupations', 'What do they make, grow, trade and depend on?'),
    sec('Society', 'Social structure', 'Classes, households, institutions. Who rises and who doesn\'t?'),
    sec('Society', 'Political forms', 'Who decides things, at what scale?'),
    sec('Society', 'Family & kinship', 'How households and families are organised.'),
    sec('Society', 'Law & justice', 'How disputes are settled and crimes punished.'),
    sec('Values & Belief', 'Values', 'What they admire, fear and look down on.', 'values'),
    sec('Values & Belief', 'Religion & philosophy', 'Beliefs, how strongly held, and how varied.'),
    sec('Values & Belief', 'Customs & festivals', 'Rites, holidays, ceremonies. Which are regional or optional?', 'customs'),
    sec('Values & Belief', 'Taboos', 'What is forbidden or shameful here?'),
    sec('Diversity & Tension', 'Internal diversity', 'Who doesn\'t fit the stereotype? How do members disagree?'),
    sec('Diversity & Tension', 'Tensions & prejudices', 'Conflicts within, and prejudices held by some, about others.'),
    sec('Diversity & Tension', 'Relations with neighbours', 'How they deal with neighbouring cultures and peoples.'),
    sec('History', 'Origins', 'How and where this culture formed.'),
    sec('History', 'Key events', 'The moments that shaped them.'),
  ],
};

const REGION: Seed = {
  name: 'Region',
  icon: 'Mountain',
  color: '#8fbf6a',
  fields: [
    f('Continent'), f('Terrain'), f('Climate'), f('Population'), f('Key resources'), f('Major settlements'),
    sec('Physical Geography', 'Landscape & landforms', 'Mountains, plains, forests, coasts. What does it look like?'),
    sec('Physical Geography', 'Climate & weather', 'Latitude, winds, rain shadows, seasons. Droughts and storms?'),
    sec('Physical Geography', 'Water & drainage', 'Where does every river come from and go? Lakes need outlets or must be closed basins.'),
    sec('Physical Geography', 'Soils & vegetation', 'What grows here, and how fertile is it?'),
    sec('Physical Geography', 'Natural hazards', 'Floods, storms, earthquakes, dangerous coasts.'),
    sec('Human Geography', 'Settlement pattern', 'Where people live and why: water, soil, resources, transport, defence.'),
    sec('Human Geography', 'Economy & resources', 'What the land provides and what people make of it.'),
    sec('Human Geography', 'Transport & routes', 'Roads, passes, rivers, harbours. What is easy to reach, what isn\'t?'),
    sec('Human Geography', 'Peoples & cultures', 'Who lives here? Link the species and cultures.'),
    sec('History & Politics', 'Early settlement', 'Who came first, and how did settlement spread?'),
    sec('History & Politics', 'Political control', 'Who governs which parts? Borders come after geography.'),
    sec('History & Politics', 'Conflicts & tensions', 'Water rights, trade, land, old grudges.'),
  ],
};

const SETTLEMENT: Seed = {
  name: 'Settlement',
  icon: 'Castle',
  color: '#e5c86a',
  fields: [
    f('Type'), f('Region'), f('Population'), f('Governance'), f('Ruler'), f('Founded'),
    sec('Situation', 'Why here?', 'What about this site made people settle: water, crossing, harbour, defence, resources?'),
    sec('Situation', 'Layout & districts', 'Old town and new, rich and poor quarters, landmarks.'),
    sec('Situation', 'Defences', 'Walls, garrisons, natural protection, weak points.'),
    sec('Life', 'Economy & trade', 'What the town makes, sells and needs from elsewhere.'),
    sec('Life', 'People & factions', 'Who lives here, and who is competing for what?'),
    sec('Life', 'Government & law', 'How the place is run, and how well.'),
    sec('Life', 'Daily life', 'Sounds, smells, markets, problems of ordinary people.'),
    sec('History', 'Founding', 'Who founded it, when and why.'),
    sec('History', 'Major events', 'Fires, sieges, plagues, booms, busts.'),
    sec('History', 'Current tensions', 'What is going wrong right now?'),
  ],
};

const ORGANIZATION: Seed = {
  name: 'Organization',
  icon: 'Shield',
  color: '#7f9fe0',
  fields: [
    f('Type'), f('Leader'), f('Headquarters'), f('Founded'), f('Ideology'), f('Allies'), f('Enemies'), f('Symbol'),
    sec('About', 'Purpose & function', 'What does it exist to do, officially and in practice?'),
    sec('About', 'Structure & ranks', 'How is it organised? Who answers to whom?'),
    sec('About', 'Membership', 'Who can join, how, and can people belong to several?'),
    sec('Power', 'Influence & reach', 'Where and over whom does it have power?'),
    sec('Power', 'Internal conflict & corruption', 'Where does it fall short of its ideals? Who is excluded?'),
    sec('History', 'Origins & history', 'How it began and how it changed.'),
  ],
};

const CUSTOM: Seed = {
  name: 'Custom & Tradition',
  icon: 'Flame',
  color: '#f0a05a',
  fields: [
    f('Observed by'), f('Occasion'), f('Frequency'), f('How widespread', 'text', 'e.g. regional, some households, universal'),
    sec('The Custom', 'Practice', 'What actually happens? Who does what?'),
    sec('The Custom', 'Meaning', 'What it means to those who keep it, and to those who don\'t.'),
    sec('The Custom', 'Variations', 'How it differs between regions, classes and families.'),
    sec('The Custom', 'Disagreements', 'Who rejects it, ignores it, or argues about it?'),
    sec('The Custom', 'Origins', 'Where it came from, as far as anyone knows.'),
  ],
};

const CHARACTER: Seed = {
  name: 'Character',
  icon: 'User',
  color: '#e0a458',
  fields: [
    f('Title / Epithet'), f('Species'), f('Pronouns'), f('Born'), f('Died'), f('Occupation'),
    f('Affiliation'), f('Residence'), f('Appearance', 'textarea'), f('Personality', 'textarea'),
    f('Wants'), f('Fears'),
    sec('Story', 'Background', 'Where they come from and what shaped them.'),
    sec('Story', 'Goals & motivations', 'What they want, what they need, and what stands in the way.'),
    sec('Story', 'Strengths & flaws', 'What they\'re good at, and how they get it wrong.'),
    sec('Story', 'Relationships & loyalties', 'Who matters to them, and where loyalties compete.'),
    sec('Story', 'Role in the story', 'Viewpoint, ally, antagonist? Their arc, if they have one.'),
  ],
};

/** Detailed types that can be added to any world (or merged into an existing type of the same name). */
export const TEMPLATE_LIBRARY: Seed[] = [SPECIES, CULTURE, REGION, SETTLEMENT, ORGANIZATION, CUSTOM, CHARACTER];

/** Add the library's fields that a type doesn't have yet. Existing fields and data are untouched. */
export function mergeFields(existing: TemplateField[], incoming: TemplateField[]) {
  const have = new Set(existing.map((x) => x.key));
  const byKey = new Map(incoming.map((x) => [x.key, x]));
  // upgrade matching keys in place (keep the user's label), then append the rest
  const upgraded = existing.map((x) => {
    const lib = byKey.get(x.key);
    return lib && !x.placement ? { ...lib, label: x.label } : x;
  });
  const merged = [...upgraded, ...incoming.filter((x) => !have.has(x.key))];
  // facts first, then sections; library fields in library order, your own extra fields keep their place after them
  const libIndex = new Map(incoming.map((x, i) => [x.key, i]));
  const rank = (x: TemplateField, i: number) => (isSection(x) ? 100000 : 0) + (libIndex.has(x.key) ? libIndex.get(x.key)! : 1000 + i);
  return merged.map((x, i) => ({ x, r: rank(x, i) })).sort((a, b) => a.r - b.r).map((o) => o.x);
}

/** Starter article types. Every world gets its own editable copy. */
export function defaultTemplates(): Seed[] {
  return [
    CHARACTER,
    {
      name: 'Location',
      icon: 'MapPin',
      color: '#6fb38a',
      fields: [f('Type'), f('Region'), f('Population'), f('Ruler'), f('Founded'), f('Climate'), f('Notable features', 'textarea')],
    },
    REGION,
    SETTLEMENT,
    ORGANIZATION,
    SPECIES,
    CULTURE,
    CUSTOM,
    {
      name: 'Religion',
      icon: 'Church',
      color: '#e5c86a',
      fields: [f('Deities'), f('Domains'), f('Symbol'), f('Clergy'), f('Holy sites'), f('Tenets', 'textarea')],
    },
    {
      name: 'Item',
      icon: 'Gem',
      color: '#5fc4c4',
      fields: [f('Type'), f('Creator'), f('Current owner'), f('Material'), f('Rarity'), f('Properties', 'textarea')],
    },
    {
      name: 'Event',
      icon: 'Swords',
      color: '#e07a6f',
      fields: [f('Date'), f('Location'), f('Participants'), f('Cause'), f('Outcome', 'textarea')],
    },
    {
      name: 'Magic & Tech',
      icon: 'Sparkles',
      color: '#9a8cf0',
      fields: [f('Source'), f('Practitioners'), f('Cost'), f('Limits', 'textarea'), f('Prevalence')],
    },
    {
      name: 'Language',
      icon: 'Languages',
      color: '#8fbf6a',
      fields: [f('Speakers'), f('Family'), f('Writing system'), f('Sample phrase')],
    },
    {
      name: 'Myth & Lore',
      icon: 'Scroll',
      color: '#c9a66b',
      fields: [f('Told by'), f('Origin'), f('The truth', 'textarea')],
    },
    {
      name: 'Document',
      icon: 'FileText',
      color: '#a3a3a3',
      fields: [f('Author'), f('Written'), f('Type'), f('Audience')],
    },
    {
      name: 'Quest & Plot',
      icon: 'Flag',
      color: '#f0a05a',
      fields: [f('Status'), f('Quest giver'), f('Hook', 'textarea'), f('Stakes', 'textarea'), f('Reward')],
    },
    {
      name: 'Session',
      icon: 'Dices',
      color: '#6ab0de',
      fields: [f('Session #'), f('Date played'), f('Players present'), f('Loot'), f('Next time', 'textarea')],
    },
    {
      name: 'Note',
      icon: 'StickyNote',
      color: '#9aa0a6',
      fields: [],
    },
  ];
}

export const RELATION_TYPES = [
  'parent of', 'child of', 'sibling of', 'spouse of', 'ally of', 'enemy of', 'rival of', 'friend of',
  'mentor of', 'student of', 'member of', 'leader of', 'serves', 'worships', 'located in', 'rules',
  'created', 'owns', 'founded', 'at war with', 'trades with', 'speaks', 'lives in', 'descended from', 'variant of',
];

/** Section fields render as parts of the article; everything else is a fact in the infobox. */
export const isSection = (fl: TemplateField) => fl.placement === 'section' || fl.type === 'table';

/** Parse a table field's stored value. */
export function parseTable(value: string | undefined, cols: number): string[][] {
  if (!value?.trim()) return [];
  try {
    const rows = JSON.parse(value) as unknown;
    if (Array.isArray(rows)) return rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])).map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ''));
  } catch {
    /* not JSON: treat as a single cell */
  }
  return [[value, ...Array(Math.max(0, cols - 1)).fill('')]];
}
