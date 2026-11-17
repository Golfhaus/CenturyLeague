/** Fixed laboratory weather hypotheses, not a physiological or ball-flight calibration. */
export interface FixedConditions {
  temperatureC: number; relativeHumidity: number; windKmh: number; gustKmh: number;
  rainMmPerHour: number; windDirectionDegrees: number;
}
export interface ThermalTraits { heat: number; cold: number }
export interface WeatherSettings {
  version: 'fixed-weather-v1'; enabled: ('weather' | 'temperature-tolerance')[];
  endPolicy: 'fixed' | 'alternate-quarters';
  thermalCandidate?: 'original-050' | 'reduced-035';
  conditions: FixedConditions; traits?: Record<string, ThermalTraits>;
}
export type WeatherAction = 'kick' | 'hand' | 'catch' | 'shot-central' | 'shot-reach';
export const WEATHER_CANDIDATE = Object.freeze({
  kickWetLogOdds: .06, kickWindLogOdds: .05, kickGustLogOdds: .03,
  handWetLogOdds: .035, catchWetLogOdds: .08, catchWindLogOdds: .035, catchGustLogOdds: .02,
  shotWetLogOdds: .06, shotCrosswindLogOdds: .05, shotGustLogOdds: .03,
  tailwindRangePer35Kmh: .035, wetRangePenalty: .015, crosswindDriftMetresPerKmh: .025,
  wetMovementPenalty: .015, heatFatigue: .12, coldFatigue: .06,
  heatRecovery: .04, coldRecovery: .02, traitModeration: .5
});
export const THERMAL_MODERATION_CANDIDATES = Object.freeze({'original-050':.5,'reduced-035':.35});
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const exact = (value: object, keys: string[]) => Object.keys(value).every(k => keys.includes(k));
export function resolveWeather(value: WeatherSettings | undefined, playerIds: string[]): WeatherSettings | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || !exact(value,['version','enabled','conditions','traits','endPolicy','thermalCandidate']) ||
      value.version !== 'fixed-weather-v1' || !Array.isArray(value.enabled) ||
      !['fixed','alternate-quarters'].includes(value.endPolicy) ||
      new Set(value.enabled).size !== value.enabled.length || value.enabled.some(x => !['weather','temperature-tolerance'].includes(x)))
    throw new Error('Invalid fixed lab weather settings');
  const c = value.conditions;
  if (!c || typeof c !== 'object' || !exact(c,['temperatureC','relativeHumidity','windKmh','gustKmh','rainMmPerHour','windDirectionDegrees']) ||
      ![c.temperatureC,c.relativeHumidity,c.windKmh,c.gustKmh,c.rainMmPerHour,c.windDirectionDegrees].every(Number.isFinite) ||
      c.temperatureC < -5 || c.temperatureC > 40 || c.relativeHumidity < 0 || c.relativeHumidity > 100 ||
      c.windKmh < 0 || c.windKmh > 45 || c.gustKmh < c.windKmh || c.gustKmh > 65 ||
      c.rainMmPerHour < 0 || c.rainMmPerHour > 10 || c.windDirectionDegrees < 0 || c.windDirectionDegrees >= 360)
    throw new Error('Conditions outside the declared lab envelope; not a playable-weather safety standard');
  const thermal = value.enabled.includes('temperature-tolerance');
  if (value.thermalCandidate !== undefined && (!thermal || !['original-050','reduced-035'].includes(value.thermalCandidate)))
    throw new Error('Thermal candidate requires enabled temperature tolerance and a declared candidate');
  if (thermal && !value.enabled.includes('weather')) throw new Error('Temperature tolerance requires weather');
  if (thermal) {
    if (!value.traits || typeof value.traits !== 'object' || Array.isArray(value.traits) ||
        Object.keys(value.traits).length !== playerIds.length || playerIds.some(id => !Object.hasOwn(value.traits!,id)) ||
        Object.values(value.traits).some(t => !t || typeof t !== 'object' || !exact(t,['heat','cold']) ||
          ![t.heat,t.cold].every(x => Number.isFinite(x) && x >= 0 && x <= 1)))
      throw new Error('Thermal traits require exact player coverage with separate heat/cold values in [0,1]');
  } else if (value.traits !== undefined) throw new Error('Traits supplied without enabled temperature tolerance');
  return { version: value.version, enabled: [...value.enabled], endPolicy:value.endPolicy, conditions: {...c},
    ...(value.thermalCandidate !== undefined ? {thermalCandidate:value.thermalCandidate} : {}),
    ...(thermal ? {traits:Object.fromEntries(Object.entries(value.traits!).map(([id,t])=>[id,{...t}]))} : {}) };
}
export function weatherLoads(settings?: WeatherSettings) {
  if (!settings?.enabled.includes('weather')) return {wet:0,wind:0,gust:0,heat:0,cold:0};
  const c=settings.conditions;
  const wet=clamp(c.rainMmPerHour/5,0,1),wind=clamp(c.windKmh/35,0,1),gust=clamp((c.gustKmh-c.windKmh)/30,0,1);
  return {wet,wind,gust,heat:clamp((c.temperatureC-24)/12,0,1)*(.7+.3*c.relativeHumidity/100),
    cold:clamp((10-c.temperatureC)/15,0,1)*Math.min(1.4,1+.25*wet+.15*wind)};
}
export function thermalMultipliers(settings: WeatherSettings | undefined, playerId: string) {
  const load=weatherLoads(settings),t=settings?.traits?.[playerId]??{heat:.5,cold:.5};
  const moderation=settings?.thermalCandidate ? THERMAL_MODERATION_CANDIDATES[settings.thermalCandidate] : WEATHER_CANDIDATE.traitModeration;
  const h=1-moderation*(t.heat-.5),c=1-moderation*(t.cold-.5);
  return {fatigue:1+WEATHER_CANDIDATE.heatFatigue*load.heat*h+WEATHER_CANDIDATE.coldFatigue*load.cold*c,
    recovery:1-WEATHER_CANDIDATE.heatRecovery*load.heat*h-WEATHER_CANDIDATE.coldRecovery*load.cold*c};
}
/** Coordinates retain the legacy attack frame; the pinned lab end policy sets physical wind exposure. */
export function weatherWind(settings: WeatherSettings | undefined, side: 0|1, quarter: number) {
  if (!settings?.enabled.includes('weather')) return {tail:0,cross:0};
  const angle=settings.conditions.windDirectionDegrees*Math.PI/180,ends=settings.endPolicy==='fixed'||quarter%2?1:-1;
  return {tail:settings.conditions.windKmh*Math.cos(angle)*ends*(side===0?1:-1),
    cross:settings.conditions.windKmh*Math.sin(angle)*ends};
}
export function weatherRange(settings: WeatherSettings | undefined, side: 0|1, quarter: number) {
  const load=weatherLoads(settings),wind=weatherWind(settings,side,quarter);
  return clamp(1+WEATHER_CANDIDATE.tailwindRangePer35Kmh*wind.tail/35-WEATHER_CANDIDATE.wetRangePenalty*load.wet,.94,1.06);
}
export function weatherMovement(settings?: WeatherSettings) {return 1-WEATHER_CANDIDATE.wetMovementPenalty*weatherLoads(settings).wet;}
export function weatherProbability(probability: number, settings: WeatherSettings | undefined, side: 0|1, quarter: number, action: WeatherAction) {
  const w=weatherLoads(settings),c=WEATHER_CANDIDATE;
  let penalty=0;
  if(action==='kick')penalty=c.kickWetLogOdds*w.wet+c.kickWindLogOdds*w.wind+c.kickGustLogOdds*w.gust;
  if(action==='hand')penalty=c.handWetLogOdds*w.wet;
  if(action==='catch')penalty=c.catchWetLogOdds*w.wet+c.catchWindLogOdds*w.wind+c.catchGustLogOdds*w.gust;
  if(action==='shot-central')penalty=c.shotWetLogOdds*w.wet+c.shotCrosswindLogOdds*Math.min(1,Math.abs(weatherWind(settings,side,quarter).cross)/35)+c.shotGustLogOdds*w.gust;
  if(penalty===0 || probability===0 || probability===1)return probability;
  const odds=Math.exp(-penalty);return probability*odds/(1-probability+probability*odds);
}
