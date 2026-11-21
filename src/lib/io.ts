import JSZip from 'jszip';
import {
  db, uid, type Article, type Era, type Manuscript, type ManuscriptNode, type Question, type Relation, type Template, type Timeline, type TimelineEvent, type World,
  type WorldMap,
} from '../db';
import { buildIndex } from './links';
import { renderInline, renderMarkdown } from './markdown';
import { compareEvents, formatEventDate, getCalendar } from './calendar';
import { isSection, parseTable } from '../templates';
import type { TemplateField } from '../db';

function groupFields(fields: TemplateField[]) {
  const groups: { name: string; fields: TemplateField[] }[] = [];
  for (const fl of fields.filter(isSection)) {
    const name = fl.group?.trim() || 'Details';
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, fields: [] }));
    g.fields.push(fl);
  }
  return groups;
}

function tableHtml(f: TemplateField, value: string, cell: (s: string) => string) {
  const cols = f.columns?.length ? f.columns : ['Column'];
  const rows = parseTable(value, cols.length).filter((r) => r.some((x) => x.trim()));
  const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<table><thead><tr>${cols.map((c) => `<th>${e(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${cell(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

/** Section fields as Markdown headings (tables as Markdown tables), for the vault export. */
function sectionsMarkdown(a: Article, fields: TemplateField[]) {
  const out: string[] = [];
  for (const g of groupFields(fields)) {
    const filled = g.fields.filter((f) => a.fields[f.key]?.trim());
    if (!filled.length) continue;
    out.push('', `## ${g.name}`);
    for (const f of filled) {
      const st = a.fieldCanon?.[f.key];
      out.push('', `### ${f.label}${st ? ` _(${st})_` : ''}`, '');
      if (f.type === 'table') {
        const cols = f.columns?.length ? f.columns : ['Column'];
        const rows = parseTable(a.fields[f.key], cols.length).filter((r) => r.some((x) => x.trim()));
        out.push(`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map((x) => x.replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`));
      } else out.push(a.fields[f.key].trim());
    }
  }
  return out.join('\n');
}

/** One Markdown document: chapters as headings, scenes separated by a break. */
export function compileManuscript(ms: Manuscript, nodes: ManuscriptNode[]) {
  const mine = nodes.filter((n) => n.manuscriptId === ms.id);
  const chapters = mine.filter((n) => n.kind === 'chapter').sort((a, b) => a.order - b.order);
  const out = [`# ${ms.title}`, ms.subtitle ? `_${ms.subtitle}_` : '', ''];
  for (const ch of chapters) {
    out.push(`## ${ch.title || 'Untitled chapter'}`, '');
    if (ch.body.trim()) out.push(ch.body.trim(), '');
    const scenes = mine.filter((n) => n.parentId === ch.id).sort((a, b) => a.order - b.order);
    scenes.forEach((s, i) => {
      if (i > 0) out.push('', '* * *', '');
      out.push(s.body.trim(), '');
    });
  }
  return out.join('\n');
}

export interface WorldExport {
  format: 'signal9-world';
  version: 1;
  exportedAt: string;
  world: World;
  articles: Article[];
  templates: Template[];
  relations: Relation[];
  maps: WorldMap[];
  timelines: Timeline[];
  events: TimelineEvent[];
  eras: Era[];
  manuscripts?: Manuscript[];
  scenes?: ManuscriptNode[];
  questions?: Question[];
}

export async function exportWorld(worldId: string): Promise<WorldExport> {
  const by = <T,>(t: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<T[]> } } }) =>
    t.where('worldId').equals(worldId).toArray();
  const world = await db.worlds.get(worldId);
  if (!world) throw new Error('World not found');
  return {
    format: 'signal9-world',
    version: 1,
    exportedAt: new Date().toISOString(),
    world,
    articles: await by<Article>(db.articles),
    templates: await by<Template>(db.templates),
    relations: await by<Relation>(db.relations),
    maps: await by<WorldMap>(db.maps),
    timelines: await by<Timeline>(db.timelines),
    events: await by<TimelineEvent>(db.events),
    eras: await by<Era>(db.eras),
    manuscripts: await by<Manuscript>(db.manuscripts),
    scenes: await by<ManuscriptNode>(db.scenes),
    questions: await by<Question>(db.questions),
  };
}

