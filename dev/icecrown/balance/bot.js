// Ice Crown balance bot: plays one map like a solid average player (economy, build order, all heroes with
// autocast, forge upgrades, steady army). No micro, stances or focus fire, so a human who uses those should beat it.
// v1.4: always picks the first talent option; wears no boss gear unless the profile passes prog.gear.
// Runs inside the game page opened with ?debug (which exposes window.__IC).
(opts)=>{ const I=__IC; I.PROG_SET(Object.assign({gear:{owned:[],equipped:{}}},opts.prog)); I.startMap(opts.map); const S=()=>I.S;
 const heroOrder=['warrior','mage','ranger'], buildOrder=['barracks','farm','forge','farm','farm','tower','farm','tower','farm'];
 let tick=0, log=[], lost=0, minTC=1, prevN=0;
 const cost=(c)=>c.gold<=S().res.gold&&(c.lumber||0)<=S().res.lumber;
 function think(){ const s=S(); const ws=s.units.filter(u=>u.type==='worker');
  ws.forEach(w=>{ if(w.job==='idle'){ const g=ws.filter(x=>x.job==='gold').length; I.setJob(w,(g<ws.length*.6&&s.mineLeft!==0)?'gold':'lumber'); } });
  if(ws.length+s.tc.queue.length<opts.workers&&s.tc.queue.length<1&&s.res.gold>=60) I.trainWorker();
  // build order
  const have={}; s.buildings.forEach(b=>have[b.type]=(have[b.type]||0)+1); const need={};
  for(const t of buildOrder){ need[t]=(need[t]||0)+1; if((have[t]||0)<need[t]){ if(cost(({barracks:{gold:120,lumber:60},farm:{gold:60,lumber:40},forge:{gold:100,lumber:120},tower:{gold:80,lumber:100}})[t])) I.tryBuild(t); break; } }
  if(I.foodUsed()>=I.foodCap()-2&&(have.farm||0)<5&&s.res.gold>80) I.tryBuild('farm');
  const bar=s.buildings.find(b=>b.type==='barracks'&&b.built);
  if(bar){ for(const h of heroOrder){ if(!s.heroes.some(x=>x.cls===h)&&!bar.queue.some(q=>q.key===h)){ if(s.res.gold>=180) I.recruitHero(h); break; } } }
  if(!s.keep&&!s.tc.upg&&s.wave>=opts.keepAt&&s.res.gold>=380&&s.res.lumber>=240) I.upgradeKeep();
  if(s.buildings.some(b=>b.type==='forge'&&b.built)){ for(const k of ['weapons','armor','weapons','armor','arcana']){ if(s.forge[k]<(s.keep?5:3)&&s.res.gold>200&&s.res.lumber>150){ I.forgeUp(k); break; } } }
  if(bar&&bar.queue.length<2&&I.foodUsed()+3<=I.foodCap()){ const n=s.units.filter(u=>u.type!=='worker').length; const k=s.keep&&n%3===0?'heavy':n%2?'ranged':'melee'; if(s.res.gold>=150) I.trainUnit(k); }
  s.heroes.forEach(h=>{ let t; while((t=I.talentPending(h))>=0) I.pickTalent(h,t,0); });
  s.auto={warrior:[1,1,1],mage:[1,1,1],ranger:[1,1,1]};
 }
 const M=I.MAPS[opts.map]; let guard=0;
 while(!S().over&&guard++<200000){ if(tick%20===0) think(); if(S().waveState==='idle'&&S().wave<M.waves&&tick>20*60) I.startWave();
  const nb=S().units.filter(u=>u.type!=='worker').length; if(nb<prevN) lost+=prevN-nb; prevN=nb; minTC=Math.min(minTC,S().tc.hp/S().tc.maxHp);
  I.tick(1); tick++; if(S().waveState==='idle'&&S().wave===M.waves) break; }
 const s=S(), late=Object.entries(s.dmgLog||{}).filter(([n])=>+n>M.waves*2/3&&!M.bosses[+n]).sort((a,b)=>b[1].t-a[1].t)[0];
 if(s.over) log.push(JSON.stringify({b:s.buildings.map(b=>b.type+(b.built?'':'*')),res:[Math.round(s.res.gold),Math.round(s.res.lumber)],w:s.units.filter(u=>u.type==='worker').map(u=>u.job).join(','),h:s.heroes.length,mine:s.mineLeft}));
 return {log,map:M.id,wave:s.wave,of:M.waves,won:s.wave===M.waves&&!s.over&&s.tc.hp>0,tc:Math.round(s.tc.hp/s.tc.maxHp*100),army:s.units.filter(u=>u.type!=='worker').length,heroes:s.heroes.map(h=>h.lvl).join('/'),deaths:s.heroDeaths,lost,minTC:Math.round(minTC*100),min:Math.round(tick*0.05/60),share:late?Math.round(late[1].h/late[1].t*100):null,shareWave:late?+late[0]:null};
}
