# Signal9 Worlds

A private, local-first worldbuilding wiki for novels and tabletop campaigns. It covers the same ground as World Anvil (articles, maps, timelines, relationships, secrets) without the subscription, the BBCode or the lock-in.

Everything is stored in your browser (IndexedDB). Nothing is sent anywhere. You can export at any time to a plain JSON file, an Obsidian-compatible Markdown vault, or a single HTML "player wiki".

## Features

| Area | What you get |
| --- | --- |
| **Articles** | 15 starter types (Character, Location, Organization, Species, Culture, Religion, Item, Event, Magic & Tech, Language, Myth & Lore, Document, Quest & Plot, Session, Note), each with its own sidebar fields. Markdown body, summary line, aliases, tags, image, parent/child nesting, status (stub, draft, finished). |
| **Wiki links** | Type `[[` for autocomplete. Links to things you haven't written yet show in red; click one to create it. Hover any link for a preview. Every article lists what links to it ("Mentioned in"). Renaming an article rewrites links everywhere. |
| **Secrets** | Wrap text in `:::secret … :::` or mark a whole article, pin or event GM-only. **Player view** (sidebar toggle) hides all of it. |
| **Relationships** | Typed links between articles (ally of, member of, rules, parent of…). These generalise World Anvil's family trees and diplomacy webs. |
| **Connections graph** | Force-directed map of links, relationships and nesting. Focus on one article and see N steps out. |
| **Maps** | Upload any image. Pan, zoom, drop color-coded pins that link to articles, or to other maps for drill-down (continent → city → building). GM-only pins. |
| **Timeline** | Parallel tracks, eras, negative years, date ranges, custom year label (e.g. "AS"). Events link to articles and appear on those articles. |
| **World health** | Unwritten links, orphans, stubs, sparse infoboxes, and *secret leaks* (public articles naming GM-only ones). |
| **Article types** | Rename, recolor, re-icon any type; add, remove or reorder fields; make your own. |
| **Prompts & names** | 40 worldbuilding prompts (one click turns an answer into a note) and a 5-style name generator. |
| **Search** | `Ctrl+K` / `⌘K` palette: fuzzy search, commands, and "create X as Character" in one place. |
| **Version history** | A snapshot is saved each time you start editing an article; restore any of the last 30. |
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
