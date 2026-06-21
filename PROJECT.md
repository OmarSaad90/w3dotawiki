# W3Dota Allstars — Community Wiki Project Context

## What This Is
A single-page HTML wiki for **W3Dota Allstars (DotA 1) version 6.89**, featuring all 112 heroes with abilities, stats, patch notes, item builds, skill orders, and community guides.

**Live URL:** https://w3dotawiki.vercel.app  
*(Vercel project renamed from `dotawiki` → `w3dotawiki` on Apr 16 2026)*

---

## File Structure

```
wiki/
├── index.html               # The entire app — CSS + HTML shell + all JS/data (inline)
├── admin.html               # Admin panel — authenticated editor for skill builds + spell values
├── items_data.js            # HERO_ITEMS object: top community items per hero
├── skill_builds.js          # SKILL_BUILDS object: 18-level skill order per hero (all 112)
├── matchups.js              # HERO_MATCHUPS object: countered_by/counters/good_with (all 112)
├── hero_stats.js            # HERO_STATS object: base stats scraped from iccup (all 112)
├── spell_overrides.json     # Spell stat + description overrides written by admin panel
├── vercel.json              # Vercel rewrites (/admin → /admin.html) + security headers
├── scrape_hero_stats.py     # Script that generated hero_stats.js — re-run to refresh data
├── SpellIcons/              # Local .jpg spell icon files (BTN*.jpg, WC3-style icons)
│   ├── spellsfix/           # PNG overrides for abilities with bad/missing BTN icons
│   └── portraits/           # Custom hero portrait overrides (e.g. witch_doctor.png)
├── dota2_fallback_icons.txt # Running list of abilities still using D2 fallback (79 as of Apr 17)
├── spells.txt               # User-collected WoW Classic icon URLs mapped to abilities
└── PROJECT.md               # This file

api/                         # Vercel serverless functions (ESM, not exposed as routes if _ prefixed)
├── _auth.js                 # Shared: makeToken(), validateSession(), safeEq(), setCookie/clearCookie
├── login.js                 # POST — rate-limited login, returns signed session cookie
├── check-auth.js            # GET — validates session cookie → 200 or 401
├── logout.js                # POST — clears session cookie
├── save.js                  # POST — write skill build changes to skill_builds.js on GitHub
├── save-spell.js            # POST — write spell stat/desc overrides to spell_overrides.json on GitHub
└── save-matchup.js          # POST — write matchup changes to matchups.js on GitHub
```

---

## Current Features

1. **Hero grid** — responsive, auto-fill columns, min 380px wide; sorted A→Z
2. **Search** — filters by hero name, title, description, ability names/desc, patch notes; typing while on Guides page auto-switches back to hero grid. Normalized matching: strips spaces and dashes so `pitlord` matches "Pit Lord", `antimage` matches "Anti-Mage" etc.
3. **Attribute filter buttons** — All / STR / AGI / INT (each has a passive color tint: red/green/blue)
4. **Role filter dropdown** — filters by Carry, Support, Ganker, Initiator, Nuker, Disabler, Escape, Semi-Carry. Button is purple-tinted. Data lives in `HERO_ROLES` object in index.html (all 112 heroes assigned).
5. **Hero cards** with:
   - Portrait image (iccup.com CDN via SLUGS map) with attr-colored frame glow
   - Attribute + faction badges
   - **Role pills** under hero subtitle — color-coded (gold=Carry, blue=Support, red=Ganker, green=Initiator, purple=Nuker, gray=Disabler, teal=Escape, orange=Semi-Carry)
   - Hero description
   - **Base Stats section** — sits between description and abilities (see Base Stats section below)
   - 4 abilities with icon, name, description, stat pills (color-coded by type)
   - **Aghanim's Scepter upgrade** — shown inline on the relevant ability with purple badge + icon. Data in `AGHANIM_UPGRADES` object in index.html (~94 heroes covered; missing: Dragon Knight, Lycan, Io, Terrorblade, Death Prophet, Slardar, Pit Lord, Drow Ranger)
   - **Suggested Skill Order** strip (levels 1–18, scrollable, gold scrollbar)
   - Top community items section (from `items_data.js`)
   - **Difficulty badge** — Easy (green) / Medium (gold) / Hard (red) in the top-right badge area alongside STR/Sentinel. Data in `HERO_DIFFICULTY` object in index.html (all 112 heroes)
   - **Matchups section** — always-visible inline rows: Countered By (red), Good Against (green), Good With (blue). 3 heroes per row with mini portraits. Data in `matchups.js` (`HERO_MATCHUPS` object, all 112 heroes)
   - 6.89 patch changes — **collapsed by default** (📜 ▼/▲ toggle), sits below matchups
