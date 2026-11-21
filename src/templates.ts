import type { Template, TemplateField } from './db';

const f = (label: string, type: TemplateField['type'] = 'text'): TemplateField => ({
  key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
  label,
  type,
});

type Seed = Omit<Template, 'id' | 'worldId' | 'order'>;

/** Starter article types. Every world gets its own editable copy. */
export function defaultTemplates(): Seed[] {
  return [
    {
      name: 'Character',
      icon: 'User',
      color: '#e0a458',
      fields: [
        f('Title / Epithet'), f('Species'), f('Pronouns'), f('Born'), f('Died'), f('Occupation'),
        f('Affiliation'), f('Residence'), f('Appearance', 'textarea'), f('Personality', 'textarea'),
        f('Wants'), f('Fears'),
      ],
    },
    {
      name: 'Location',
      icon: 'MapPin',
      color: '#6fb38a',
      fields: [f('Type'), f('Region'), f('Population'), f('Ruler'), f('Founded'), f('Climate'), f('Notable features', 'textarea')],
    },
    {
      name: 'Organization',
      icon: 'Shield',
      color: '#7f9fe0',
      fields: [f('Type'), f('Leader'), f('Headquarters'), f('Founded'), f('Ideology'), f('Allies'), f('Enemies'), f('Symbol')],
    },
    {
      name: 'Species',
      icon: 'PawPrint',
      color: '#c58fd6',
      fields: [f('Classification'), f('Sapient'), f('Lifespan'), f('Average size'), f('Habitat'), f('Diet'), f('Traits', 'textarea')],
    },
    {
      name: 'Culture',
      icon: 'Users',
      color: '#d98b7a',
      fields: [f('Homeland'), f('Language'), f('Religion'), f('Values', 'textarea'), f('Customs', 'textarea')],
    },
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
  'created', 'owns', 'founded', 'at war with', 'trades with',
];
