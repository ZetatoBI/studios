// Ice Crown balance bot: plays one map like a solid average player (economy, build order, all heroes with
// autocast, forge upgrades, steady army). No micro, stances or focus fire, so a human who uses those should beat it.
// v1.4: always picks the first talent option; wears no boss gear unless the profile passes prog.gear.
// v1.5: rebalances workers every think (60% gold while the mine lasts), uses Defend, raises the Castle after the Keep,
// trains a healer per 6 soldiers and a siege engine per 10, buys Forge levels up to 8, then Masterwork with spare gold.
// v1.6: opts.keepProg keeps the campaign state (campaign profile: heroes carry over, boons); opts.campaign finishes a
// won battle properly (saves heroes, offers Spoils of War) and takes the first boon offered.
// v1.7: food is a resource: builds farms early and keeps about a quarter of workers farming (2 per farm);
// heroes unlock by tier (the game enforces it); raises the War Barracks after the Castle; checks food in every cost.
// Splits gold and lumber workers by what's scarce, keeps up to 16 workers (they take no population), and spends a
// surplus the way a good player would: sellswords when rich in gold and food, Dragonfire when it can afford it.
// Runs inside the game page opened with ?debug (which exposes window.__IC).
(opts)=>{ const I=__IC; if(!opts.keepProg) I.PROG_SET(Object.assign({gear:{owned:[],equipped:{}}},opts.prog)); I.startMap(opts.map); I.setStance('defend'); const S=()=>I.S;
 const heroOrder=['warrior','mage','ranger'], buildOrder=['barracks','farm','forge','farm','tower','farm','tower','farm','farm'];
 let tick=0, log=[], lost=0, minTC=1, prevN=0, minW=null;
 const cost=(c)=>(c.gold||0)<=S().res.gold&&(c.lumber||0)<=S().res.lumber&&(c.food||0)<=S().res.food;
 function think(){ const s=S(); const ws=s.units.filter(u=>u.type==='worker');
  // rebalance every think, not only idle workers: 60% on gold while the mine has gold
  { const farms=s.buildings.filter(b=>b.type==='farm'&&b.built).length, wantF=Math.min(farms*2,Math.round(ws.length*.25));
   let f=ws.filter(x=>x.job==='food').length;
   while(f<wantF){ const w=ws.find(x=>x.job==='idle')||ws.find(x=>x.job==='lumber'&&x.carry===0)||ws.find(x=>x.job==='gold'&&x.carry===0); if(!w) break; I.setJob(w,'food'); if(w.job!=='food') break; f++; }
   const lumberShort=s.res.lumber<300&&s.res.gold>s.res.lumber*2, goldShort=s.res.gold<200&&s.res.lumber>s.res.gold*2;
   const rest=ws.filter(x=>x.job!=='food'), want=s.mineLeft===0?0:Math.round(rest.length*(lumberShort?.4:goldShort?.8:.6)); let g=rest.filter(x=>x.job==='gold').length;
   rest.forEach(w=>{ if(w.job==='idle'){ const j=g<want?'gold':'lumber'; I.setJob(w,j); if(j==='gold') g++; } });
   if(g<want){ const w=rest.find(x=>x.job==='lumber'&&x.carry===0); if(w) I.setJob(w,'gold'); } else if(g>want+1){ const w=rest.find(x=>x.job==='gold'&&x.carry===0); if(w) I.setJob(w,'lumber'); } }
  if(ws.length+s.tc.queue.length<(s.heroes.length?opts.workers:8)&&s.tc.queue.length<1&&s.res.food>=80) I.trainWorker();
  // build order
  const have={}; s.buildings.forEach(b=>have[b.type]=(have[b.type]||0)+1); const need={};
  for(const t of buildOrder){ need[t]=(need[t]||0)+1; if((have[t]||0)<need[t]){ if(cost(({barracks:{gold:120,lumber:60},farm:{gold:30,lumber:70},forge:{gold:100,lumber:120},tower:{gold:80,lumber:100}})[t])) I.tryBuild(t); break; } }
  const bar=s.buildings.find(b=>b.type==='barracks'&&b.built);
  if(bar){ for(const h of heroOrder){ if(!s.heroes.some(x=>x.cls===h)&&!bar.queue.some(q=>q.key===h)){ if(s.res.gold>=180&&s.res.food>=110&&s.heroes.length<I.heroSlots()) I.recruitHero(h); break; } } }
  if(!s.keep&&!s.tc.upg&&s.wave>=opts.keepAt&&s.res.gold>=380&&s.res.lumber>=240) I.upgradeKeep();
  if(s.keep&&!s.castle&&!s.tc.upg&&s.res.gold>=750&&s.res.lumber>=450&&s.res.food>=350) I.upgradeCastle();
  if(s.castle&&bar&&!bar.war&&!bar.upg&&s.res.gold>=500&&s.res.lumber>=450&&s.res.food>=250) I.upgradeBarracks(bar);
  if(s.buildings.some(b=>b.type==='forge'&&b.built)){ const cap=s.castle?8:s.keep?5:3;
   for(const k of ['weapons','armor','weapons','armor','arcana']){ if(s.forge[k]<cap){ const c=I.forgeCost(k); if(s.res.gold>=c.gold+150&&s.res.lumber>=c.lumber+100) I.forgeUp(k); break; } }
   if(s.castle&&s.forge.weapons>=8&&s.forge.armor>=8){ const c=I.masterCost(); if(s.res.gold>=c.gold+400&&s.res.lumber>=c.lumber+200) I.buyMasterwork(); } }
  if(bar&&bar.queue.length<2&&I.foodUsed()+4<=I.foodCap()){ const us=s.units, cnt=t=>us.filter(u=>u.type===t).length+bar.queue.filter(q=>q.key===t).length;
   const sold=cnt('melee')+cnt('ranged')+cnt('heavy'), n=us.filter(u=>u.type!=='worker').length;
   const war=bar.war, k=war&&cnt('healer')<Math.floor(sold/6)?'healer':war&&cnt('siege')<Math.floor(sold/10)?'siege':s.keep&&n%3===0?'heavy':n%2?'ranged':'melee';
   if(s.res.gold>=130&&s.res.food>=90) I.trainUnit(k); }
  if(s.keep&&s.wave>0&&s.res.gold>=1600&&s.res.food>=500&&s.units.filter(u=>u.type==='merc'&&!u.leaving).length<10){ const c=I.mercCost(); if(s.res.gold>=c.gold+600) I.hireMercs(); }
  if(s.castle&&!s.buildings.some(b=>b.type==='roost')&&s.res.gold>=2200&&s.res.lumber>=1700&&s.res.food>=800) I.tryBuild('roost');
  if(s.buildings.some(b=>b.type==='roost'&&b.built)&&!s.dragon&&!(s.dragonCd>0)&&s.enemies.length>=15&&s.res.gold>=1900&&s.res.lumber>=1550&&s.res.food>=1250) I.callDragon();
  s.heroes.forEach(h=>{ let t; while((t=I.talentPending(h))>=0) I.pickTalent(h,t,0); });
  s.auto={warrior:[1,1,1],mage:[1,1,1],ranger:[1,1,1]};
 }
 const M=I.MAPS[opts.map]; let guard=0;
 while(!S().over&&guard++<200000){ if(tick%20===0) think(); if(S().waveState==='idle'&&S().wave<M.waves&&tick>20*60) I.startWave();
  const nb=S().units.filter(u=>u.type!=='worker').length; if(nb<prevN) lost+=prevN-nb; prevN=nb; minTC=Math.min(minTC,S().tc.hp/S().tc.maxHp);
  const nw=S().units.filter(u=>u.type==='worker').length; if(minW!=null||nw>=8) minW=minW==null?nw:Math.min(minW,nw);   // lowest worker count once 8 were reached
  I.tick(1); tick++; if(S().waveState==='idle'&&S().wave===M.waves) break; }
 const WON=S().wave===M.waves&&!S().over&&S().tc.hp>0;
 if(opts.campaign){ const w=WON; if(w) I.finish(true); const c=M.campaign; I.pendingBoons(c).forEach(i=>I.pickBoon(c,i,I.campState(c).offered[i].ids[0])); }
 const s=S(), late=Object.entries(s.dmgLog||{}).filter(([n])=>+n>M.waves*2/3&&!M.bosses[+n]).sort((a,b)=>b[1].t-a[1].t)[0];
 if(s.over) log.push(JSON.stringify({b:s.buildings.map(b=>b.type+(b.built?'':'*')),res:[Math.round(s.res.gold),Math.round(s.res.lumber)],w:s.units.filter(u=>u.type==='worker').map(u=>u.job).join(','),h:s.heroes.length,mine:s.mineLeft}));
 return {log,map:M.id,wave:s.wave,of:M.waves,won:WON,tc:Math.round(s.tc.hp/s.tc.maxHp*100),army:s.units.filter(u=>u.type!=='worker').length,heroes:s.heroes.map(h=>h.lvl).join('/'),deaths:s.heroDeaths,lost,minTC:Math.round(minTC*100),min:Math.round(tick*0.05/60),share:late?Math.round(late[1].h/late[1].t*100):null,shareWave:late?+late[0]:null,stuck:s.antiStuck||0,minW,master:s.master||0,castle:!!s.castle,haz:s.taken?Math.round((s.hazTaken||0)/s.taken*100):0,heroLv:s.heroes.map(h=>h.lvl).join('/')};
}
