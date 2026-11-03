/** Independent dry-run resolver for the immutable inaugural template. */
export function resolveEntrants(format,slot,outcomes){
 const pick=route=>{
  if(route.startsWith('S'))return Number(route.slice(1));
  const [kind,code]=route.split(':');return outcomes[code]?.[kind==='W'?'winner':'loser']??null;
 };
 if(slot.pool){
  const codes=slot.pool==='A'?['M13','M14','M19','M20']:['M21','M22','M23','M24'];
  const seeds=codes.map(code=>outcomes[code]?.loser);
  return seeds.some(s=>s==null)?[null,null]:slot.ranks.map(rank=>[...seeds].sort((a,b)=>a-b)[rank-1]);
 }
 return slot.entrants.map(pick);
}
export function divisions(outcomes){
 const w=code=>outcomes[code]?.winner,l=code=>outcomes[code]?.loser;
 return {'Championship':[w('M35'),w('M37')],'Division One':['M37','M36','M33','M34'].map(l),
  'Division Two':[l('M29'),l('M30'),w('M31'),w('M32')],'Division Three':[l('M31'),l('M32'),w('M25'),w('M26')],
  'Division Four':['M25','M26','M11','M12'].map(l)};
}
export function validateDraws(format,count=2000){
 let resetCount=0;
 for(let draw=0;draw<count;draw++){
  const outcomes={},losses=new Map(),appearances=new Map(),windows=new Set();
  let random=(draw+1)>>>0,title=0,played=0;
  const assert=(v,message)=>{if(!v)throw Error(message);};
  for(const slot of format.slots){
   if(slot.conditional&&outcomes.M38.winner===outcomes.M35.winner)continue;
   const entrants=resolveEntrants(format,slot,outcomes);
   assert(entrants.every(s=>s>=1&&s<=18)&&entrants[0]!==entrants[1],'Distinct seeded participants');
   for(const s of entrants){
    const key=slot.window+':'+s;assert(!windows.has(key),'No team twice in window');windows.add(key);
    const last=appearances.get(s);if(last)assert((Date.parse(slot.matchDate)-Date.parse(last))/86400000>=3,'Two full off-days');
    appearances.set(s,slot.matchDate);
   }
   random=(Math.imul(random,1664525)+1013904223)>>>0;
   const side=(random>>>16)&1;const winner=entrants[side],loser=entrants[1-side];
   outcomes[slot.code]={winner,loser};played++;
   if(!slot.pool){title++;losses.set(loser,(losses.get(loser)??0)+1);assert((losses.get(loser)??0)<=2,'Two losses eliminate');}
  }
  const champion=outcomes.M39?.winner??outcomes.M38.winner;
  for(let seed=1;seed<=18;seed++)assert(seed===champion?(losses.get(seed)??0)<2:losses.get(seed)===2,'Every eliminated team has exactly two title losses');
  assert(title===(outcomes.M39?35:34)&&played===(outcomes.M39?39:38),'Match totals');
  assert(new Set(Object.values(divisions(outcomes)).flat()).size===18,'Each club allocated exactly once');
  if(outcomes.M39)resetCount++;
 }
 if(!resetCount||resetCount===count)throw Error('Exercise both final paths');
 return {draws:count,resetCount,noResetCount:count-resetCount};
}
