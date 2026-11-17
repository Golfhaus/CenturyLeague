import {inputFor} from './tools.mjs';
export const HEAT_ARMS = [{id:'temperate',temperatureC:18},{id:'hot',temperatureC:35}];
export function heatInput(e,profile,fixture,arm) {
 const teams=structuredClone(profile.teams),ordered=fixture.swap?[teams[1],teams[0]]:teams;
 const base=inputFor(e,ordered,fixture.id,fixture.seed,'2026-11-14');
 return {...base,weather:{version:'fixed-weather-v1',enabled:['weather'],endPolicy:'alternate-quarters',conditions:{
  temperatureC:arm.temperatureC,relativeHumidity:80,windKmh:0,gustKmh:0,rainMmPerHour:0,windDirectionDegrees:45}},
  lab:{enabled:[],streaks:[0,0],confidenceScale:.2,frustrationScale:1,psychology:{version:'shared-psych-v1',homeOddsBonus:.004,maximumOddsBonus:.006,homeSide:null}}};
}
