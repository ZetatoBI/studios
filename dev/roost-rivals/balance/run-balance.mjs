// Roost Rivals balance bot. Plays rival-vs-rival matches headless with the game's own core and reports:
// skill ladder, bird-vs-bird win rates (1v1 and four-way), match length, seat fairness, personalities.
// Usage (from the repo root):   node dev/roost-rivals/balance/run-balance.mjs [matchesPerPair=200]
// The core is read straight out of games/roost-rivals/index.html, so this always tests what players get.
// Targets are in dev/roost-rivals/DESIGN.md. No browser needed; takes a few minutes at 200.
import fs from 'node:fs'; import path from 'node:path';
function loadCore() {
  const p = process.env.RR_HTML || path.join(process.cwd(), 'games/roost-rivals/index.html'), html = fs.readFileSync(p, 'utf8');
  const m = html.match(/<script>\s*(\/\* ===== ROOST RIVALS CORE[\s\S]*?)<\/script>/); if (!m) throw new Error('core block not found in ' + p);
  const mod = { exports: {} }; new Function('module', m[1])(mod); return mod.exports;
}
const RR = loadCore(), N = +(process.argv[2] || 200), CAP = (RR.NIGHTFALL + 5) * RR.TICK_HZ;
function play(players, seed, mods) { const S = RR.newMatch(players, { seed, mods }); while (!S.over && S.tick < CAP) { RR.step(S); S.events.length = 0; } return S; }
const pers = Object.keys(RR.PERS), birds = RR.BIRD_IDS;
const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1).padStart(5) + '%';

console.log(`Roost Rivals balance report (core v${RR.CORE_VERSION}, ${N} matches per pairing)\n`);
console.log('== 1. Skill ladder (1v1, same bird, same personality): stronger rival win rate. Target: rises at every step ==');
for (const [hi, lo] of [[0.3, 0.1], [0.5, 0.3], [0.7, 0.5], [0.9, 0.7], [1, 0.9], [1, 0.5], [0.9, 0.3]]) {
  let w = 0; for (let i = 0; i < N; i++) { const pr = pers[i % pers.length], flip = i % 2, b = birds[(i >> 1) % birds.length];
    const S = play([{ bird: b, ai: { skill: flip ? lo : hi, pers: pr } }, { bird: b, ai: { skill: flip ? hi : lo, pers: pr } }], 1000 + i); if (S.over.winner === (flip ? 1 : 0)) w++; }
  console.log(`  skill ${hi} vs ${lo}: ${pct(w, N)}`);
}

console.log('\n== 2. Bird vs bird (1v1, skill 0.7 both, all personalities). Target: every bird 45-55% overall ==');
const tot = {}, cnt = {}; birds.forEach(b => { tot[b] = 0; cnt[b] = 0; });
const len = []; let night = 0, games = 0;
for (let a = 0; a < birds.length; a++) for (let b = a + 1; b < birds.length; b++) {
  let wa = 0; for (let i = 0; i < N; i++) { const flip = i % 2, pr = pers[i % pers.length], pr2 = pers[(i >> 1) % pers.length];
    const A = { bird: birds[a], ai: { skill: 0.7, pers: pr } }, B = { bird: birds[b], ai: { skill: 0.7, pers: pr2 } };
    const S = play(flip ? [B, A] : [A, B], 5000 + i + a * 977 + b * 131); if (S.over.winner === (flip ? 1 : 0)) wa++;
    len.push(S.over.t); if (S.over.reason === 'nightfall') night++; games++; }
  tot[birds[a]] += wa; cnt[birds[a]] += N; tot[birds[b]] += N - wa; cnt[birds[b]] += N;
  console.log(`  ${birds[a].padEnd(8)} vs ${birds[b].padEnd(8)}: ${pct(wa, N)}`);
}
console.log('  overall:'); birds.forEach(b => console.log(`    ${b.padEnd(8)} ${pct(tot[b], cnt[b])}`));
len.sort((x, y) => x - y);
console.log(`  match length: median ${len[len.length >> 1].toFixed(0)}s, p10 ${len[Math.floor(len.length * .1)].toFixed(0)}s, p90 ${len[Math.floor(len.length * .9)].toFixed(0)}s; ended at nightfall: ${pct(night, games)}`);

console.log('\n== 3. Four-way free-for-all (skill 0.45 and 0.8, random birds and personalities). Target: every bird 21-29% (fair share 25%) ==');
{ const w = {}, c = {}; birds.forEach(b => { w[b] = 0; c[b] = 0; }); const R = RR.rng(42); let nf = 0; const L = [], calls = {}; birds.forEach(b => calls[b] = 0);
  for (let i = 0; i < N * 10; i++) { const P = [0, 1, 2, 3].map(() => ({ bird: birds[Math.floor(R() * birds.length)], ai: { skill: i % 2 ? 0.8 : 0.45, pers: pers[Math.floor(R() * pers.length)] } }));
    const S = play(P, 90000 + i); P.forEach((p, k) => { c[p.bird]++; if (S.over.winner === k) w[p.bird]++; calls[p.bird] += S.players[k].stats.calls; }); if (S.over.reason === 'nightfall') nf++; L.push(S.over.t); }
  birds.forEach(b => console.log(`    ${b.padEnd(8)} ${pct(w[b], c[b])}   calls used per match: ${(calls[b] / c[b]).toFixed(1)}`)); L.sort((x, y) => x - y);
  console.log(`  match length: median ${L[L.length >> 1].toFixed(0)}s; ended at nightfall: ${pct(nf, N * 10)}`);
  const sw = [0, 0, 0, 0]; for (let i = 0; i < N * 4; i++) { const S = play([0, 1, 2, 3].map(() => ({ bird: 'pigeon', ai: { skill: 0.7, pers: 'opportunist' } })), 70000 + i); sw[S.over.winner]++; }
  console.log('  seat fairness (same bird, win share by start corner; fair share 25%): ' + sw.map(v => pct(v, N * 4)).join(' ')); }

console.log('\n== 4. Personalities (1v1, pigeon, skill 0.7): overall win rate (rivals are meant to differ; none should be hopeless) ==');
{ const w = {}, c = {}; pers.forEach(p => { w[p] = 0; c[p] = 0; });
  for (let a = 0; a < pers.length; a++) for (let b = a + 1; b < pers.length; b++) for (let i = 0; i < N / 2; i++) { const flip = i % 2;
    const A = { bird: 'pigeon', ai: { skill: 0.7, pers: pers[a] } }, B = { bird: 'pigeon', ai: { skill: 0.7, pers: pers[b] } };
    const S = play(flip ? [B, A] : [A, B], 30000 + i + a * 53 + b * 7); const aw = S.over.winner === (flip ? 1 : 0); w[pers[a]] += aw ? 1 : 0; w[pers[b]] += aw ? 0 : 1; c[pers[a]]++; c[pers[b]]++; }
  pers.forEach(p => console.log(`    ${p.padEnd(12)} ${pct(w[p], c[p])}`)); }