/** Import a world export as a brand new world (all ids are regenerated, so re-importing never clobbers). */
export async function importWorld(data: WorldExport, rename?: string): Promise<string> {
  if (data?.format !== 'signal9-world') throw new Error('Not a Signal9 Worlds export file.');
  const ids = new Map<string, string>();
  const m = (id: string | null | undefined) => {
    if (!id) return id ?? null;
    if (!ids.has(id)) ids.set(id, uid());
    return ids.get(id)!;
  };
  const worldId = m(data.world.id)!;
  const now = Date.now();
  await db.transaction('rw', [db.worlds, db.articles, db.templates, db.relations, db.maps, db.timelines, db.events, db.eras, db.manuscripts, db.scenes, db.questions], async () => {
    await db.worlds.add({ ...data.world, id: worldId, name: rename ?? data.world.name, updatedAt: now });
    await db.templates.bulkAdd(data.templates.map((t) => ({ ...t, id: m(t.id)!, worldId })));
    await db.articles.bulkAdd(
      data.articles.map((a) => ({ ...a, id: m(a.id)!, worldId, templateId: m(a.templateId)!, parentId: m(a.parentId) })),
    );
    await db.relations.bulkAdd(data.relations.map((r) => ({ ...r, id: m(r.id)!, worldId, fromId: m(r.fromId)!, toId: m(r.toId)! })));
    await db.maps.bulkAdd(
      data.maps.map((mp) => ({
        ...mp,
        id: m(mp.id)!,
        worldId,
        parentMapId: m(mp.parentMapId),
        pins: mp.pins.map((p) => ({ ...p, id: uid(), articleId: m(p.articleId), mapId: m(p.mapId), layerId: m(p.layerId) })),
        layers: (mp.layers ?? []).map((l) => ({ ...l, id: m(l.id)! })),
        regions: (mp.regions ?? []).map((r) => ({ ...r, id: uid(), articleId: m(r.articleId), layerId: m(r.layerId) })),
      })),
    );
    await db.timelines.bulkAdd(data.timelines.map((t) => ({ ...t, id: m(t.id)!, worldId })));
    await db.events.bulkAdd(
      data.events.map((e) => ({ ...e, id: m(e.id)!, worldId, timelineId: m(e.timelineId)!, articleId: m(e.articleId) })),
    );
    await db.eras.bulkAdd((data.eras ?? []).map((e) => ({ ...e, id: m(e.id)!, worldId })));
    await db.manuscripts.bulkAdd((data.manuscripts ?? []).map((ms) => ({ ...ms, id: m(ms.id)!, worldId })));
    await db.scenes.bulkAdd(
      (data.scenes ?? []).map((s) => ({
        ...s, id: m(s.id)!, worldId, manuscriptId: m(s.manuscriptId)!, parentId: m(s.parentId), povId: m(s.povId), locationId: m(s.locationId),
      })),
    );
    await db.questions.bulkAdd((data.questions ?? []).map((q) => ({ ...q, id: m(q.id)!, worldId, articleId: m(q.articleId) })));
  });
  return worldId;
}

