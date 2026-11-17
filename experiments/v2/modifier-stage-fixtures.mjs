import {COLD_ARMS,coldInput} from './cold-fixtures.mjs';
import {weatherForArm} from './weather-fixtures.mjs';
export const COMBINED_ARMS=[
 {id:'control',environment:null,physical:null,psychology:null},
 ...['favored','adverse'].map(direction=>({id:'psych-'+direction,environment:null,physical:null,psychology:direction})),
 ...['hot','cold'].flatMap(environment=>['favored','adverse'].map(direction=>({id:`${environment}-physical-${direction}`,environment,physical:direction,psychology:null}))),
 ...['hot','cold'].flatMap(environment=>['favored','adverse'].map(direction=>({id:`${environment}-combined-${direction}`,environment,physical:direction,psychology:direction})))
];
export function stageArms(stage){
 if(stage==='cold-confirmation')return COLD_ARMS.filter(a=>['wet-5','wet-5-adverse-035'].includes(a.id));
 if(stage==='combined')return COMBINED_ARMS;
 throw Error('Unknown modifier stage');
}
export function stageInput(e,profile,fixture,arm,stage){
 if(stage==='cold-confirmation')return coldInput(e,profile,fixture,arm);
 if(stage!=='combined')throw Error('Unknown stage');
 const input=coldInput(e,profile,fixture,COLD_ARMS.find(a=>a.id==='dry18'));
 if(arm.environment){
  input.weather=weatherForArm(e,input,fixture,{weather:{environment:arm.environment==='hot'?'hotWet':'cold',traits:arm.physical==='favored'?'focal-favored':'opponent-favored',endPolicy:'alternate-quarters',thermalCandidate:'reduced-035'}});
  if(arm.environment==='cold')input.weather.conditions.temperatureC=-5;
 }
 if(arm.psychology){
  const side=Number(fixture.swap),favored=arm.psychology==='favored',streaks=[0,0];streaks[side]=favored?5:-5;streaks[1-side]=favored?-5:5;
  input.lab={enabled:['confidence','frustration','home-support'],streaks,confidenceScale:.2,frustrationScale:1,psychology:{version:'shared-psych-v1',homeOddsBonus:.004,maximumOddsBonus:.006,homeSide:favored?side:1-side}};
 }
 return input;
}
export function stageRow(result,input,fixture,arm){
 const side=Number(fixture.swap),final=result.events.at(-1).data.finalCondition;
 const energy=s=>final.filter(p=>input.teams[s].players.some(q=>q.id===p.playerId)).reduce((a,p)=>a+p.energy,0)/35;
 return {id:arm.id,focalWin:Number(result.winner===side),focalScore:result.scores[side],opponentScore:result.scores[1-side],playingSeconds:result.playingSeconds,
  focalShots:result.teamStats[side].shots,opponentShots:result.teamStats[1-side].shots,focalMeanFinalEnergy:energy(side),opponentMeanFinalEnergy:energy(1-side),
  weather:result.weatherTelemetry,lab:result.labTelemetry};
}