6. **Spell icons** — four-tier fallback (see Icon System section below)
7. **Community Guides page** — dedicated view with 8 player-written guides
8. **`/` keyboard shortcut** — press `/` anywhere on the page to focus the search box instantly
9. **URL deep-link support** — `?q=hero-name` query parameter auto-fills search on load (e.g. `?q=anti-mage`). Intended for the main W3Dota site to link directly to individual hero wiki pages.

---

## Base Stats Section (added Jun 17 2026)

Each hero card shows a **◈ Base Stats** section between the description and abilities, sourced from `hero_stats.js`.

**Attribute row** — STR / AGI / INT, each showing `base +gain/lvl`, color-coded red/green/blue.

**Combat stats row** — plain text labels, all 112 heroes:

| Label | Meaning |
|-------|---------|
| DMG | Base damage range (e.g. 52-58) |
| Armor | Base armor |
| Range | Attack range (melee ~128, ranged varies) |
| MS | Movespeed |
| BAT | Base Attack Time — lower = faster (tooltip explains this) |
| HP | Base health, with `+X/lvl` |
| Mana | Base mana, with `+X/lvl` |

**Data source:** `hero_stats.js` — `HERO_STATS` object keyed by wiki hero name.

**Scraper:** `scrape_hero_stats.py` fetches `https://iccup.com/en/heroes/<slug>` for each hero, parses the Advanced Statistics section, and writes `hero_stats.js`. Run with `python scrape_hero_stats.py` from the wiki folder.

