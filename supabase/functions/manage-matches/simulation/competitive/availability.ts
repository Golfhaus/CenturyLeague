import { createRandom } from '../random.ts';
import { validateMatchInput } from '../match/input.ts';
import type { MatchInput } from '../match/types.ts';

export const AVAILABILITY_VERSION = 'century-availability-v1-candidate';
export const COMPETITIVE_ENGINE_VERSION = '0.2.0-availability-candidate';
export interface RecoveryPolicy {
  id: string;
  bands: { weight: number; minimumDays: number; maximumDays: number }[];
}
/** A calibration candidate, not an approved production injury tariff. */
export const CANDIDATE_RECOVERY_POLICY: RecoveryPolicy = {
  id: 'recovery-calendar-v1-candidate',
  bands: [{ weight: 80, minimumDays: 1, maximumDays: 3 },
    { weight: 18, minimumDays: 4, maximumDays: 10 }, { weight: 2, minimumDays: 11, maximumDays: 28 }]
};
export interface InjuryAbsence { id: string; playerId: string; sourceResultId: string; startsOn: string; recoveredOn: string }
export interface Suspension { id: string; playerId: string; sourceResultId: string; matches: number; servedBy: string[] }
export interface AvailabilitySnapshot {
  version: typeof AVAILABILITY_VERSION; category: 'men' | 'women'; matchDate: string;
  replacesResultId?: string;
  players: { playerId: string; eligible: boolean; injuryIds: string[]; suspensionIds: string[] }[];
}
export interface CompetitiveMatchInput extends MatchInput { availability: AvailabilitySnapshot }

export function calendarDate(value: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value+'T00:00:00Z')) ||
      new Date(value+'T00:00:00Z').toISOString().slice(0,10) !== value) throw new Error('Valid calendar date required');
  return value;
}
export function addCalendarDays(date: string, days: number): string {
  calendarDate(date);
  if (!Number.isSafeInteger(days) || days < 0 || days > 3660) throw new Error('Invalid calendar recovery duration');
  const d = new Date(date+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10);
}
export function validateRecoveryPolicy(policy: RecoveryPolicy): void {
  if (!policy.id?.trim() || !Array.isArray(policy.bands) || !policy.bands.length || policy.bands.length > 20 ||
      policy.bands.some(b => !Number.isSafeInteger(b.weight) || b.weight <= 0 || !Number.isSafeInteger(b.minimumDays) ||
        !Number.isSafeInteger(b.maximumDays) || b.minimumDays < 1 || b.maximumDays < b.minimumDays || b.maximumDays > 3660) ||
      policy.bands.reduce((s,b)=>s+b.weight,0) > 1000000) throw new Error('Invalid pinned recovery policy');
}
export function recoveryDays(policy: RecoveryPolicy, matchSeed: string, eventId: number, playerId: string): number {
  validateRecoveryPolicy(policy);
  if (!matchSeed || !playerId || !Number.isSafeInteger(eventId) || eventId < 1) throw new Error('Injury source evidence required');
  // Separate domain; persistence never consumes the gameplay random stream.
  const rng = createRandom(JSON.stringify(['injury-recovery',policy.id,matchSeed,eventId,playerId]));
  let n = rng.next()*policy.bands.reduce((s,b)=>s+b.weight,0);
  for (const band of policy.bands) {
    n -= band.weight;
    if (n < 0) return band.minimumDays+Math.floor(rng.next()*(band.maximumDays-band.minimumDays+1));
  }
  throw new Error('Recovery policy selection failed');
}
export function pinAvailability(input: MatchInput, category: 'men' | 'women', matchDate: string,
  injuries: InjuryAbsence[], suspensions: Suspension[]): AvailabilitySnapshot {
  validateMatchInput(input); calendarDate(matchDate);
  if (!['men','women'].includes(category)) throw new Error('Invalid availability category');
  return { version: AVAILABILITY_VERSION, category, matchDate, players: input.teams.flatMap(t=>t.players.map(p=>{
    const injuryIds = injuries.filter(i=>i.playerId===p.id && i.startsOn<=matchDate && i.recoveredOn>matchDate).map(i=>i.id).sort();
    const suspensionIds = suspensions.filter(s=>s.playerId===p.id && s.servedBy.length<s.matches).map(s=>s.id).sort();
    return {playerId:p.id,eligible:!injuryIds.length&&!suspensionIds.length,injuryIds,suspensionIds};
  })) };
}
export function validateCompetitiveInput(input: CompetitiveMatchInput): void {
  validateMatchInput(input);
  const a=input.availability;
  if (!a || a.version!==AVAILABILITY_VERSION || !['men','women'].includes(a.category)) throw new Error('Pinned availability required');
  calendarDate(a.matchDate);
  const roster=new Set(input.teams.flatMap(t=>t.players.map(p=>p.id)));
  if (!Array.isArray(a.players) || a.players.length!==70 || new Set(a.players.map(p=>p.playerId)).size!==70 ||
      a.players.some(p=>!roster.has(p.playerId) || typeof p.eligible!=='boolean' || !Array.isArray(p.injuryIds) || !Array.isArray(p.suspensionIds) ||
        [...p.injuryIds,...p.suspensionIds].some(id=>typeof id!=='string'||!id) ||
        p.eligible!==(p.injuryIds.length===0&&p.suspensionIds.length===0))) throw new Error('Availability differs from full roster/evidence');
  for (const team of input.teams) if (team.players.filter(p=>a.players.find(x=>x.playerId===p.id)!.eligible).length<15)
    throw new Error('Fewer than 15 eligible players; commissioner disposition required, no invented forfeit');
}
