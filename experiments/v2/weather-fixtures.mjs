export const FIXED_WEATHER = {
 calm:{temperatureC:18,relativeHumidity:55,windKmh:0,gustKmh:0,rainMmPerHour:0,windDirectionDegrees:45},
 wet:{temperatureC:17,relativeHumidity:85,windKmh:35,gustKmh:50,rainMmPerHour:5,windDirectionDegrees:45},
 cold:{temperatureC:4,relativeHumidity:90,windKmh:35,gustKmh:50,rainMmPerHour:5,windDirectionDegrees:45},
 hot:{temperatureC:35,relativeHumidity:80,windKmh:0,gustKmh:0,rainMmPerHour:0,windDirectionDegrees:45},
 hotWet:{temperatureC:35,relativeHumidity:80,windKmh:35,gustKmh:50,rainMmPerHour:5,windDirectionDegrees:45}
};
const arm=(id,environment,traits='none',psychology='off',endPolicy='alternate-quarters')=>({id,
 enabled:psychology==='off'?[]:['confidence','frustration','home-support'],
 focal:psychology==='favored'?5:psychology==='adverse'?-5:0,
 opponent:psychology==='favored'?-5:psychology==='adverse'?5:0,
 home:psychology==='favored'?'focal':psychology==='adverse'?'opponent':null,
 ...(environment?{weather:{environment,traits,endPolicy}}:{})});
export const WEATHER_ARMS = [
 arm('control',null),arm('calm-parity','calm'),arm('wind-wet','wet'),
 arm('wind-wet-fixed-ends','wet','none','off','fixed'),
 arm('hot-shared','hot'),arm('cold-shared','cold'),arm('hot-normal-traits','hot','normal'),
 arm('cold-normal-traits','cold','normal'),arm('hot-wet-shared','hotWet'),
 arm('hot-traits-favored','hot','focal-favored'),arm('hot-traits-adverse','hot','opponent-favored'),
 arm('hot-wet-traits-favored','hotWet','focal-favored'),arm('hot-wet-traits-adverse','hotWet','opponent-favored'),
 arm('cold-traits-favored','cold','focal-favored'),arm('cold-traits-adverse','cold','opponent-favored'),
 arm('hot-psych-favored','hotWet','focal-favored','favored'),arm('hot-psych-adverse','hotWet','opponent-favored','adverse'),
 arm('cold-psych-favored','cold','focal-favored','favored'),arm('cold-psych-adverse','cold','opponent-favored','adverse')
];
export function weatherForArm(e,base,fixture,arm) {
 if(!arm.weather)return undefined;
 const {environment,traits,endPolicy,thermalCandidate}=arm.weather;
 if(!FIXED_WEATHER[environment])throw Error('Unknown weather scenario');
 const enabled=['weather'];const result={version:'fixed-weather-v1',enabled,endPolicy,conditions:{...FIXED_WEATHER[environment]}};
 if(thermalCandidate!==undefined)result.thermalCandidate=thermalCandidate;
 if(traits!=='none'){
  enabled.push('temperature-tolerance');const focalSide=fixture.swap?1:0;
  result.traits=Object.fromEntries(base.teams.flatMap((team,side)=>team.players.map(p=>{
   const rng=e.createRandom('century-independent-thermal-traits-v1:'+p.id);
   let heat=Math.max(.1,Math.min(.9,.5+rng.normal(0,.15))),cold=Math.max(.1,Math.min(.9,.5+rng.normal(0,.15)));
   if(traits!=='normal'){
    const favored=traits==='focal-favored'?side===focalSide:side!==focalSide;
    heat=environment.startsWith('hot')?Number(favored):.5;
    cold=environment==='cold'?Number(favored):.5;
   }
   return[p.id,{heat,cold}];
  })));
 }
 return result;
}
