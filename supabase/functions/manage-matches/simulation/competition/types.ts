import type { MatchConfig, MatchResult, MatchTeam } from '../match/types.ts';
import type { CompetitionCategory } from '../types.ts';

export interface CompetitionFixture {
  id: string;
  roundId: string;
  seed: string;
  teamIds: [string, string];
}
export type StandingsCriterion = 'tablePoints' | 'wins' | 'winPercentage' | 'pointDifference' | 'pointsFor';
export interface StandingsPolicy {
  winPoints: number;
  lossPoints: number;
  criteria: StandingsCriterion[];
}
export interface CompetitionDefinition {
  id: string;
  name: string;
  seasonKey: string;
  category: CompetitionCategory;
  classification: 'exhibition' | 'competitive';
  engineVersion: string;
  engineSourceSHA256: string;
  teams: MatchTeam[];
  fixtures: CompetitionFixture[];
  config?: Partial<MatchConfig>;
  standingsPolicy?: StandingsPolicy;
}
export interface AcceptedCompetitionResult {
  fixtureId: string;
  acceptedBy: string;
  acceptedAt: string;
  result: MatchResult;
}
export interface CompetitionState {
  schemaVersion: '0.2.0';
  definition: CompetitionDefinition;
  definitionSnapshot: string;
  status: 'draft' | 'active' | 'complete';
  revision: number;
  accepted: AcceptedCompetitionResult[];
}
export interface CompetitionTableRow {
  teamId: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;
  winPercentage: number;
  tablePoints: number | null;
  rank: number | null;
}
