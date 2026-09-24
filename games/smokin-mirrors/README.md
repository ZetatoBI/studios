# Smokin' Mirrors — Zetato Studios

Drop-in package for `studios.zetatobi.com/games/smokin-mirrors/`.

## Deploy
Copy this whole folder into the `studios` repo at `games/smokin-mirrors/`, commit, push.
GitHub Pages serves it at `https://studios.zetatobi.com/games/smokin-mirrors/`.

## Files
| File | Purpose |
|---|---|
| `index.html` | The entire game. No build step, no dependencies. |
| `manifest.webmanifest` | Makes it installable. Portrait-locked, standalone. |
| `sw.js` | Service worker. Caches the shell so it runs offline after first load. |
| `icon-192/512.png` | Home-screen icons. |
| `icon-maskable-512.png` | Android adaptive icon (art kept inside the safe zone). |
| `apple-touch-icon.png` | iOS home screen. |
| `store-icon-1024.png` | For Play/App Store listings later. Not used by the web app. |

## Adding it to the Studios index page
Title: Smokin' Mirrors
Tagline: Bend the light. Light the ring.
Blurb: A puzzle about routing a beam through mirrors. 165 levels across five
leagues, a daily puzzle, relaxed and challenge modes. No ads, no timers unless
you want them.
Link: /games/smokin-mirrors/
Icon: games/smokin-mirrors/icon-512.png

## Updating later
Bump `CACHE` in `sw.js` (e.g. `smokin-mirrors-v2`) whenever `index.html` changes,
or returning players keep the cached old version.

## One outstanding item before native store release
Fonts load from Google Fonts. Online that is fine. For a Capacitor build, download
the Gabarito and Karla woff2 files, drop them beside `index.html`, and swap the
`<link>` for a local `@font-face` block — otherwise an offline launch silently falls
back to system fonts.
