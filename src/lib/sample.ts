import { createArticle, createWorld, db, uid, type Article } from '../db';

function islandPath(cx: number, cy: number, r: number, seed: number, points = 28) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (0.7 + rnd() * 0.5);
    pts.push([cx + Math.cos(a) * rr * 1.3, cy + Math.sin(a) * rr]);
  }
  return 'M' + pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' L') + ' Z';
}

function sampleMapSvg() {
  const w = 1600;
  const h = 1000;
  const land = [
    islandPath(520, 430, 260, 7),
    islandPath(1120, 360, 190, 21),
    islandPath(1000, 760, 140, 33),
    islandPath(300, 820, 90, 48, 18),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><radialGradient id="sea" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#2c5568"/><stop offset="1" stop-color="#172f3c"/></radialGradient>
<pattern id="waves" width="60" height="30" patternUnits="userSpaceOnUse"><path d="M0 15 q15 -8 30 0 t30 0" fill="none" stroke="#ffffff" stroke-opacity=".06" stroke-width="2"/></pattern></defs>
<rect width="${w}" height="${h}" fill="url(#sea)"/><rect width="${w}" height="${h}" fill="url(#waves)"/>
${land.map((d) => `<path d="${d}" fill="#3b2f22" opacity=".5" transform="translate(6,10)"/><path d="${d}" fill="#c9b48a" stroke="#6b5636" stroke-width="4"/>`).join('')}
<path d="${islandPath(560, 420, 110, 90, 16)}" fill="#8fa06a" opacity=".6"/><path d="${islandPath(1130, 340, 80, 12, 14)}" fill="#8fa06a" opacity=".6"/>
<g fill="#5b4a33" opacity=".75"><path d="M470 360 l30 -55 l30 55 z"/><path d="M515 375 l26 -46 l26 46 z"/><path d="M440 390 l22 -40 l22 40 z"/></g>
<g transform="translate(1440,150)" stroke="#e8dcc0" fill="none" stroke-width="3"><circle r="60" opacity=".5"/><path d="M0 -80 L12 0 L0 80 L-12 0 Z" fill="#e8dcc0" opacity=".8"/><path d="M-80 0 L0 -10 L80 0 L0 10 Z" fill="#e8dcc0" opacity=".4"/></g>
<text x="800" y="70" text-anchor="middle" font-family="Georgia,serif" font-size="44" fill="#e8dcc0" letter-spacing="10" opacity=".85">THE SHATTERED REACH</text>
</svg>`;
}

/** A small example world that shows off every feature. */
export async function createSampleWorld() {
  const world = await createWorld('The Shattered Reach', 'An archipelago of glass-veined islands, three centuries after the sky cracked.');
  await db.worlds.update(world.id, { yearSuffix: 'AS' });
  const templates = await db.templates.where('worldId').equals(world.id).toArray();
  const T = (name: string) => templates.find((t) => t.name === name)!.id;

  const mk = (title: string, template: string, init: Partial<Article>) =>
    createArticle(world.id, { title, templateId: T(template), status: 'draft', ...init });

  const city = await mk('Vel Ashara', 'Location', {
    summary: 'Harbor capital of the Reach, built on the bones of a fallen glass spire.',
    fields: { type: 'City', region: 'Ashen Isle', population: '~40,000', ruler: '[[Ilsabet Varr]]', founded: '12 AS', climate: 'Wet, windy, salt-heavy' },
    tags: ['capital', 'port'],
    status: 'done',
    pinned: true,
    body: `## Overview
Vel Ashara clings to the cliffs around the **Spire Stump**, a shard of sky-glass that fell during [[The Sundering]]. The city is ruled from the Lantern Court by [[Ilsabet Varr|Queen Ilsabet]].

## Districts
- **The Stump**: the old spire and the palace built inside it.
- **Saltmarket**: docks, tar, smugglers; [[Kesh Morrow]] keeps a room above a net-mender's shop.
- **Glasshollow**: where the [[Aelith]] live and work the shards.

## Points of interest
The [[Tidewardens]] keep a chapel on the breakwater. Locals swear the [[Drowned Library]] lies beneath the harbor.

:::secret What the GM knows
The Spire Stump is still *growing*, a few inches a year. Only the Queen's glasswrights know.
:::`,
  });

  const queen = await mk('Ilsabet Varr', 'Character', {
    aliases: ['Queen Ilsabet', 'The Lantern Queen'],
    summary: 'Third monarch of the Reach. Calm in public, desperate in private.',
    parentId: null,
    fields: { title_epithet: 'The Lantern Queen', species: 'Human', pronouns: 'she/her', born: '289 AS', occupation: 'Queen of the Reach', affiliation: '[[The Ember Concord]]', residence: '[[Vel Ashara]]', wants: 'To keep the islands united', fears: 'The Crown will finish what the Sundering began' },
    tags: ['royalty', 'npc'],
    body: `Ilsabet took the throne at twenty-three after her mother vanished at sea. She rules through [[The Ember Concord]], a council of merchant houses she does not fully trust.

:::secret
She wears a replica. The real [[The Pale Crown]] is locked beneath the Spire Stump, and it whispers to her.
:::`,
  });

  const kesh = await mk('Kesh Morrow', 'Character', {
    summary: 'Smuggler, liar, occasional hero. Owes money to half of Saltmarket.',
    fields: { species: '[[Aelith]]', pronouns: 'he/him', born: '341 AS', occupation: 'Smuggler', affiliation: '[[Tidewardens]] (lapsed)', residence: '[[Vel Ashara]], Saltmarket', personality: 'Charming, evasive, loyal to a fault once won over.' },
    tags: ['npc', 'ally'],
    body: `Kesh runs glass and gossip between the islands in a cutter called *Second Chance*. He was raised by the [[Tidewardens]] and left on bad terms.`,
  });

  const concord = await mk('The Ember Concord', 'Organization', {
    summary: 'Council of seven merchant houses that funds, and quietly steers, the throne.',
    fields: { type: 'Mercantile council', leader: '[[Ilsabet Varr]] (nominal)', headquarters: '[[Vel Ashara]]', founded: '120 AS', ideology: 'Trade above all' },
    body: `Seven houses, seven votes, one Queen who breaks ties. Every house keeps a ledger of favors owed.`,
  });

  const wardens = await mk('Tidewardens', 'Religion', {
    summary: 'Sea-monks who read omens in the tides and bury the drowned.',
    fields: { deities: 'The Deep Mother', domains: 'Sea, death, memory', symbol: 'A closed eye over waves', holy_sites: 'Breakwater Chapel, [[Vel Ashara]]' },
    body: `The Tidewardens believe the Sundering was the sky *closing its eye*. They keep records of every drowning since 0 AS.`,
  });

  await mk('Aelith', 'Species', {
    summary: 'Glass-veined people born near sky-shards. Their skin catches the light.',
    fields: { classification: 'Humanoid', sapient: 'Yes', lifespan: '~90 years', habitat: 'Coastal shard-fields', traits: 'Translucent veins that glow under stress. Resistant to shard-sickness.' },
    body: `Aelith first appeared a generation after [[The Sundering]]. Most live in Glasshollow in [[Vel Ashara]].`,
  });

  const sundering = await mk('The Sundering', 'Event', {
    summary: 'The day the sky cracked and rained glass across the old continent.',
    fields: { date: '0 AS', location: 'Everywhere', outcome: 'The continent shattered into the Reach. Year zero of the calendar.' },
    status: 'done',
    body: `No one alive remembers it. The [[Tidewardens]] remember it for them.`,
  });

  const crown = await mk('The Pale Crown', 'Item', {
    gmOnly: true,
    summary: 'The artifact that caused the Sundering. Its existence is the realm\'s deepest secret.',
    fields: { type: 'Artifact', creator: 'Unknown', current_owner: '[[Ilsabet Varr]]', rarity: 'Unique', properties: 'Speaks to its wearer. Can mend, or finish breaking, the sky.' },
    body: `Players should never see this article until they find the vault beneath the Spire Stump.`,
  });

  const session = await mk('Session 1: Smoke over the Harbor', 'Session', {
    fields: { session: '1', date_played: '2026-11-14', players_present: 'Ana, Ben, Cho', loot: '40 crowns, a cracked lens', next_time: 'Find out who hired the arsonists.' },
    body: `The party arrived in [[Vel Ashara]] as Saltmarket burned. They met [[Kesh Morrow]], who pulled them off a sinking pier, then lied about everything.`,
    status: 'done',
  });

  await createArticle(world.id, { title: 'Saltmarket', templateId: T('Location'), parentId: city.id, summary: 'The docks district of Vel Ashara.', fields: { type: 'District' } });

  const rel = (from: Article, type: string, to: Article) => ({ id: uid(), worldId: world.id, fromId: from.id, toId: to.id, type });
  await db.relations.bulkAdd([
    rel(queen, 'leader of', concord),
    rel(queen, 'rules', city),
    rel(queen, 'owns', crown),
    rel(kesh, 'member of', wardens),
    rel(kesh, 'rival of', concord),
    rel(crown, 'created', sundering),
  ]);

  const svg = sampleMapSvg();
  const mapId = uid();
  await db.maps.add({
    id: mapId,
    worldId: world.id,
    name: 'The Shattered Reach',
    image: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
    width: 1600,
    height: 1000,
    createdAt: Date.now(),
    pins: [
      { id: uid(), x: 0.36, y: 0.47, label: 'Vel Ashara', articleId: city.id, color: '#e0a458' },
      { id: uid(), x: 0.31, y: 0.3, label: 'Breakwater Chapel', articleId: wardens.id, color: '#6ab0de' },
      { id: uid(), x: 0.38, y: 0.5, label: 'Crown Vault', articleId: crown.id, color: '#e07a6f', gmOnly: true, note: 'Beneath the Spire Stump.' },
      { id: uid(), x: 0.7, y: 0.36, label: 'Glassfall Isle', color: '#6fb38a', note: 'Unexplored. Shard-fields everywhere.' },
    ],
  });

  const history = (await db.timelines.where('worldId').equals(world.id).first())!;
  const keshLine = { id: uid(), worldId: world.id, name: "Kesh's life", color: '#6ab0de' };
  await db.timelines.add(keshLine);
  await db.eras.bulkAdd([
    { id: uid(), worldId: world.id, name: 'The Age of Glass', start: -900, end: 0, color: '#9a8cf0' },
    { id: uid(), worldId: world.id, name: 'The Reach Era', start: 0, end: 400, color: '#e0a458' },
  ]);
  const ev = (timelineId: string, year: number, title: string, description: string, articleId: string | null = null, gmOnly = false) => ({
    id: uid(), worldId: world.id, timelineId, year, title, description, articleId, gmOnly, endYear: null,
  });
  await db.events.bulkAdd([
    ev(history.id, -880, 'The first sky-spires are raised', 'The old empire builds towers of living glass.'),
    ev(history.id, -12, 'The Pale Crown is forged', 'In secret, by the last spire-king.', crown.id, true),
    ev(history.id, 0, 'The Sundering', 'The sky cracks. Year zero.', sundering.id),
    ev(history.id, 12, 'Vel Ashara founded', 'Survivors settle around the Spire Stump.', city.id),
    ev(history.id, 120, 'The Ember Concord forms', 'Seven houses sign the Lantern Accord.', concord.id),
    ev(history.id, 312, 'Ilsabet crowned', 'After her mother is lost at sea.', queen.id),
    ev(keshLine.id, 341, 'Kesh Morrow born', 'Left on the Breakwater Chapel steps.', kesh.id),
    ev(keshLine.id, 360, 'Kesh leaves the [[Tidewardens]]', 'Nobody will say why.', kesh.id),
    ev(history.id, 368, 'Session 1: Saltmarket burns', 'The campaign begins.', session.id),
  ]);
  return world.id;
}