**iccup URL slugs:** many heroes have different names on iccup (DotA1 names). The full override map is in `URL_OVERRIDES` inside `scrape_hero_stats.py`. Key examples:
- Kunkka → Admiral, Sven → Rogue Knight, Tiny → Stone Giant, Io → Guardian Wisp
- Lycan → Lycanthrope, Brewmaster → Pandaren Brewmaster, Huskar → Sacred Warrior
- Timbersaw → Goblin Shredder, Tusk → Ymir, Abaddon → Lord of Avernus
- Slardar → Slithereen Guard, Magnus → Magnataur
- Mirana → Priestess Of The Moon, Riki → Stealth Assasin (iccup typo), Luna → Moon Rider
- Clinkz → Bone Fletcher, Viper → Netherdrake, Weaver → Nerubian Weaver
- Slark → Murloc Nightcrawler, Ursa → Ursa Warrior, Terrorblade → Soul Keeper
- Medusa → Gorgon, Meepo → Geomancer, Sniper → Dwarven Sniper
- Nyx Assassin → Nerubian Assassin, Razor → Lighting Revenant (iccup typo)
- Lina → Slayer, Lion → Demon Witch, Zeus → Lord of Olympia, Pugna → Oblivion
- Dazzle → Shadow Priest, Bane → Bane Elemental
- Jakiro → Twin Head Dragon, Rubick → Grand Magus, Visage → Necro\`lic
- Puck → Faerie Dragon, Leshrac → Tormented Soul, Nature's Prophet → Prophet
- Techies → Goblin Techies, Chen → Holy Knight, Windranger → Windrunner
- Doom → Doom Bringer, Clockwerk → Clockwerk Goblin

---

## Spell Icon System

`getSpellIcon(heroName, spellName)` checks in this priority order:

| Priority | Map | Source | Format |
|----------|-----|--------|--------|
| 1 | `SPELL_ICONS` | Local GitHub SpellIcons repo (WC3 BTN files + PNG overrides) | `.jpg` auto-appended unless value contains `.` (PNG support) |
| 2 | `WOW_ICONS` | WoW Classic CDN (wow.zamimg.com) — authentic DotA1-era | `${WOW_BASE}{name}.jpg` |
| 3 | `DOTA2_ICONS` | DotA2 CDN explicit overrides (renamed abilities) | `${DOTA2_BASE}{name}.png` |
| 4 | auto-fallback | DotA2 CDN auto-generated from HERO_KEYS + spell name | `${DOTA2_BASE}{hero}_{spell}.png` |

**PNG support:** `getSpellIcon()` checks `btn.includes('.')` — if the stored value contains a dot (e.g. `"spellsfix/burrowstrike.png"`), it serves the path as-is; otherwise appends `.jpg`. Fully backward-compatible with all existing BTN entries.

**spellsfix/ subfolder:** PNG icon overrides live in `SpellIcons/spellsfix/` in the GitHub repo and are referenced in `SPELL_ICONS` as `"spellsfix/filename.png"`. Workflow: drop PNGs in wiki root → `cp` to `SpellIcons/spellsfix/` → `git push` → delete from wiki root.

**CDN constants in index.html:**
- `ICON_BASE` = `https://raw.githubusercontent.com/OmarSaad90/SpellIcons/main/`
- `WOW_BASE` = `https://wow.zamimg.com/images/wow/icons/large/`
- `DOTA2_BASE` = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/`

**Current coverage (as of Apr 17 2026):**
- All abilities covered by local BTN icons (SPELL_ICONS) — sprint complete
- ~53 abilities covered by WoW Classic icons (WOW_ICONS)
- ~14 abilities covered by DotA2 explicit overrides (DOTA2_ICONS)
- **1 pending icon:** Faceless Void `Backtrack` (BTNBacktrack — needs screenshot crop from W slot)
- **0 abilities on D2 auto-fallback** — sprint complete, see `dota2_fallback_icons.txt`

**WoW Classic icon browser:** https://classic.wowhead.com/icons  
**Icon name format:** dashes in WoWHead URL → underscores in zamimg CDN (e.g. `spell-frost-glacier` → `spell_frost_glacier`)

### Screenshot Method — CALIBRATED (Apr 16 2026)

User pastes a DotA 1 screenshot (1920x1080) as `image.png` in the wiki folder.
Hero must have all abilities leveled so icons are visible in the WC3 command card.

**Exact crop coordinates (calibrated, do not re-derive):**

| Slot | x1 | y1 | x2 | y2 |
|------|----|----|----|----|
| Q (col 1) | 1350 | 996 | 1430 | 1068 |
| W (col 2) | 1431 | 996 | 1513 | 1068 |
| E (col 3) | 1514 | 996 | 1590 | 1068 |
| R (col 4) | 1597 | 996 | 1662 | 1068 |

These are the 4 ability slots in **row 3** of the WC3 command card (bottom-right HUD).
Row 1 = Move/Stop/Hold/Attack, Row 2 = Patrol + consumables, Row 3 = hero abilities.

**Python snippet (PIL, already installed):**
```python
from PIL import Image
img = Image.open('C:/Users/Omar/Downloads/wiki/image.png')
icons = [
    ('BTNAbilityName1', 1350, 996, 1430, 1068),
    ('BTNAbilityName2', 1431, 996, 1513, 1068),
    ('BTNAbilityName3', 1514, 996, 1590, 1068),
    ('BTNAbilityName4', 1597, 996, 1662, 1068),
]
for name, x1, y1, x2, y2 in icons:
    img.crop((x1, y1, x2, y2)).resize((64, 64), Image.LANCZOS).save(f'SpellIcons/{name}.jpg', quality=92)
