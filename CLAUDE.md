# Zetato Studios: repo guide for Claude Code

This repo (ZetatoBI/studios) is the Zetato Studios site, served by GitHub Pages at https://studios.zetatobi.com.

## Structure
- `index.html` (root): the Studios hub page that lists released games.
- `games/<game>/`: one self-contained folder per game (e.g. `games/deendojo/`, `games/deadbow/`,
  `games/sailornana/`, `games/smokin-mirrors/`). A game folder usually holds `index.html` (the whole game in
  one file), a web app manifest (`manifest.webmanifest` or `manifest.json`), `sw.js` (offline service worker)
  and `icons/`.
- `games/deendojo/config.js`: live settings (stats endpoint URL, feedback email). Never overwrite or edit it
  unless explicitly asked.
- `shared/` (if present): files shared by all games, e.g. `zetato-stats.js`.
- `CNAME`: custom domain for GitHub Pages. Never edit or delete it.

## How changes arrive
- Game files are built outside this repo and delivered as finished files, with sha256 checksums.
- Copy them in exactly as given (cp). Never retype, reformat, minify or "tidy" them.
- Verify each file's sha256 before committing. If a hash differs, stop and report it.
- One branch and one pull request per update. Don't merge; the owner merges.
- Change only the files you were asked to change.

## Rules that prevent breakage
- Every game's manifest needs its own unique `"id"` inside its folder, e.g. `"/games/deendojo/app"`.
  Never use `"/"` or `"./"`: Android then treats different games as the same installed app.
- Keep each game's `start_url` and `scope` inside its own folder.
- When a game's files change, the version string on the first lines of its `sw.js` (the `CACHE` name) must
  change too, or phones keep the old cached version. Delivered files already include this.
- Don't rename saved-data keys in game code (e.g. DeenDojo uses `deenspark.v1`); renaming wipes players' progress.
- DeenDojo is deliberately unlisted: don't add it to the hub page, any game list, or a sitemap.

## Deployment
Merging to the default branch publishes automatically through GitHub Pages. The site updates within a few
minutes; the Actions tab shows the "pages build and deployment" run.

## Ice Crown (games/icecrown/)
- Read dev/icecrown/DESIGN.md before changing gameplay, balance, controls or releases.
- After any change to combat, economy, waves, heroes or units, run the balance bot
  (node dev/icecrown/balance/run-balance.mjs) and put the results in the PR, compared with the targets in DESIGN.md.
- Every release: bump VERSION in games/icecrown/sw.js and in the PWA script at the end of games/icecrown/index.html.
- Never change the manifest id or the icecrown.* storage keys without a migration.
- Before opening any PR that changes a game, load it headless and confirm there are no page errors.
