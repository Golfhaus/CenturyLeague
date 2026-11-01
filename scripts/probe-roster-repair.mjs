import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { simulateMatch } from '../packages/simulation-core/dist/match/index.js';
import { calculateRoleRatings } from '../packages/simulation-core/dist/roleRatings.js';

// A deliberately separate counterfactual: never changes the canonical draft or the league sample.
const args=process.argv.slice(2),option=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];};
const study=path.resolve(option('--study','league-balance-study')),output=path.resolve(option('--output','roster-repair-probe'));
const population=JSON.parse(fs.readFileSync(option('--players'),'utf8'));
const teams=JSON.parse(fs.readFileSync(path.join(study,'teams.json'),'utf8'));
const source=JSON.parse(fs.readFileSync(path.join(study,'manifest.json'),'utf8'));
const original=JSON.stringify(teams),club=teams.findIndex(t=>t.name==='Wilmington Cape CC');
const opponents=['Manchester Borough CC','Anacostia United','Erie City Rovers'].map(name=>teams.findIndex(t=>t.name===name));
if(club<0||opponents.some(i=>i<0))throw Error('Expected clubs absent');
const keys=Object.keys(teams[0].players[0].ratings),drafted=new Set(teams.flatMap(t=>t.players.map(p=>p.id)));
const freeAgents=population.filter(p=>!drafted.has(p.id)).map(p=>({id:p.id,name:`${p.first_name} ${p.last_name}`,
  ratings:Object.fromEntries(keys.map(k=>[k,Number(p[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase())])]))}));
if(freeAgents.length!==270||freeAgents.some(p=>Object.values(p.ratings).some(v=>!Number.isFinite(v)||v<1||v>20)))throw Error('Bad free-agent pool');
const mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
const quality=p=>calculateRoleRatings(p.ratings).overallRating;
const rawMean=p=>mean(Object.values(p.ratings));
// Mean of exactly the two existing contest formulas. Contested possession appears in both.
const acquisition=p=>(mean(['verticalLeap','strength','contestedPossession'].map(k=>p.ratings[k]))+
  mean(['groundBallSkill','contestedPossession'].map(k=>p.ratings[k])))/2;
const eligibleFor=old=>freeAgents.filter(p=>Math.abs(quality(p)-quality(old))<=.25&&Math.abs(rawMean(p)-rawMean(old))<=.5);
const departures=[...teams[club].players].filter(p=>eligibleFor(p).length>=5)
  .sort((a,b)=>acquisition(a)-acquisition(b)||a.id.localeCompare(b.id)).slice(0,8);
if(departures.length!==8)throw Error('Not enough matchable departures');
const variants={baseline:teams[club]},changes={};
for(const condition of ['targeted','qualityMatched']) {
  const used=new Set(),replacements=new Map();changes[condition]=[];
  for(const old of departures) {
    const eligible=freeAgents.filter(p=>!used.has(p.id)&&Math.abs(quality(p)-quality(old))<=.25&&Math.abs(rawMean(p)-rawMean(old))<=.5);
    if(!eligible.length)throw Error('No quality-matched candidate; do not relax constraints after observing outcomes');
    eligible.sort((a,b)=>condition==='targeted'?acquisition(b)-acquisition(a)||a.id.localeCompare(b.id):
      Math.abs(quality(a)-quality(old))+Math.abs(rawMean(a)-rawMean(old))-
      Math.abs(quality(b)-quality(old))-Math.abs(rawMean(b)-rawMean(old))||a.id.localeCompare(b.id));
    const picked=eligible[0];used.add(picked.id);replacements.set(old.id,picked);
    changes[condition].push({out:old.id,outName:old.name,in:picked.id,inName:picked.name,
      outOverall:quality(old),inOverall:quality(picked),outRawMean:rawMean(old),inRawMean:rawMean(picked),
      outAcquisition:acquisition(old),inAcquisition:acquisition(picked)});
  }
  variants[condition]={...teams[club],players:teams[club].players.map(p=>replacements.get(p.id)??p)};
}
const hash=s=>createHash('sha256').update(s).digest('hex');
const manifest={engineSourceSHA256:source.engineSourceSHA256,sourceInputSHA256:source.inputSHA256,
  club:teams[club].name,opponents:opponents.map(i=>teams[i].name),repeatsPerOpponent:50,
  conditions:Object.keys(variants),expectedMatches:450,signings:8,originalCoaching:true,
  departureRule:'Eight lowest mean ball-up/ground-contest attribute scores among players with at least five quality-matched free-agent candidates',
  candidateRule:'Undrafted founding player, overall within 0.25 and raw-attribute mean within 0.5 of departure; no duplicated signing within a condition',
  targetedRule:'Highest acquisition score among eligible candidates',
  qualityMatchedRule:'Smallest sum of absolute differences in overall and raw-attribute mean, without considering acquisition',
  seedScheme:'century-roster-repair-v0.1:{club}:{opponent}:{n}',sidesPerOpponent:[25,25],
  stoppingRule:'All 450 matches, no selection by match outcomes or threshold relaxation',
  variantHashes:Object.fromEntries(Object.entries(variants).map(([k,v])=>[k,hash(JSON.stringify(v))]))};
