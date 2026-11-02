import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {input as synthetic} from './replay-runtime-probe.mjs';
import {CANDIDATE_RECOVERY_POLICY as policy,recoveryDays,createOperations,prepareCompetitiveInput,simulateCompetitiveMatch} from '../packages/simulation-core/dist/competitive/index.js';

// A narrow recovery/cadence study, not another league-strength or balance sweep.
const rosterPath=process.argv[2],output=process.argv[3];
const raw=rosterPath?fs.readFileSync(rosterPath,'utf8'):null;
const teams=raw?JSON.parse(raw).result.input.teams:synthetic.teams;
const probabilities=Array(29).fill(0),totalWeight=policy.bands.reduce((s,b)=>s+b.weight,0);
for(const b of policy.bands)for(let d=b.minimumDays;d<=b.maximumDays;d++)probabilities[d]+=b.weight/totalWeight/(b.maximumDays-b.minimumDays+1);
const draws=20000,counts=Array(29).fill(0);
for(let i=0;i<draws;i++)counts[recoveryDays(policy,`recovery-calibration-v1:${i}`,1,'calibration-player')]++;
const state=createOperations('men',policy),matches=48,injuries=[],cases=[];
for(let i=0;i<matches;i++){
 const input=prepareCompetitiveInput(state,{id:`calibration-${i}`,seed:`availability-calibration-v1:${i}`,teams:i%2?[teams[1],teams[0]]:teams},'2026-11-02');
 const result=simulateCompetitiveMatch(input);
 injuries.push(result.events.filter(e=>e.type==='injury').length);
 cases.push(result.events.filter(e=>e.type==='foul'&&e.data?.serious).length);
}
const mean=probabilities.reduce((s,p,d)=>s+p*d,0);
const report={schemaVersion:'century-recovery-calibration-v1',policy,draws,
 recovery:{exactMeanDays:mean,sampledMeanDays:counts.reduce((s,n,d)=>s+n*d,0)/draws,bands:policy.bands.map(b=>({...b,observed:counts.slice(b.minimumDays,b.maximumDays+1).reduce((a,n)=>a+n,0)/draws}))},
 cadence:[1,2,3,7].map(gapDays=>({gapDays,probabilityOfMissingNext:probabilities.reduce((s,p,d)=>s+(d>gapDays?p:0),0),expectedFutureMatchesMissedPerInjury:probabilities.reduce((s,p,d)=>s+p*Math.max(0,Math.floor((d-1)/gapDays)),0)})),
 injuryContext:{matches,teams:teams.map(t=>({id:t.id,name:t.name})),source:raw?'two canonical rosters from an immutable rehearsal export':'two fictional controlled rosters',sourceSHA256:raw?createHash('sha256').update(raw).digest('hex'):null,
 totalInjuries:injuries.reduce((a,n)=>a+n,0),matchesWithInjury:injuries.filter(n=>n>0).length,maximumInjuriesInMatch:Math.max(...injuries),seriousFlags:cases.reduce((a,n)=>a+n,0),
 caveat:'Each match starts healthy. This small two-team sample describes incidence only; it is not a season availability forecast or league-wide estimate.'},
 interpretation:'Eligible on recoveredOn: an injury of D days misses floor((D-1)/gapDays) later fixtures. Cadences are illustrations, not an adopted tournament schedule. No automatic suspension tariff is inferred from flags.',liveWrites:0};
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
