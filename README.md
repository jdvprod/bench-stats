# Benchboard

_Formerly Bench Stats._

Volleyball stats, lineups, rotations and practice planning for coaches. Works offline, installs like an app on phones, tablets and laptops, and keeps every team's data on the device.

## What's in it

- **Track**: live stat entry by player, type-in codes for keyboards (`7k 12ace ok11`), a big-button focus mode, scoreboard with rotation, server, timeouts and subs, drag-and-drop subs, libero serving, film tags, undo, in-game coach flags, and AI timeout talking points.
- **Stats**: season, practice, match or single-set views. Includes overview KPIs, player totals, per-set and advanced stats (+/−, net points, serve efficiency, ace:error), attack by first contact (in-system, out-of-system, transition), side-out by pass grade, rotations, opponent players, an Excel export and an AI match report.
- **Court**: a tendency court that turns tapped ball locations into zone heat maps and defense, attack and serve recommendations, filterable by opponent, their jersey number, our player and rotation. It also has three saved drawing boards.
- **Formations**: drag players into serve-receive, serving and base-defense spots for all six rotations. It flags overlap (rotation) faults at the serve, shows where each player moves after the serve, and saves named sets like "5-1 three-passer".
- **Lineup**: a starting-six builder with the libero, checks that the lineup is balanced, a preview of all six rotations with season results, "on court now" or "next set" buttons, and an AI lineup suggestion.
- **Practice**: a plan builder with a timeline and drill library, a "what to work on" list built from your stats, AI plans, scrimmages with a roster split and head-to-head stats, drill tracking and history.
- **Player pages**: KPIs, trend charts, match log, goals with progress bars, an AI report card and a downloadable report for players and parents.
- **Live**: an ESPN-style gamecast with box score, momentum, leaders, team stats and play-by-play.
- **Match report**: a one-page report with set scores, score flow, leaders and box score that parents can open on any phone or print.
- **Team**: multiple teams and seasons, roster CSV import and export, (grad year and height for recruiting), opponents with scouting notes, and backup and restore (including v1 backups).

## Run it

You need Node.js 18+.

```
npm install
npm run dev      # http://localhost:5173, rebuilds on save
npm run build    # production build in dist/
npm test         # engine tests
```

## Put it online (free)

The `dist/` folder is a static website. Drag it onto **Netlify Drop** (app.netlify.com/drop) or **Cloudflare Pages**, or push it to **GitHub Pages**. Then open the link on any device and choose "Install" or "Add to Home Screen".

## AI features

In Settings, paste an Anthropic API key from console.anthropic.com. It's stored on the device only. Before selling the app, move the call in `src/ai/client.ts` behind a small server function so customers don't need their own key.

## Code map

```
src/sports/volleyball/   rules engine (event log → score, rotations, stats), metrics, flags, tendencies
src/data/                data model, IndexedDB storage, store, sample data, backup
src/features/<page>/     one folder per screen
src/ui/                  shared components: cards, charts, court, AI card, drag and drop
src/ai/                  Claude client and prompts
```

Every match is an append-only event log, so stats can be recomputed with new metrics at any time and logs from several devices merge cleanly. That makes accounts and cloud sync (planned with Supabase) and other sports (add `src/sports/<sport>/`) straightforward to add.

## Roadmap

1. Accounts and cloud sync so assistants can track on several devices and parents can follow a public live link.
2. A server AI proxy, then paid plans.
3. Rankings and recruiting profiles.
4. Video clips and AI video analysis.
