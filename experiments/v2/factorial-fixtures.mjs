import {inputFor} from './tools.mjs';
export const FACTORIAL_POLICY=Object.freeze({humidity:80,direction:45,temperature:[18,35],wind:[0,35],gust:[0,50],rain:[0,5],matched:{tempo:4,running_movement_emphasis:4,pressure:2}});
export const FACTORIAL_ARMS=['original','matched'].flatMap(context=>Array.from({length:8},(_,mask)=>({id:`${context}-${mask}`,context,mask,
 heat:Boolean(mask&1),wind:Boolean(mask&2),rain:Boolean(mask&4)})));
export function factorialInput(e,profile,fixture,arm){
 const teams=structuredClone(profile.teams);
 if(arm.context==='matched')Object.assign(teams[0].coach.tactics,FACTORIAL_POLICY.matched);
 const ordered=fixture.swap?[teams[1],teams[0]]:teams;
 const base=inputFor(e,ordered,fixture.id,fixture.seed,'2026-11-13');
 return {...base,weather:{version:'fixed-weather-v1',enabled:['weather'],endPolicy:'alternate-quarters',conditions:{
  temperatureC:arm.heat?35:18,relativeHumidity:80,windKmh:arm.wind?35:0,gustKmh:arm.wind?50:0,rainMmPerHour:arm.rain?5:0,windDirectionDegrees:45}},
  lab:{enabled:[],streaks:[0,0],confidenceScale:.2,frustrationScale:1,psychology:{version:'shared-psych-v1',homeOddsBonus:.004,maximumOddsBonus:.006,homeSide:null}}};
}