export function download(filename: string, data: Blob | string, type = 'application/octet-stream') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const safeName = (s: string) => s.replace(/[\\/:*?"<>|#^[\]]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'untitled';
const stamp = () => new Date().toISOString().slice(0, 10);

export async function downloadWorldJson(worldId: string) {
  const data = await exportWorld(worldId);
  download(`${safeName(data.world.name)} ${stamp()}.s9world.json`, JSON.stringify(data), 'application/json');
}

function yamlStr(v: string) {
  return JSON.stringify(v); // JSON strings are valid YAML scalars
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; ext: string } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const ext = mime.includes('svg') ? 'svg' : mime.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  if (m[2]) {
    const bin = atob(m[3]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, ext };
  }
  return { bytes: new TextEncoder().encode(decodeURIComponent(m[3])), ext };
}

/** Obsidian-compatible vault: one .md per article with YAML front matter; [[links]] work as-is. */
export async function downloadMarkdownZip(worldId: string) {
  const data = await exportWorld(worldId);
  const zip = new JSZip();
  const tpl = new Map(data.templates.map((t) => [t.id, t]));
  const byId = new Map(data.articles.map((a) => [a.id, a]));
  for (const a of data.articles) {
    const t = tpl.get(a.templateId);
    const folder = safeName(t?.name ?? 'Notes');
    const lines = ['---', `title: ${yamlStr(a.title)}`, `type: ${yamlStr(t?.name ?? 'Note')}`, `status: ${a.status}`];
    if (a.aliases.length) lines.push(`aliases: [${a.aliases.map(yamlStr).join(', ')}]`);
    if (a.tags.length) lines.push(`tags: [${a.tags.map(yamlStr).join(', ')}]`);
    if (a.gmOnly) lines.push('gm_only: true');
    if (a.parentId && byId.get(a.parentId)) lines.push(`parent: ${yamlStr(`[[${byId.get(a.parentId)!.title}]]`)}`);
    const reserved = new Set(['title', 'type', 'status', 'aliases', 'tags', 'gm_only', 'parent', 'relations']);
    if (a.canon) lines.push(`canon: ${a.canon}`);
    for (const f of t?.fields ?? []) {
      if (!a.fields[f.key]?.trim() || isSection(f)) continue;
      lines.push(`${reserved.has(f.key) ? `field_${f.key}` : f.key}: ${yamlStr(a.fields[f.key])}`);
    }
    const rels = data.relations.filter((r) => r.fromId === a.id && byId.get(r.toId));
    if (rels.length) lines.push(`relations: [${rels.map((r) => yamlStr(`${r.type} [[${byId.get(r.toId)!.title}]]`)).join(', ')}]`);
    lines.push('---', '');
    if (a.image) {
      const img = dataUrlToBytes(a.image);
      if (img) {
        const name = `${safeName(a.title)}.${img.ext}`;
        zip.file(`_images/${name}`, img.bytes);
        lines.push(`![[${name}]]`, '');
      }
    }
    if (a.summary) lines.push(`> ${a.summary}`, '');
    lines.push(a.body);
    lines.push(sectionsMarkdown(a, t?.fields ?? []));
    const qs = (data.questions ?? []).filter((q) => q.articleId === a.id);
    if (qs.length) lines.push('', '## Open questions', '', ...qs.map((q) => `- [${q.status === 'open' ? ' ' : 'x'}] ${q.text}${q.answer ? ` — **${q.answer}**` : ''}`));
    zip.file(`${folder}/${safeName(a.title)}.md`, lines.join('\n'));
  }
  for (const mp of data.maps) {
    const img = dataUrlToBytes(mp.image);
    if (img) zip.file(`_maps/${safeName(mp.name)}.${img.ext}`, img.bytes);
    zip.file(`_maps/${safeName(mp.name)}.pins.json`, JSON.stringify(mp.pins, null, 2));
  }
  const tl = new Map(data.timelines.map((t) => [t.id, t.name]));
  const events = [...data.events].sort(compareEvents(getCalendar(data.world)));
  if (events.length) {
    zip.file(
      'Timeline.md',
      ['# Timeline', '', ...events.map((e) => `- **${formatEventDate(data.world, e)}** · ${e.title} _(${tl.get(e.timelineId) ?? ''})_${e.description ? ` — ${e.description}` : ''}`)].join('\n'),
    );
  }
  for (const ms of data.manuscripts ?? []) {
    zip.file(`_manuscripts/${safeName(ms.title)}.md`, compileManuscript(ms, data.scenes ?? []));
  }
  zip.file('world.s9world.json', JSON.stringify(data));
  const blob = await zip.generateAsync({ type: 'blob' });
  download(`${safeName(data.world.name)} ${stamp()} markdown.zip`, blob);
}

/** A single self-contained HTML wiki for players: no GM-only articles, no secrets. */
export async function downloadPlayerWiki(worldId: string) {
  const data = await exportWorld(worldId);
  const visible = data.articles.filter((a) => !a.gmOnly && a.canon !== 'notcanon').sort((x, y) => x.title.localeCompare(y.title));
  const index = buildIndex(data.articles);
  const tpl = new Map(data.templates.map((t) => [t.id, t]));
  const ctx = {
    resolve: index.resolve,
    playerView: true,
    href: (a: Article) => `#a-${a.id}`,
    typeOf: (a: Article) => {
      const t = tpl.get(a.templateId);
      return t ? { name: t.name, color: t.color } : undefined;
    },
  };
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sections = visible.map((a) => {
    const t = tpl.get(a.templateId);
    const hiddenForPlayers = (k: string) => ['unresolved', 'visual', 'notcanon'].includes(a.fieldCanon?.[k] ?? '');
    const sections = groupFields(t?.fields ?? [])
      .map((g) => ({ ...g, fields: g.fields.filter((f) => a.fields[f.key]?.trim() && !hiddenForPlayers(f.key)) }))
      .filter((g) => g.fields.length)
      .map((g) => `<h2>${esc(g.name)}</h2>${g.fields.map((f) => `<h3>${esc(f.label)}</h3>${f.type === 'table' ? tableHtml(f, a.fields[f.key], (s) => renderInline(s, ctx)) : renderMarkdown(a.fields[f.key], ctx)}`).join('')}`)
      .join('');
    const facts = (t?.fields ?? [])
      .filter((f) => !isSection(f) && a.fields[f.key]?.trim() && !hiddenForPlayers(f.key))
      .map((f) => `<dt>${esc(f.label)}</dt><dd>${renderInline(a.fields[f.key], ctx)}</dd>`)
      .join('');
    return `<section id="a-${a.id}" class="page"><p class="type" style="color:${t?.color ?? '#999'}">${esc(t?.name ?? '')}</p><h1>${esc(a.title)}</h1>${a.summary ? `<p class="lead">${renderInline(a.summary, ctx)}</p>` : ''}<div class="cols"><div class="body">${renderMarkdown(a.body, ctx)}${sections}</div>${a.image || facts ? `<aside>${a.image ? `<img src="${a.image}" alt="">` : ''}${facts ? `<dl>${facts}</dl>` : ''}</aside>` : ''}</div></section>`;
  });
  const events = data.events.filter((e) => !e.gmOnly).sort(compareEvents(getCalendar(data.world)));
  const timeline = events.length
    ? `<section id="timeline" class="page"><h1>Timeline</h1><ol class="tl">${events.map((e) => `<li><b>${esc(formatEventDate(data.world, e))}</b> ${esc(e.title)}${e.description ? `<div>${renderInline(e.description, ctx)}</div>` : ''}</li>`).join('')}</ol></section>`
    : '';
  const nav = visible.map((a) => `<li><a href="#a-${a.id}">${esc(a.title)}</a></li>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.world.name)}</title><style>
:root{--bg:#f7f4ee;--fg:#2a2620;--muted:#7a7266;--panel:#fffdf8;--line:#e4ddd0;--accent:#a8581f}
@media (prefers-color-scheme:dark){:root{--bg:#15161a;--fg:#e7e3da;--muted:#9b958a;--panel:#1d1f24;--line:#2e3138;--accent:#e0a458}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 "Iowan Old Style","Palatino Linotype",Georgia,serif;display:flex;min-height:100vh}
nav{width:260px;flex:none;border-right:1px solid var(--line);padding:20px;position:sticky;top:0;height:100vh;overflow:auto;font-family:system-ui,sans-serif;font-size:14px}
nav ul{list-style:none;padding:0;margin:0}nav li a{display:block;padding:3px 6px;border-radius:4px;color:var(--fg);text-decoration:none}nav li a:hover{background:var(--panel)}
main{flex:1;padding:32px 48px;max-width:1100px}a{color:var(--accent)}.page{display:none}.page:target,.page.home{display:block}
.type{font:600 12px system-ui;text-transform:uppercase;letter-spacing:.08em;margin:0}.lead{font-size:1.15em;color:var(--muted);font-style:italic}
.cols{display:flex;gap:32px;align-items:flex-start}.body{flex:1;min-width:0}aside{width:280px;flex:none;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px;font-family:system-ui;font-size:14px}
aside img{width:100%;border-radius:6px}dt{font-weight:600;color:var(--muted);font-size:12px;text-transform:uppercase;margin-top:8px}dd{margin:0}
.tl{border-left:2px solid var(--line);padding-left:20px}.tl li{margin-bottom:12px}
@media (max-width:760px){body{display:block}nav{position:static;width:auto;height:auto;border-right:0;border-bottom:1px solid var(--line)}main{padding:20px 16px}.cols{flex-direction:column}aside{width:100%}}
</style></head><body><nav><h2 style="margin-top:0"><a href="#home" style="text-decoration:none;color:inherit">${esc(data.world.name)}</a></h2>${timeline ? '<p><a href="#timeline">Timeline</a></p>' : ''}<ul>${nav}</ul></nav><main>
<section id="home" class="page home"><h1>${esc(data.world.name)}</h1><p class="lead">${esc(data.world.description)}</p><p>${visible.length} articles. Pick one from the list.</p></section>
${sections.join('\n')}${timeline}</main>
<script>function s(){var h=location.hash.slice(1);document.querySelector('.home').style.display=h&&h!=='home'&&document.getElementById(h)?'none':'block';scrollTo(0,0)}addEventListener('hashchange',s);s()</script></body></html>`;
  download(`${safeName(data.world.name)} player wiki.html`, html, 'text/html');
}

// ---------- Linked backup file (File System Access API, Chromium browsers) ----------

type Handle = FileSystemFileHandle & {
  queryPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
};

export const fileSyncSupported = () => typeof window !== 'undefined' && 'showSaveFilePicker' in window;

export async function linkBackupFile(worldId: string, worldName: string) {
  const picker = (window as unknown as { showSaveFilePicker: (o: unknown) => Promise<Handle> }).showSaveFilePicker;
  const handle = await picker({
    suggestedName: `${safeName(worldName)}.s9world.json`,
    types: [{ description: 'Signal9 world', accept: { 'application/json': ['.json'] } }],
  });
  await db.kv.put({ key: `backup:${worldId}`, value: handle });
  await writeBackup(worldId, handle);
}

export async function getBackupHandle(worldId: string) {
  return (await db.kv.get(`backup:${worldId}`))?.value as Handle | undefined;
}

export async function unlinkBackupFile(worldId: string) {
  await db.kv.delete(`backup:${worldId}`);
}

export async function backupPermission(handle: Handle, ask: boolean): Promise<PermissionState> {
  if (!handle.queryPermission) return 'granted';
  const p = await handle.queryPermission({ mode: 'readwrite' });
  if (p === 'granted' || !ask || !handle.requestPermission) return p;
  return handle.requestPermission({ mode: 'readwrite' });
}

export async function writeBackup(worldId: string, handle?: Handle) {
  const h = handle ?? (await getBackupHandle(worldId));
  if (!h) return false;
  const data = await exportWorld(worldId);
  const w = await h.createWritable();
  await w.write(JSON.stringify(data));
  await w.close();
  await db.kv.put({ key: `backupAt:${worldId}`, value: Date.now() });
  return true;
}

// ---------- Images ----------

/** Read an image file, scaling it down so worlds stay small. */
export function imageFileToDataUrl(file: File, maxDim: number): Promise<{ url: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        const w = img.naturalWidth || 1000;
        const h = img.naturalHeight || 1000;
        if (file.type === 'image/svg+xml' || (w <= maxDim && h <= maxDim && file.size < 1_500_000)) {
          resolve({ url: src, width: w, height: h });
          return;
        }
        const k = Math.min(1, maxDim / Math.max(w, h));
        const c = document.createElement('canvas');
        c.width = Math.round(w * k);
        c.height = Math.round(h * k);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        let url = c.toDataURL('image/webp', 0.88);
        if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/png');
        resolve({ url, width: c.width, height: c.height });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
