import {heatInput} from './heat-fixtures.mjs';
import {weatherForArm} from './weather-fixtures.mjs';
export const COLD_ARMS=[
 {id:'dry18',temperatureC:18,wet:false,traits:'none'},
 {id:'dry0',temperatureC:0,wet:false,traits:'none'},
 {id:'dry-5',temperatureC:-5,wet:false,traits:'none'},
 {id:'wet18',temperatureC:18,wet:true,traits:'none'},
 {id:'wet4',temperatureC:4,wet:true,traits:'none'},
 {id:'wet-5',temperatureC:-5,wet:true,traits:'none'},
 {id:'dry-5-normal-035',temperatureC:-5,wet:false,traits:'normal',thermalCandidate:'reduced-035'},
 {id:'wet-5-normal-035',temperatureC:-5,wet:true,traits:'normal',thermalCandidate:'reduced-035'},
 {id:'wet-5-favored-035',temperatureC:-5,wet:true,traits:'focal-favored',thermalCandidate:'reduced-035'},
 {id:'wet-5-adverse-035',temperatureC:-5,wet:true,traits:'opponent-favored',thermalCandidate:'reduced-035'},
 {id:'wet-5-favored-050',temperatureC:-5,wet:true,traits:'focal-favored',thermalCandidate:'original-050'},
 {id:'wet-5-adverse-050',temperatureC:-5,wet:true,traits:'opponent-favored',thermalCandidate:'original-050'}
];
export function coldInput(e,profile,fixture,arm){
 const base=heatInput(e,profile,fixture,arm);
 if(arm.traits!=='none')base.weather=weatherForArm(e,base,fixture,{weather:{environment:'cold',traits:arm.traits,endPolicy:'alternate-quarters',thermalCandidate:arm.thermalCandidate}});
 base.weather.conditions={temperatureC:arm.temperatureC,relativeHumidity:90,windKmh:arm.wet?35:0,gustKmh:arm.wet?50:0,rainMmPerHour:arm.wet?5:0,windDirectionDegrees:45};
 return base;
}
