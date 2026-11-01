import { ATTRIBUTE_KEYS } from '../types.js';
import type { Ratings, AttributeKey } from '../types.js';
import { TACTIC_KEYS } from './types.js';
import type { MatchTeam, MatchInput, MatchConfig } from './types.js';

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  fieldLength: 150, fieldWidth: 95, onField: 15, minimumPlayers: 12,
  standardPenaltySeconds: 120, seriousPenaltySeconds: 300,
  intervalSeconds: [600, 1200, 600], maxEvents: 40000, maxPlayingSeconds: 18000,
  fatiguePerSecond: 0.0009, benchRecoveryPerSecond: 0.0012,
  injuryChancePerContest: 0.0008, substitutionReviewSeconds: 35
};
const snake = (key: string) => key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
const column = (key: AttributeKey) => key === 'kickingOnRun' ? 'kicking_on_run' : snake(key);

/** Import canonical public ratings only. Hidden development variables are intentionally excluded. */
export function importDraftedTeams(
  population: Record<string, unknown>[],
  picks: { id: string; team: string }[],
  coaches: { name: string; team: string; tactical_sliders: unknown }[]
): MatchTeam[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const record of population) {
    const id = String(record.id);
    if (!record.id || byId.has(id)) throw new Error(`Duplicate/missing population ID: ${id}`);
    byId.set(id, record);
  }
  const drafted = new Set<string>();
  const teams = new Map<string, MatchTeam>();
  for (const pick of picks) {
    if (drafted.has(pick.id)) throw new Error(`Player drafted twice: ${pick.id}`);
    drafted.add(pick.id);
    const p = byId.get(pick.id);
    if (!p) throw new Error(`Draft player absent from canonical snapshot: ${pick.id}`);
    let team = teams.get(pick.team);
    if (!team) {
      const coach = coaches.filter(c => c.team === pick.team);
      if (coach.length !== 1) throw new Error(`Expected one coach for ${pick.team}`);
      team = { id: pick.team, name: pick.team, coach: { name: coach[0].name,
        tactics: { ...coach[0].tactical_sliders as MatchTeam['coach']['tactics'] } }, players: [] };
      teams.set(pick.team, team);
    }
    const ratings = Object.fromEntries(ATTRIBUTE_KEYS.map(k => [k, Number(p[column(k)])])) as Ratings;
    team.players.push({ id: pick.id, name: `${p.first_name} ${p.last_name}`, ratings });
  }
  const result = [...teams.values()];
  if (result.length !== 18 || drafted.size !== 630 || result.some(t => t.players.length !== 35)) {
    throw new Error('Expected complete founding draft: 18 teams × 35 unique players');
  }
  for (let i = 1; i < result.length; i++) {
    validateMatchInput({ id: 'import-validation', seed: 'validate', teams: [result[0], result[i]] });
  }
  return result;
}

export function validateMatchInput(input: MatchInput): MatchConfig {
  if (!input.id || !input.seed || input.teams.length !== 2 || input.teams[0].id === input.teams[1].id) {
    throw new Error('Match requires ID, seed, and two distinct teams');
  }
  const config = { ...DEFAULT_MATCH_CONFIG, ...input.config };
  for (const [key, value] of Object.entries(config)) {
    if (key === 'intervalSeconds') continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`Invalid config: ${key}`);
  }
  if (config.fieldLength < 60 || config.fieldWidth < 30 || config.onField !== 15 ||
      !Number.isInteger(config.minimumPlayers) || config.minimumPlayers < 1 || config.minimumPlayers > 15 ||
      config.standardPenaltySeconds <= 0 || config.seriousPenaltySeconds <= 0 ||
      config.maxEvents < 100 || config.maxPlayingSeconds <= 0 || config.substitutionReviewSeconds <= 0 ||
      config.injuryChancePerContest > 1 || config.intervalSeconds.length !== 3 ||
      config.intervalSeconds.some(s => !Number.isFinite(s) || s < 0)) throw new Error('Invalid match settings');
  const ids = new Set<string>();
  for (const team of input.teams) {
    if (team.players.length !== 35) throw new Error(`${team.name}: expected 35 eligible players`);
    for (const key of TACTIC_KEYS) {
      const v = team.coach.tactics[key];
      if (!Number.isFinite(v) || v < 1 || v > 5) throw new Error(`Invalid coach tendency: ${key}`);
    }
    for (const p of team.players) {
      if (!p.id || !p.name || ids.has(p.id)) throw new Error(`Missing/duplicate player: ${p.id}`);
      ids.add(p.id);
      for (const key of ATTRIBUTE_KEYS) {
        if (!Number.isFinite(p.ratings[key]) || p.ratings[key] < 1 || p.ratings[key] > 20) {
          throw new Error(`${p.id}: invalid rating ${key}`);
        }
      }
    }
  }
  return config;
}
