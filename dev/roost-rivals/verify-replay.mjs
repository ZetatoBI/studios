// Roost Rivals replay referee. Proves the core is deterministic, which is what online duels and ranked play rest on:
//   1. plays matches where seat 0 issues scripted "human" commands (with network-style input delay) against rivals,
//   2. re-runs each match from only its setup + command log and checks the state hash matches tick for tick,
//   3. saves and restores a match mid-way and checks it ends identically.
// Usage (from the repo root):   node dev/roost-rivals/verify-replay.mjs [matches=30]
// A ranked-duel server would run step 2 on the two players' submitted logs to confirm the winner.
import fs from 'node:fs'; import path from 'node:path';
function loadCore() {
  const p = process.env.RR_HTML || path.join(process.cwd(), 'games/roost-rivals/index.html'), html = fs.readFileSync(p, 'utf8');
  const m = html.match(/<script>\s*(\/\* ===== ROOST RIVALS CORE[\s\S]*?)<\/script>/); if (!m) throw new Error('core block not found in ' + p);
  const mod = { exports: {} }; new Function('module', m[1])(mod); return mod.exports;
}
const RR = loadCore(), N = +(process.argv[2] || 30), CAP = (RR.NIGHTFALL + 5) * RR.TICK_HZ, birds = RR.BIRD_IDS, pers = Object.keys(RR.PERS);
let fail = 0, cmds = 0, ticks = 0;
for (let m = 0; m < N; m++) {
  const R = RR.rng(777 + m), nP = 2 + (m % 3), duel = m % 4 === 3;          // every 4th match is a pure two-human duel (no AI at all)
  const players = (duel ? [0, 1] : [...Array(nP).keys()]).map(i => ({ bird: birds[Math.floor(R() * 5)], name: 'P' + i, ai: (duel || i === 0) ? null : { skill: 0.3 + R() * 0.7, pers: pers[Math.floor(R() * 5)] } }));
  const setup = { players, opts: { seed: 4242 + m * 7919, mods: m % 5 === 0 ? { gale: 1 } : {}, soloEnd: duel ? -1 : 0 } };
  const humans = players.map((p, i) => p.ai ? -1 : i).filter(i => i >= 0);
  const S = RR.newMatch(setup.players, setup.opts), trail = []; let snap = null;
  while (!S.over && S.tick < CAP) {
    if (S.tick % 12 === 0) for (const h of humans) { const mine = S.nodes.filter(n => n.owner === h); if (!mine.length) continue;
      const a = mine[Math.floor(R() * mine.length)], b = S.nodes[Math.floor(R() * S.nodes.length)];
      if (a.id !== b.id) RR.cmd(S, { k: 'send', p: h, from: a.id, to: b.id, r: RR.RATIOS[Math.floor(R() * 4)] }, 3);
      if (R() < 0.1) RR.cmd(S, { k: 'call', p: h }, 3); if (R() < 0.002) RR.cmd(S, { k: 'quit', p: h }, 3); }
    if (S.tick === 600) snap = RR.snapshot(S);
    RR.step(S); S.events.length = 0; if (S.tick % 150 === 0) trail.push(RR.hash(S));
  }
  const final = RR.hash(S); cmds += S.log.length; ticks += S.tick;
  // 2. replay from setup + log only (round-tripped through JSON, as it would be over a network)
  const wire = JSON.parse(JSON.stringify({ setup: S.setup, log: S.log })), trail2 = [];
  const S2 = RR.replay(wire.setup, wire.log, CAP, s => { if (s.tick % 150 === 0) trail2.push(RR.hash(s)); });
  const okReplay = RR.hash(S2) === final && trail.join() === trail2.join() && S2.over && S2.over.winner === S.over.winner && S2.over.tick === S.over.tick;
  // 3. snapshot -> restore -> finish with the remaining commands
  let okSnap = true; if (snap) { const S3 = RR.restore(snap); let i = 0; while (i < S.log.length && S.log[i][0] < 600) i++;
    S3.cmds = []; while (!S3.over && S3.tick < CAP) { while (i < S.log.length && S.log[i][0] <= S3.tick) { const c = S.log[i++]; RR.cmdAt(S3, { tick: S3.tick, p: c[1], k: c[2], from: c[3], to: c[4], r: c[5] }); } RR.step(S3); S3.events.length = 0; }
    okSnap = RR.hash(S3) === final; }
  if (!okReplay || !okSnap) { fail++; console.log(`  match ${m}: ${okReplay ? '' : 'REPLAY MISMATCH '}${okSnap ? '' : 'SNAPSHOT MISMATCH'}`); }
}
console.log(`${N} matches, ${ticks} ticks, ${cmds} player commands replayed: ${fail ? fail + ' FAILED' : 'all identical (replay and snapshot)'}`);
process.exit(fail ? 1 : 0);