fs.mkdirSync(path.join(output,'samples'),{recursive:true});
const mf=path.join(output,'manifest.json');
if(fs.existsSync(mf)&&JSON.stringify(JSON.parse(fs.readFileSync(mf)))!==JSON.stringify(manifest))throw Error('Changed probe settings');
fs.writeFileSync(mf,JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(output,'rosters.json'),JSON.stringify({variants,changes}));
const summaries=[];
for(const [condition,team] of Object.entries(variants))for(const opponent of opponents) {
  const file=path.join(output,`${condition}-${opponent}.json`);let games;
  if(fs.existsSync(file))games=JSON.parse(fs.readFileSync(file));else {
    games=[];
    for(let n=0;n<50;n++) {
      const order=n%2?[opponent,club]:[club,opponent],own=order.indexOf(club);
      const input={id:`repair-${condition}-${opponent}-${n}`,seed:`century-roster-repair-v0.1:${club}:${opponent}:${n}`,
        teams:order.map(i=>i===club?team:teams[i]),provenance:{engineSourceSHA256:source.engineSourceSHA256,condition}};
      const r=simulateMatch(input);
      if(r.scores[r.winner]!==100||r.scores[1-r.winner]>=100)throw Error('Bad probe score');
      for(const side of [0,1])if(r.players.filter(p=>p.side===side).reduce((s,p)=>s+(p.stats.points??0),0)!==r.scores[side])throw Error('Probe points mismatch');
      games.push({id:input.id,seed:input.seed,condition,opponent,ownSide:own,won:r.winner===own,
        scores:[r.scores[own],r.scores[1-own]],teamStats:[r.teamStats[own],r.teamStats[1-own]]});
      if(n===0)fs.writeFileSync(path.join(output,'samples',`${input.id}.json`),JSON.stringify(r));
    }
    fs.writeFileSync(`${file}.tmp`,JSON.stringify(games));fs.renameSync(`${file}.tmp`,file);
  }
  if(games.length!==50)throw Error('Incomplete probe');
  const total=(key,side)=>games.reduce((s,g)=>s+(g.teamStats[side][key]??0),0),wins=games.filter(g=>g.won).length;
  const row={condition,opponent,opponentName:teams[opponent].name,wins,losses:50-wins,
    meanMargin:mean(games.map(g=>g.scores[0]-g.scores[1])),shotShare:total('shots',0)/(total('shots',0)+total('shots',1)),
    ballUpShare:total('ballUpsWon',0)/(total('ballUpsWon',0)+total('ballUpsWon',1)),
    groundRecoveryShare:total('recoveries',0)/(total('recoveries',0)+total('recoveries',1)),
    pointsPerShot:total('points',0)/total('shots',0)};
  summaries.push(row);console.log(JSON.stringify(row));
}
if(JSON.stringify(teams)!==original)throw Error('Canonical input changed');
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({manifest,changes,
  attributes:Object.entries(variants).map(([condition,t])=>({condition,overall:mean(t.players.map(quality)),
    rawMean:mean(t.players.map(rawMean)),acquisition:mean(t.players.map(acquisition))})),series:summaries},null,2));
