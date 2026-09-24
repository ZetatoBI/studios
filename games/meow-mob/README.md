# Meow Mob: deploy to studios.zetatobi.com

Drop this whole `meow-mob` folder into the `games/` folder of the **ZetatoBI/studios** repo:

```
studios/
  games/
    meow-mob/
      index.html
      manifest.webmanifest
      sw.js
      fonts/   (Fredoka, bundled so it works offline)
      icons/
```

Then push:

```
git add games/meow-mob
git commit -m "Add Meow Mob"
git push
```

GitHub Pages usually updates in a minute or two. The game will be at
**https://studios.zetatobi.com/games/meow-mob/**

## Installing on a phone
- **Android (Chrome):** open the link, tap the menu, then "Install app" or "Add to Home screen".
- **iPhone (Safari):** open the link, tap Share, then "Add to Home Screen".

After the first load it works offline, and progress is saved on the device.

## Shipping an update
1. Replace `index.html` with the new version.
2. In `sw.js`, bump `VERSION` (for example `meowmob-v3` to `meowmob-v4`).
3. Commit and push. Players get the new version the next time they open it online.

## Notes
- Vibration works on Android. iPhone browsers don't allow it; it will work there once wrapped with Capacitor.
- Save data lives in the browser's local storage, so it stays per device and per browser.
- No ads, no tracking, no network calls besides loading the game itself.
