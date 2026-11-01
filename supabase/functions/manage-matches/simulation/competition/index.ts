import { simulateMatch, MATCH_ENGINE_VERSION } from '../match/engine.ts';
import { validateMatchInput } from '../match/input.ts';
import type { MatchInput, MatchResult } from '../match/types.ts';
import type { CompetitionDefinition, CompetitionFixture, CompetitionState, CompetitionTableRow, StandingsPolicy } from './types.ts';
export * from './types.ts';
export const COMPETITION_ENGINE_SOURCE_SHA256 = '9513ba17bef8814027cc3408731f7d26db9c8ce8cd5a25f52c42175286db3521';

/** Stable JSON is an integrity/comparison format, not a signature or authorization mechanism. */
export function competitionJSON(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(normalize);
    return Object.fromEntries(Object.keys(v).sort().map(k => [k, normalize((v as Record<string, unknown>)[k])]));
  };
  // Normalize omitted optional properties exactly as persisted JSON does.
  return JSON.stringify(normalize(JSON.parse(JSON.stringify(value))));
}
function requireText(value: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
}
function validatePolicy(policy: StandingsPolicy): void {
  for (const value of [policy.winPoints, policy.lossPoints])
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Standings points must be nonnegative integers');
  const allowed = ['tablePoints', 'wins', 'winPercentage', 'pointDifference', 'pointsFor'];
  if (!Array.isArray(policy.criteria) || !policy.criteria.length || new Set(policy.criteria).size !== policy.criteria.length ||
      policy.criteria.some(c => !allowed.includes(c))) throw new Error('Invalid explicit standings criteria');
}
export function validateCompetitionDefinition(d: CompetitionDefinition): void {
  requireText(d.id, 'Competition ID'); requireText(d.name, 'Competition name');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(d.seasonKey)) throw new Error('Use a monthly YYYY-MM season key');
  if (!['men', 'women'].includes(d.category) || !['exhibition', 'competitive'].includes(d.classification)) throw new Error('Invalid competition scope');
  if (d.engineVersion !== MATCH_ENGINE_VERSION || d.engineSourceSHA256 !== COMPETITION_ENGINE_SOURCE_SHA256) throw new Error('Unsupported engine identity/fingerprint');
  if (!Array.isArray(d.teams) || d.teams.length < 2 || !Array.isArray(d.fixtures) || !d.fixtures.length) throw new Error('Teams and fixtures required');
  const teamIds = new Set<string>(), playerIds = new Set<string>();
  for (const team of d.teams) {
    requireText(team.id, 'Team ID'); requireText(team.name, 'Team name');
    if (teamIds.has(team.id)) throw new Error('Duplicate competition team'); teamIds.add(team.id);
    for (const p of team.players) { if (playerIds.has(p.id)) throw new Error('Player appears on multiple competition rosters'); playerIds.add(p.id); }
  }
  for (let i = 1; i < d.teams.length; i++) validateMatchInput({ id: 'competition-validation', seed: 'validation', teams: [d.teams[0], d.teams[i]], config: d.config });
  const fixtureIds = new Set<string>(), roundTeams = new Set<string>();
  for (const f of d.fixtures) {
    requireText(f.id, 'Fixture ID'); requireText(f.roundId, 'Round ID'); requireText(f.seed, 'Fixture seed');
    if (fixtureIds.has(f.id)) throw new Error('Duplicate fixture ID'); fixtureIds.add(f.id);
    if (!Array.isArray(f.teamIds) || f.teamIds.length !== 2 || f.teamIds[0] === f.teamIds[1] || f.teamIds.some(id => !teamIds.has(id))) throw new Error('Invalid fixture teams');
    for (const id of f.teamIds) {
      const key = JSON.stringify([f.roundId, id]);
      if (roundTeams.has(key)) throw new Error('Team appears twice in one round'); roundTeams.add(key);
    }
  }
  if (d.standingsPolicy) validatePolicy(d.standingsPolicy);
}
function fixtureFor(d: CompetitionDefinition, id: string): CompetitionFixture {
  const fixture = d.fixtures.find(f => f.id === id);
  if (!fixture) throw new Error('Unknown competition fixture');
  return fixture;
}
function inputFor(d: CompetitionDefinition, f: CompetitionFixture): MatchInput {
  return { id: f.id, seed: f.seed, teams: f.teamIds.map(id => d.teams.find(t => t.id === id)!) as MatchInput['teams'],
    config: d.config, provenance: { competitionId: d.id, seasonKey: d.seasonKey, competitionCategory: d.category,
      classification: d.classification, engineSourceSHA256: d.engineSourceSHA256 } };
}
export function validateCompetitionFixtureResult(d: CompetitionDefinition, result: MatchResult, replay = true): void {
  const fixture = fixtureFor(d, result.id), expected = inputFor(d, fixture);
  if (result.engineVersion !== d.engineVersion || result.seed !== fixture.seed || result.input.id !== fixture.id || result.input.seed !== fixture.seed ||
      competitionJSON(result.input.teams) !== competitionJSON(expected.teams)) throw new Error('Result does not match the frozen fixture/rosters');
  const config = validateMatchInput(expected);
  if (competitionJSON(config) !== competitionJSON(result.config) || competitionJSON(validateMatchInput(result.input)) !== competitionJSON(config)) throw new Error('Match rules differ from competition');
  if (d.classification === 'competitive') for (const [key, value] of Object.entries(expected.provenance!))
    if (result.input.provenance?.[key] !== value) throw new Error('Competitive result lacks the correct competition/season scope');
  if (result.input.provenance?.engineSourceSHA256 !== d.engineSourceSHA256) throw new Error('Result gameplay fingerprint differs');
  if (result.status !== 'complete' || ![0, 1].includes(result.winner) || result.scores.length !== 2 ||
      result.scores.some(s => !Number.isInteger(s) || s < 0 || s > 100) || result.scores[result.winner] !== 100 || result.scores[1-result.winner] >= 100) throw new Error('Illegal final score');
  if (result.quarters.length !== 4 || result.quarters.some((q, i) => q.quarter !== i+1)) throw new Error('Four ordered quarters required');
  const winning = result.events.filter(e => e.type === 'score' && e.data?.winning);
  if (winning.length !== 1 || winning[0].side !== result.winner || winning[0].data?.kind !== 'central_air' ||
      result.events.filter(e => e.type === 'score').at(-1)?.id !== winning[0].id) throw new Error('Qualifying final winning kick required');
  for (const side of [0, 1] as const) {
    const players = result.players.filter(p => p.side === side), roster = new Set(expected.teams[side].players.map(p => p.id));
    if (players.length !== 35 || new Set(players.map(p => p.id)).size !== 35 || players.some(p => !roster.has(p.id))) throw new Error('Player box scores differ from roster');
    if (players.reduce((s, p) => s+(p.stats.points ?? 0), 0) !== result.scores[side] || result.teamStats[side].points !== result.scores[side] ||
        result.quarters.reduce((s, q) => s+q.points[side], 0) !== result.scores[side]) throw new Error('Score reconciliation failed');
    const keys = new Set(players.flatMap(p => Object.keys(p.stats)));
    for (const key of keys) {
      if (players.some(p => p.stats[key] !== undefined && (!Number.isFinite(p.stats[key]) || p.stats[key] < 0)) ||
          players.reduce((s, p) => s+(p.stats[key] ?? 0), 0) !== (result.teamStats[side][key] ?? 0)) throw new Error('Player/team statistics mismatch');
    }
    if (players.some(p => !Number.isFinite(p.secondsPlayed) || p.secondsPlayed < 0 || p.secondsPlayed > result.playingSeconds+1e-6) ||
        Math.abs(players.reduce((s, p) => s+p.secondsPlayed, 0)-result.teamStats[side].playerSeconds) > 1e-6) throw new Error('Playing time mismatch');
  }
  if (replay && competitionJSON(simulateMatch(result.input)) !== competitionJSON(result)) throw new Error('Result fails full event/statistic replay');
}
export function validateCompetitionState(state: CompetitionState, replay = false): void {
  if (state.schemaVersion !== '0.2.0' || !['draft', 'active', 'complete'].includes(state.status) || !Number.isSafeInteger(state.revision) || state.revision < 0) throw new Error('Invalid competition state');
  if (state.definitionSnapshot !== competitionJSON(state.definition)) throw new Error('Competition definition changed after creation');
  validateCompetitionDefinition(state.definition);
  const ids = new Set<string>();
  for (const accepted of state.accepted) {
    if (accepted.fixtureId !== accepted.result.id || ids.has(accepted.fixtureId)) throw new Error('Duplicate/incorrect result registration'); ids.add(accepted.fixtureId);
    requireText(accepted.acceptedBy, 'Result acceptor');
    if (!Number.isFinite(Date.parse(accepted.acceptedAt))) throw new Error('Invalid acceptance time');
    validateCompetitionFixtureResult(state.definition, accepted.result, replay);
  }
  if ((state.status === 'draft' && (state.accepted.length || state.revision !== 0)) ||
      (state.status !== 'draft' && state.revision !== 1+state.accepted.length) ||
      (state.status === 'complete') !== (state.accepted.length === state.definition.fixtures.length)) throw new Error('Competition status/revision mismatch');
}
export function createCompetition(definition: CompetitionDefinition): CompetitionState {
  validateCompetitionDefinition(definition);
  return { schemaVersion: '0.2.0', definition: JSON.parse(competitionJSON(definition)), definitionSnapshot: competitionJSON(definition), status: 'draft', revision: 0, accepted: [] };
}
export function activateCompetition(state: CompetitionState, expectedRevision: number): CompetitionState {
  validateCompetitionState(state);
  if (state.revision !== expectedRevision) throw new Error('Stale competition revision');
  if (state.status !== 'draft') throw new Error('Competition is already activated');
  return { ...state, status: 'active', revision: 1 };
}
export function simulateCompetitionFixture(state: CompetitionState, fixtureId: string): MatchResult {
  validateCompetitionState(state);
  if (state.status !== 'active' || state.accepted.some(r => r.fixtureId === fixtureId)) throw new Error('Fixture is not available for simulation');
  return simulateMatch(inputFor(state.definition, fixtureFor(state.definition, fixtureId)));
}
export function acceptCompetitionResult(state: CompetitionState, result: MatchResult,
  metadata: { expectedRevision: number; acceptedBy: string; acceptedAt: string }): { state: CompetitionState; added: boolean } {
  validateCompetitionState(state);
  const prior = state.accepted.find(r => r.fixtureId === result.id);
  if (prior) {
    if (competitionJSON(prior.result) !== competitionJSON(result)) throw new Error('Conflicting result for an accepted fixture');
    return { state, added: false }; // Exact retry succeeds even if its pre-commit revision is stale.
  }
  if (state.status !== 'active') throw new Error('Competition is not active');
  if (state.revision !== metadata.expectedRevision) throw new Error('Stale competition revision');
  requireText(metadata.acceptedBy, 'Result acceptor');
  if (!Number.isFinite(Date.parse(metadata.acceptedAt))) throw new Error('Invalid acceptance time');
  validateCompetitionFixtureResult(state.definition, result, true);
  const accepted = [...state.accepted, { fixtureId: result.id, acceptedBy: metadata.acceptedBy,
    acceptedAt: new Date(metadata.acceptedAt).toISOString(), result: JSON.parse(competitionJSON(result)) }];
  return { state: { ...state, accepted, revision: state.revision+1,
    status: accepted.length === state.definition.fixtures.length ? 'complete' : 'active' }, added: true };
}
export function competitionStandings(state: CompetitionState): { classification: CompetitionDefinition['classification']; ranked: boolean; rows: CompetitionTableRow[] } {
  validateCompetitionState(state);
  const policy = state.definition.standingsPolicy;
  const rows: CompetitionTableRow[] = state.definition.teams.map(t => ({ teamId: t.id, name: t.name, played: 0, wins: 0, losses: 0,
    pointsFor: 0, pointsAgainst: 0, pointDifference: 0, winPercentage: 0, tablePoints: policy ? 0 : null, rank: null }));
  for (const { result } of state.accepted) for (const side of [0, 1] as const) {
    const row = rows.find(r => r.teamId === result.input.teams[side].id)!;
    row.played++; if (side === result.winner) row.wins++; else row.losses++;
    row.pointsFor += result.scores[side]; row.pointsAgainst += result.scores[1-side];
  }
  for (const row of rows) {
    row.pointDifference = row.pointsFor-row.pointsAgainst; row.winPercentage = row.played ? row.wins/row.played : 0;
    if (policy) row.tablePoints = row.wins*policy.winPoints+row.losses*policy.lossPoints;
  }
  if (policy) {
    const compare = (a: CompetitionTableRow, b: CompetitionTableRow) => {
      for (const criterion of policy.criteria) { const d = Number(b[criterion])-Number(a[criterion]); if (d) return d; }
      return 0;
    };
    rows.sort((a, b) => compare(a, b) || a.name.localeCompare(b.name) || a.teamId.localeCompare(b.teamId));
    rows.forEach((row, i) => { row.rank = i && compare(rows[i-1], row) === 0 ? rows[i-1].rank : i+1; });
  }
  return { classification: state.definition.classification, ranked: Boolean(policy), rows };
}
