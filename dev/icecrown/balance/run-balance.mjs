// Ice Crown balance runner.
// Usage (from the repo root):
//   npm i --no-save playwright && npx playwright install chromium   (first time only)
//   node dev/icecrown/balance/run-balance.mjs            -> all maps
//   node dev/icecrown/balance/run-balance.mjs 0,1 3      -> maps 0 and 1, 3 runs each
// Serves the repo on a local port, opens games/icecrown/?debug headless, and plays each map with the bot,
// with and without Crown upgrades, and with upgrades plus boss gear. Compare the output with the targets in
// dev/icecrown/DESIGN.md. heroShare = heroes' share of effective damage in the biggest non-boss wave of the last third.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const maps = (process.argv[2] || '0,1,2,3').split(',').map(Number);
const runs = Number(process.argv[3] || 2);
const BOT = fs.readFileSync(new URL('./bot.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '').trim();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const PROFILES = {
  'no upgrades': { stars: {}, ups: {}, spent: 0 },
  'some upgrades': { stars: {}, ups: { stock: 2, tools: 2, walls: 2, veterans: 2, granary: 1 }, spent: 0 },
  // all four items owned; one slot per hero, so the Tusk Charm stays in the Armory
  'upgrades + gear': { stars: {}, ups: { stock: 2, tools: 2, walls: 2, veterans: 2, granary: 1 }, spent: 0,
    gear: { owned: ['tusk', 'stone', 'scale', 'shard'], equipped: { warrior: 'stone', mage: 'shard', ranger: 'scale' } } },
};
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://localhost:${port}/games/icecrown/?debug`);
await page.waitForTimeout(1500);
await page.evaluate(() => { const t = document.querySelector('#title'); if (t) t.hidden = true; });

for (const m of maps) {
  for (const [name, prog] of Object.entries(PROFILES)) {
    const rows = [];
    for (let i = 0; i < runs; i++) {
      const r = await page.evaluate(`(${BOT})(${JSON.stringify({ map: m, prog, workers: 12, keepAt: 5 })})`);
      rows.push(`${r.won ? 'WON ' : 'LOST'} wave ${r.wave}/${r.of}  minTC ${r.minTC}%  soldiersLost ${r.lost}  heroDeaths ${r.deaths}  ${r.min}min` +
        (r.share != null ? `  heroShare ${r.share}% (w${r.shareWave})` : ''));
    }
    console.log(`\n${['Iron: Frostmere', 'Bronze: Hollow Pass', 'Silver: Whitefang', 'Gold: Ice Crown'][m] || 'map ' + m} | ${name}`);
    rows.forEach(x => console.log('  ' + x));
  }
}
console.log(errors.length ? `\nPAGE ERRORS:\n${errors.join('\n')}` : '\nNo page errors.');
await browser.close(); server.close();
