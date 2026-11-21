# Signal9 Worlds

A private, local-first worldbuilding wiki for novels and tabletop campaigns. It covers the same ground as World Anvil (articles, maps, timelines, relationships, secrets) without the subscription, the BBCode or the lock-in.

Everything is stored in your browser (IndexedDB). Nothing is sent anywhere. You can export at any time to a plain JSON file, an Obsidian-compatible Markdown vault, or a single HTML "player wiki".

## Features

| Area | What you get |
| --- | --- |
| **Articles** | 18 starter types. Short **facts** go in the sidebar box; detailed types (Species, Culture, Region, Settlement, Organization, Custom & Tradition, Character) also have long-form **sections** grouped under headings, each with a guiding question, plus **tables** (e.g. life stages). Markdown body, summary line, aliases, tags, image, nesting, writing progress (stub, draft, finished). Long articles get a contents panel that follows your reading, collapsible sections, and a tree of sub-pages. |
| **Canon status** | Mark articles, individual facts/sections and passages as **Established, Provisional, Unresolved, Visual reference or Not canon** (`:::provisional … :::` blocks, or the dot beside any field). A sidebar lens shows *All material*, *Hide not-canon* or *Established only*. |
| **Open questions** | Attach undecided questions to any article (or the world), record the decision when you make it, and track them all on the **Canon & questions** page with every marked passage. |
| **Wiki links** | Type `[[` for autocomplete. Links to things you haven't written yet show in red; click one to create it. Hover any link for a preview. Every article lists what links to it ("Mentioned in"). Renaming an article rewrites links everywhere. |
| **Secrets** | Wrap text in `:::secret … :::` or mark a whole article, pin or event GM-only. **Player view** (sidebar toggle) hides all of it. |
| **Relationships** | Typed links between articles (ally of, member of, rules, parent of…), which also power the family trees and the connections graph. |
| **Family trees** | Drawn automatically from parent / child / spouse / sibling relationships, laid out by generation with couples side by side. Add relatives (existing or brand-new characters) right from the tree. |
| **Connections graph** | Force-directed map of links, relationships and nesting. Focus on one article and see N steps out. |
| **Maps** | Upload any image. Pan, zoom, drop color-coded pins that link to articles, or to other maps for drill-down (continent → city → building). Draw **regions** (borders, territories) linked to articles, organise pins and regions into **layers** (with optional overlay images, GM-only or hidden by default), and cover unexplored areas with **fog of war** that players can't see through. |
| **Timeline & calendar** | Parallel tracks, eras, negative years, date ranges. Build your own **calendar** (months, weekdays, any number of moons) or start from a preset; events can have a month and day ("21st of Highsun, 312 AS") and there's a month-grid calendar view with moon phases. |
| **Embeds** | `![[Article]]` shows an article card, `![[Article#Heading]]` pulls in one section, `![[map:Name]]` a live mini-map, `![[timeline]]` or `![[timeline:Track or Article]]` a chronicle. Autocomplete suggests all of them. |
| **Manuscripts** | Novel mode: chapters and scenes in a binder, a distraction-free editor with `[[links]]`, point-of-view and location per scene, status (idea → final), word goals, daily progress and streaks, focus mode, a typeset read-through, and Markdown export. Articles list the scenes they appear in. |
| **World health** | **Name clashes** (identical or easily confused names across articles, aliases, pins and regions: *Serevan / Serevann*, *Serrath / Sarrath*), unwritten links, orphans, stubs, sparse infoboxes, and *secret leaks*. The editor also warns as you type a lookalike title. |
| **Article types** | Rename, recolor, re-icon any type; add facts, sections and tables; set group headings and guiding questions; make your own. A **Detailed types** library adds or upgrades types in existing worlds without touching your data. |
| **Prompts & names** | 40 worldbuilding prompts (one click turns an answer into a note) and a 5-style name generator. |
| **Search** | `Ctrl+K` / `⌘K` palette: fuzzy search, commands, and "create X as Character" in one place. |
| **Version history** | A snapshot is saved each time you start editing an article; restore any of the last 30. |
| **Trash & undo** | Deleting an article, map, event, manuscript or whole world shows an **Undo** bar and keeps it in the trash for 30 days. Restoring puts back its links, relationships, pins and scenes. |
| **Backups** | World file (.json), Markdown vault (.zip), Player wiki (.html), plus an optional **auto-backup file** (Chrome/Edge) that is rewritten after every change; point it at a OneDrive/Dropbox folder. |

### What's better than World Anvil

- **No paywall.** Secrets, privacy and every tool are included because it's yours.
- **Markdown instead of BBCode**, with live preview and `[[link]]` autocomplete.
- **Red links + world health**: the app tells you what you still need to write.
- **Secret-leak detection** before you show players anything.
- **Offline and instant.** No page loads, no ads, no account.
- **No lock-in.** The Markdown export opens directly in Obsidian.
- **Editable article types**, rather than fixed templates.

## Running it

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Publishing on GitHub Pages

Live at **https://dogowar01.github.io/signal9-worlds/**.

To publish a new version after making changes:

```bash
npm run deploy     # builds and pushes dist/ to the gh-pages branch
```

GitHub Pages serves the `gh-pages` branch (Settings → Pages → Deploy from a branch → `gh-pages` / root). Updates usually appear within a minute.

## Installing it as an app (Mac or PC)

Signal9 Worlds is an installable web app: it gets its own window and Dock/taskbar icon, and it works offline.

- **Chrome or Edge (recommended):** open https://dogowar01.github.io/signal9-worlds/ and click the install icon at the right of the address bar, or use **Install app** on the home screen. On a Mac it lands in Launchpad / Applications (Chrome Apps) and you can keep it in the Dock.
- **Safari on macOS 14+:** File → **Add to Dock**.

Chrome/Edge is the better choice because the automatic backup file only works there.

## Updates

- The installed app checks the live site for a new version on launch, every 30 minutes, and when you come back to it. When there is one, it shows **"A new version is ready → Update now"**.
- **Settings & export → App** shows your version and has a **Check for updates** button.
- Updating never touches your worlds; they stay in the app's local storage.
- To ship a change: edit the code, bump `"version"` in `package.json` if you like, then run `npm run deploy`.

The hosted site is just the app. Your worlds still live only in the browser you use. Use **Settings & export → World file** or the auto-backup file to move worlds between devices.

## Writing tips

```markdown
## History
[[Ilsabet Varr|The Queen]] took the throne in 312 AS.

:::secret What the GM knows
She wears a replica crown.
:::
```

- `[[Title]]` or `[[Title|shown text]]` links anywhere: body, summary, sidebar fields, timeline descriptions.
- `Ctrl+B` / `Ctrl+I` for bold and italic, `Ctrl+S` to save immediately (it also autosaves).

## Tech

React 19, TypeScript, Vite, Dexie (IndexedDB), marked + DOMPurify, JSZip, lucide icons. No backend.

```
src/
  db.ts              data model + write helpers
  templates.ts       starter article types
  lib/               markdown, links index, search, import/export, sample world, prompts
  components/        sidebar, command palette, editor, pickers
  pages/             one file per screen
```