```

**After saving icons:**
1. Add entries to `SPELL_ICONS` in `index.html` (use ability name exactly as in hero data)
2. User pushes new `.jpg` files to `OmarSaad90/SpellIcons` GitHub repo
3. Icons go live on `https://raw.githubusercontent.com/OmarSaad90/SpellIcons/main/`

---

## Community Guides

Accessed via the **✎ Guides** filter button. Replaces the hero grid with a 2-column card layout.

| Hero | Guide Title | Author |
|------|-------------|--------|
| Lifestealer (N'aix) | N'aix — Carry Guide | HellHound |
| — (general) | Short Guide on Warding | Fieryfox |
| Lina | Lina — Skill & Item Build Guide | Kdbebrks (Frostless) |
| Kunkka | Captain Kunkka — Core Foundation Guide | CDR |
| Meepo | How to Play Meepo — Beginner's Guide | Shadow(x) |
| Io (Guardian Wisp) | Guardian Wisp — Complete Support Guide | in_kam |
| — (general) | Rune Priority — A Team Resource Guide | Lorry |
| — (general) | Climbing from T1 to T2 — General Tips | Pavement |

**Guide card features:**
- Hero portrait (via `getPortrait()`), custom `icon` field for non-hero guides (falls back to Observer Ward icon)
- Author badge colored by attribute (STR/AGI/INT/gold)
- Guides with >2 sections start collapsed (180px) with a fade gradient + ▼ Expand button
- Expand state tracked per-card in `guideExpanded{}` object, no full re-render on toggle
- Guide data is the `GUIDES` array in index.html — add new entries there

---

## Hero Roster Summary

- **Total:** 112 heroes — all have skill builds in `skill_builds.js`
- **Factions:** Sentinel + Scourge
- **Attributes:** STR, AGI, INT
- Heroes use **DotA 1 names** (e.g. "Tauren Chieftain" not "Elder Titan", "Obsidian Destroyer" not "Outworld Devourer", "Skeleton King" not "Wraith King")

---

## Skill Build Order

All 112 heroes covered. 100 scraped from DotaFire, 12 written manually:
> Centaur Warrunner, Io, Storm Spirit, Shadow Demon, Queen of Pain, Razor, Techies, Enchantress, Chen, Slardar, Pit Lord, Legion Commander

Stored in `skill_builds.js` — two supported formats (backward-compatible):

```js
const SKILL_BUILDS = {
  // Single build — flat array (original format)
  "Hero Name": [0, 1, 0, 2, 0, 3, ...],  // 18 entries: 0=Q, 1=W, 2=E, 3=R, -1=stats

  // Multiple named builds — array of objects
  "Hero Name": [
    { label: "Carry", build: [0, 0, 1, 0, 1, 3, ...] },
    { label: "Support", build: [1, 0, 1, 0, 2, 3, ...] },
  ],
}
```

Detection: `renderHero()` checks `Array.isArray(build[0])` — if the first element is an object (has `.label`), it renders a tab strip to switch between named builds. Otherwise renders the flat array directly. Tabs are styled gold; active tab is highlighted.

Rendered as a scrollable icon strip labelled **"Suggested Skill Order"** on each hero card. Ultimates get a gold border glow. The horizontal scrollbar is styled gold to match the page theme.

---

## UI Enhancement Layer

A clearly-labelled CSS block in index.html (search for `UI ENHANCEMENT LAYER`). Delete the entire block between the two `═══` comment lines to fully revert all visual enhancements.

Enhancements included:
- **WC3 stone tile background** — 80px major tile grid with warm amber grout lines + 20px subdivision lines
- **WC3 page frame** — fixed gold border hugging viewport edges with L-shaped corner brackets (`#wc3-frame`)
- **Floating dust particles** — 45 tiny gold specks drifting upward via canvas RAF loop (`#dust-canvas`)
- Atmospheric gold aura at the top of the background
- Header title slow gold shimmer animation
- Search input gold glow on focus
- Filter button lift on hover
- Card entrance fade+slide animation on render
- Hero name warms to cream on card hover
- Ability icon brightens with gold drop-shadow on hover
- Stat pills color-coded: DMG=red, CD=blue, Mana=purple, Dur=gold, Range=green
- Item icons scale-pop on hover
- Skill order cells lift + gold border on hover
- Custom gold gradient scrollbar (page + skill order strip)
- Hero portrait attr-colored frame glow (STR=red, AGI=green, INT=blue)
- Section label ornamental divider lines (──── either side of label text)

---

## index.html Structure (approximate)

| Section | What it is |
|---------|------------|
| CSS | Dark theme, color vars, card/guide/skill-order/base-stats styles, UI enhancement layer |
| HTML shell | Header (`⚔ W3Dota Allstars Hero Wiki`), search, filter buttons, stats bar, grid, guides-view |
| JS: constants | CDN base URLs, `SLUGS` map (hero name → iccup portrait filename) |
| JS: icon maps | `SPELL_ICONS`, `WOW_ICONS`, `DOTA2_ICONS`, `HERO_KEYS` |
| JS: helpers | `getPortrait()`, `getSpellIcon()`, `pill()` |
| JS: role data | `HERO_ROLES` — 112-hero role assignments (Carry/Support/Ganker/Initiator/Nuker/Disabler/Escape/Semi-Carry) |
| JS: difficulty data | `HERO_DIFFICULTY` — Easy/Medium/Hard per hero, all 112, inline in index.html |
| JS: aghanim data | `AGHANIM_UPGRADES` — per-hero scepter upgrade (ability name + desc), ~94 heroes |
| JS: hero data | `const heroes = [...]` — full 112-hero array inline |
| JS: guide data | `const GUIDES = [...]` — 8 community guides inline |
| JS: Invoker modal | `INVOKE_SPELLS` array (10 invoked spells with orb combos, icons, descriptions); `openInvokeModal()` / `closeInvokeModal()`; "View All Spells" button injected on Invoker's card |
| JS: matchup data | `HERO_MATCHUPS` — per-hero countered_by/counters/good_with (3 each), all 112 heroes, lives in `matchups.js` |
| JS: base stats data | `HERO_STATS` — base STR/AGI/INT + combat stats per hero, all 112, lives in `hero_stats.js` |
| JS: rendering | `renderAbility()`, `renderHero()`, `renderGuides()`, `toggleGuide()`, `togglePatch()` |
| JS: control | `initGrid()` (pre-renders all 112 cards once on load, stamps `data-attr/faction/roles/search`), `render()` (show/hide only — no innerHTML rebuild), `setFilter()`, `setRole()`, `toggleRoleDropdown()`, `setGuides()`, debounced search listener (120ms), `/` key shortcut, URL `?q=` param handler |
| HTML | `<div id="no-results">` hidden div shown when filter+search yields 0 heroes |

---

## Accessibility (Jun 17 2026 pass)

- `<main>` landmark wraps the stats bar, hero grid, and guides view
- Search input has `aria-label`; `.sr-only` utility class in CSS for visually-hidden labels
- All filter buttons have `aria-pressed="true/false"` updated on every state change
- Role dropdown: trigger has `aria-haspopup="menu"` + `aria-expanded`, menu has `role="menu"`, items are `<button role="menuitem">` (converted from `<div>`)
- Patch-changes toggle converted from `<div>` to `<button>` with `aria-expanded`
- Decorative elements marked `aria-hidden="true"`: `#wc3-frame`, `#dust-canvas`, fallback emoji icons, `◈` and `⚡` section label chars
- Hero portrait `<img>` has explicit `width="72" height="62"` to prevent layout shift
- `prefers-reduced-motion` media query disables all animations and transitions

---

## Notable Ability Corrections

| Hero | Spell | Change |
|------|-------|--------|
| Troll Warlord | 3rd ability | "Whirling Axes (Melee)" → **Fervor** (passive attack speed stacker) |
| Anti-Mage | 3rd ability | "Counterspell" → **Spell Shield** |
| Chen | 2nd ability | Was "Divine Favor" (doesn't exist) → **Test of Faith** |
| Chen | 3rd ability | **Holy Persuasion** (moved from 2nd slot) |
| Invoker | All abilities | Reworked from combined-orb representation to 4 clean abilities: **Quas / Wex / Exort / Invoke** (ultimate). Stats per-instance. Invoke opens the invoked spells modal. |
| Sand King | Burrowstrike icon | Changed from `spellsfix/burrowstrike.png` → `BTNEarthSpike` (same visual, already in SpellIcons root) |
| Abaddon | Curse of Avernus | Wrong description replaced. Correct: passive — attacks freeze the target, slow MS 5/10/15/20%, grant Abaddon +15% MS, and grant allies attacking the frozen target +10/20/30/40% attack speed. Stats: `MS Slow`, `Atk Speed`, `Abaddon MS`. |

**Hero name corrections (applied across all files):**
- "Underlord" → **Pit Lord** (`index.html`, `hero_stats.js`, `skill_builds.js`, `matchups.js`, `items_data.js`, `scrape_hero_stats.py`)
- "Necrophos" → **Necrolyte** (same files)

---

## Performance (Search & Filter)

`initGrid()` pre-renders all 112 hero cards as HTML strings once on load and stamps four `data-*` attributes on each card element: `data-attr`, `data-faction`, `data-roles`, `data-search`. `render()` then only toggles `card.style.display` — no innerHTML is rebuilt on filter/search changes.

Search input is debounced at 120ms. Filter buttons call `render()` directly (no debounce needed).

Normalized search: both the query and the stored `data-search` value have spaces and dashes stripped before the secondary `includes()` check, so `pitlord` matches "Pit Lord" and `antimage` matches "Anti-Mage".

---

## Key Technical Notes

- No build system, no framework — plain HTML/CSS/JS
- All hero + guide data is inline in index.html
- Load order matters: `items_data.js`, `skill_builds.js`, `matchups.js`, and `hero_stats.js` must be `<script src>` loaded before the inline script
- Icon paths: local SpellIcons served from `https://raw.githubusercontent.com/OmarSaad90/SpellIcons/main/`
- Portrait images: `https://iccup.com/upload/images/heroes/` — `.png` for most, `.jpg` for 3 exceptions (Alchemist, Skeleton King, Enchantress)
- DotA2 ability icons: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/`
- Observer Ward icon (warding guide): `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/ward_observer.png`

---

## Deployment

- Platform: Vercel
- Project: `w3dotawiki`
- Live: https://w3dotawiki.vercel.app
- Deploy command: `vercel --prod` from the wiki directory

---

## Admin Panel (`/admin`)

**URL:** `/admin` (rewritten to `admin.html` via `vercel.json`)  
**Auth:** HMAC-SHA256 signed session cookie. Cookie is `HttpOnly; Secure; SameSite=Strict; Max-Age=43200` (12 hours). Password checked via constant-time comparison in `api/_auth.js`.

### Auth Flow

1. `check-auth.js` (GET) — called on load; returns 200 if cookie valid, 401 otherwise
2. If 401 → show login form; if 200 → `enterApp()`
3. `login.js` (POST) — rate-limited (5 attempts / 15 min per IP); on success returns signed cookie via `Set-Cookie`
4. `logout.js` (POST) — clears cookie, resets UI to login form via `backToMain()`

### UI Layout

```
[ ← Back ]  [ 🔓 Logout ]

[ Hero picker portrait + label "— select a hero —" ]
[ 112-hero scrollable grid ]

[ Hero banner (portrait + name) ]          ← shows after selection
[ ⚔ Skill Order         Open ▾ ]          ← collapsible card
[ ✨ Spell Values         Open ▾ ]          ← collapsible card
[ ⚔ Matchups            Open ▾ ]          ← collapsible card
```

**Back button** — deselects the hero and resets all state without navigating away. Implemented as `backToMain()` which clears `selectedHero`, resets ability state vars, closes any open matchup picker, hides `sections-container` and `hero-banner`.

**Collapsible sections** — toggled by `toggleSection(which)`. CSS: `.collapsible-section.is-open .collapsible-body { display: block }`. Header shows "Open ▾" / "Collapse ▴".

### Skill Order Editor

Inside the **⚔ Skill Order** collapsible:
- Shows current 18-slot skill build loaded from `skill_builds.js` (served as a static file)
- 18 clickable/draggable slots — each cycles through Q/W/E/R/-1(Stats)
- Ability icons use `getSpellIconAdmin()` (same priority as index.html: DotA1 BTN → WoW → DotA2)
- Diff summary shows changed slots before saving
- Save POSTs to `/api/save` → writes `skill_builds.js` to GitHub → triggers Vercel deploy hook

### Spell Values Editor

Inside the **✦ Spell Values** collapsible. Loads asynchronously when section is opened:

1. `loadAbilityStatData(heroName)` — fetches `index.html` source once (cached in `indexSource`), regex-parses the hero's abilities block to extract ability names, descriptions, and `pill(...)` stat calls
2. `loadSpellOverrides()` — fetches `spell_overrides.json` once at `enterApp()`, cached in `spellOverridesData`
3. `renderSpellEditor()` — builds one card per ability showing:
   - Ability icon + name
   - Description textarea (pre-filled with current or overridden desc)
   - Stat rows: each `pill(type, label, value)` becomes a labelled input pre-filled with current value
4. Changes tracked in `spellEditValues` / `spellEditDesc` vs `spellCurrentValues` / `spellCurrentDesc`
5. **Diff summary** shown before save: stat changes as `Label: old → new`, desc truncated to 50 chars
6. Save POSTs to `/api/save-spell` → writes `spell_overrides.json` to GitHub → triggers deploy hook
7. After successful save, `spellCurrentValues` / `spellCurrentDesc` updated locally (no re-fetch needed)

### Matchup Editor

Inside the **⚔ Matchups** collapsible. Loaded at hero select time from `HERO_MATCHUPS_DATA` (parsed from `matchups.js` fetched once at `enterApp()`):

- Displays 3 categories in rows: **Countered By** (red), **Good Against** (green), **Good With** (blue)
- Each hero shown as a 60×52px portrait tile with name label underneath
- Hover a tile → overlay shows ✎ Replace and ✕ Remove buttons
- `+` button at the end of each row opens the hero picker modal
- **Hero picker modal** — fixed overlay with search-as-you-type + portrait list (same 112-hero pool as the main picker); click a hero to insert/replace
- Changed slots get a gold outline highlight (`is-changed` class)
- Diff summary at the bottom lists all pending changes (added / removed / replaced per category)
- Save POSTs to `/api/save-matchup` → writes `matchups.js` to GitHub → triggers deploy hook
- After save, `originalMatchup` and `HERO_MATCHUPS_DATA` updated locally; highlights clear

**State vars:** `HERO_MATCHUPS_DATA` (full parsed file), `originalMatchup` / `editMatchup` (per-hero copies), `matchupPickerCategory` / `matchupPickerSlotIdx` (picker context).

### Icon Resolution in Admin Panel

`getSpellIconAdmin()` uses the same four-tier lookup as `index.html`:
- Full `SPELL_ICONS` map is copied into `admin.html`
- Priority: `SPELL_ICONS` (DotA1 BTN) → `WOW_ICONS` → `DOTA2_ICONS` explicit → DotA2 auto-fallback

---

## Spell Override System

### File: `spell_overrides.json`

Written by the admin panel, read at runtime by `index.html`. Structure:

```json
{
  "HeroName": {
    "AbilityName": {
      "StatLabel": "new value",
      "desc": "override description text"
    }
  }
}
```

- Stat keys match the label strings exactly as written in `pill("type","Label","value")` calls in `index.html`
- `desc` is a special key — not a stat, treated separately in both apply logic and validation
- Empty-string stat values are deleted (used to "clear" an override back to source data)
- Empty ability objects and empty hero objects are pruned automatically by `applyChanges()`
- File starts as `{}` and grows as overrides are added

### How `index.html` Applies Overrides

```js
let SPELL_OVERRIDES = {};
fetch('/spell_overrides.json?t='+Date.now())
  .then(r => r.json())
  .then(o => { SPELL_OVERRIDES = o; initGrid(); render(); })
  .catch(() => {});
initGrid(); // also runs immediately so page works if fetch is slow
```

`renderAbility()` checks `SPELL_OVERRIDES[heroName][ability.name]` and:
1. Replaces `ability.desc` with `ovr.desc` if present
2. For each stat pill HTML string, regex-replaces `<b>Label</b> value` with the override value

### API: `save-spell.js`

- **Method:** POST  
- **Auth:** session cookie validated via `validateSession()`  
- **Body:** `{ heroName, changes: [{ abilityName, stats: { Label: value }, desc?: string }] }`
- **Validation:**
  - `heroName`: `HERO_RE = /^[A-Za-z0-9 '\-\.]+$/`, length 2–60
  - `abilityName`: `ABILITY_RE = /^[A-Za-z0-9 '\-\.\(\)!]+$/`, length 1–60
  - stat labels/values: `SAFE_RE = /^[^<>"\\]{1,100}$/`
  - desc: `DESC_RE = /^[^<>"\\]{1,600}$/` — max 600 chars, no `<`, `>`, `"`, or `\`
- **Conflict handling:** 409 → re-fetch latest SHA + retry once (same pattern as `save.js`)
- **On success:** triggers `VERCEL_DEPLOY_HOOK`

---

## Portrait Overrides

`PORTRAIT_OVERRIDES` object in `index.html` (and mirrored in `admin.html`) maps hero names to custom portrait paths. Used when iccup CDN portrait is wrong or missing.

```js
const PORTRAIT_OVERRIDES = {
  "Hero Name": "https://path/to/custom/portrait.png",
  ...
};
```

`getPortrait(heroName)` checks `PORTRAIT_OVERRIDES[heroName]` first; falls back to iccup CDN via `SLUGS` map.

Custom portrait files live in `SpellIcons/portraits/` in the `OmarSaad90/SpellIcons` GitHub repo and are served from `https://raw.githubusercontent.com/OmarSaad90/SpellIcons/main/portraits/`.

---

## Security

### Authentication (`api/_auth.js`)

- Session cookie: `session=<timestamp>.<hmac>` — HMAC-SHA256 signed with `SESSION_SECRET` env var
- `makeToken()` signs `timestamp` string; `validateSession()` re-computes HMAC and compares with `safeEq()` (constant-time, prevents timing attacks)
- Cookie flags: `HttpOnly; Secure; SameSite=Strict; Max-Age=43200`
- Sessions expire after 12 hours (validated by timestamp check in `validateSession()`)

### Rate Limiting (`api/login.js`)

- In-memory map: `{ ip → { count, resetAt } }` — 5 attempts per 15-minute window
- `429` returned with `Retry-After` header when limit exceeded
- IP extracted from `x-forwarded-for` header (Vercel always sets this)

### CORS

All write APIs (`save.js`, `save-spell.js`) set:
```
Access-Control-Allow-Origin: https://w3dotawiki.vercel.app
Vary: Origin
Access-Control-Allow-Methods: POST, OPTIONS
```
Origin checked against the hardcoded `ORIGIN` constant — mismatched origins receive no CORS headers and the preflight is rejected.

### HTTP Security Headers (`vercel.json`)

Applied to all routes:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Admin and API routes additionally get:
```
Cache-Control: no-store
```

### Input Validation

All user-supplied data validated server-side with strict regex before writing to GitHub:
- Hero/ability names: alphanumeric + limited punctuation only
- Stat labels/values: no `<>"\\`, max 100 chars
- Descriptions: no `<>"\\`, max 600 chars
- Skill build arrays: validated for length (18 slots) and value range (0–3 and -1)
