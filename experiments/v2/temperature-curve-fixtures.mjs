import {heatInput} from './heat-fixtures.mjs';
import {weatherForArm} from './weather-fixtures.mjs';
export const CURVE_ARMS=[{id:'temperate',temperatureC:18,traits:'none'},...[28,32,35].flatMap(temperatureC=>[
 {id:`t${temperatureC}-shared`,temperatureC,traits:'none'},
 {id:`t${temperatureC}-normal-050`,temperatureC,traits:'normal',thermalCandidate:'original-050'},
 {id:`t${temperatureC}-normal-035`,temperatureC,traits:'normal',thermalCandidate:'reduced-035'}])];
export function curveInput(e,profile,fixture,arm){
 const base=heatInput(e,profile,fixture,arm);
 if(arm.traits==='normal'){
  base.weather=weatherForArm(e,base,fixture,{weather:{environment:'hot',traits:'normal',endPolicy:'alternate-quarters',thermalCandidate:arm.thermalCandidate}});
  base.weather.conditions.temperatureC=arm.temperatureC;
 }
 return base;
}
