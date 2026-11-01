export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      coaches: {
        Row: {
          created_at: string
          id: string
          name: string
          profile: Json
          source_coach_id: string
          tactical_sliders: Json
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          profile: Json
          source_coach_id: string
          tactical_sliders: Json
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          profile?: Json
          source_coach_id?: string
          tactical_sliders?: Json
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_audit: {
        Row: {
          action: string
          actor_id: string
          competition_id: string
          created_at: string
          detail: Json
          id: string
        }
        Insert: {
          action: string
          actor_id: string
          competition_id: string
          created_at?: string
          detail?: Json
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          competition_id?: string
          created_at?: string
          detail?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "competition_audit_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_fixtures: {
        Row: {
          competition_id: string
          id: string
          match_input: Json
          ordinal: number
          round_id: string
        }
        Insert: {
          competition_id: string
          id: string
          match_input: Json
          ordinal: number
          round_id: string
        }
        Update: {
          competition_id?: string
          id?: string
          match_input?: Json
          ordinal?: number
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_fixtures_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_rosters: {
        Row: {
          competition_id: string
          season_roster_id: string
          team_id: string
        }
        Insert: {
          competition_id: string
          season_roster_id: string
          team_id: string
        }
        Update: {
          competition_id?: string
          season_roster_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_rosters_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_rosters_season_roster_id_fkey"
            columns: ["season_roster_id"]
            isOneToOne: false
            referencedRelation: "team_season_rosters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_rosters_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          classification: string
          competition_category: string
          created_at: string
          created_by: string
          definition: Json
          definition_sha256: string
          id: string
          name: string
          revision: number
          season_id: string
          status: string
        }
        Insert: {
          classification: string
          competition_category: string
          created_at?: string
          created_by: string
          definition: Json
          definition_sha256: string
          id: string
          name: string
          revision?: number
          season_id: string
          status?: string
        }
        Update: {
          classification?: string
          competition_category?: string
          created_at?: string
          created_by?: string
          definition?: Json
          definition_sha256?: string
          id?: string
          name?: string
          revision?: number
          season_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "competitions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      development_runs: {
        Row: {
          competition_category: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          from_season_id: string
          id: string
          model_version: string
          seed: string
          status: string
          summary: Json | null
          to_season_id: string
        }
        Insert: {
          competition_category: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          from_season_id: string
          id?: string
          model_version: string
          seed: string
          status?: string
          summary?: Json | null
          to_season_id: string
        }
        Update: {
          competition_category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          from_season_id?: string
          id?: string
          model_version?: string
          seed?: string
          status?: string
          summary?: Json | null
          to_season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_runs_from_season_id_fkey"
            columns: ["from_season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_runs_to_season_id_fkey"
            columns: ["to_season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_windows: {
        Row: {
          available_season_id: string | null
          class_label: string
          closed_at: string | null
          competition_category: string
          created_at: string
          generated_count: number
          id: string
          opened_at: string | null
          status: string
          target_active_population: number | null
          target_free_agent_population: number | null
          trigger_season_id: string
          window_name: string
        }
        Insert: {
          available_season_id?: string | null
          class_label: string
          closed_at?: string | null
          competition_category: string
          created_at?: string
          generated_count?: number
          id?: string
          opened_at?: string | null
          status?: string
          target_active_population?: number | null
          target_free_agent_population?: number | null
          trigger_season_id: string
          window_name: string
        }
        Update: {
          available_season_id?: string | null
          class_label?: string
          closed_at?: string | null
          competition_category?: string
          created_at?: string
          generated_count?: number
          id?: string
          opened_at?: string | null
          status?: string
          target_active_population?: number | null
          target_free_agent_population?: number | null
          trigger_season_id?: string
          window_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_windows_available_season_id_fkey"
            columns: ["available_season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_windows_trigger_season_id_fkey"
            columns: ["trigger_season_id"]
            isOneToOne: true
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_batches: {
        Row: {
          committed: boolean
          competition_category: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          generated_count: number
          generator_version_id: string
          id: string
          mode: string
          requested_count: number
          seed: string
          summary: Json | null
        }
        Insert: {
          committed?: boolean
          competition_category: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          generated_count?: number
          generator_version_id: string
          id?: string
          mode: string
          requested_count: number
          seed: string
          summary?: Json | null
        }
        Update: {
          committed?: boolean
          competition_category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          generated_count?: number
          generator_version_id?: string
          id?: string
          mode?: string
          requested_count?: number
          seed?: string
          summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_batches_generator_version_id_fkey"
            columns: ["generator_version_id"]
            isOneToOne: false
            referencedRelation: "generator_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      generator_versions: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          model_version: string
          notes: string | null
          version_name: string
        }
        Insert: {
          config: Json
          created_at?: string
          created_by?: string | null
          id?: string
          model_version: string
          notes?: string | null
          version_name: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          model_version?: string
          notes?: string | null
          version_name?: string
        }
        Relationships: []
      }
      league_state: {
        Row: {
          active_development_model_version: string
          active_generator_version_id: string | null
          competition_category: string
          current_season_id: string | null
          id: number
          league_status: string
          updated_at: string
        }
        Insert: {
          active_development_model_version?: string
          active_generator_version_id?: string | null
          competition_category: string
          current_season_id?: string | null
          id?: number
          league_status?: string
          updated_at?: string
        }
        Update: {
          active_development_model_version?: string
          active_generator_version_id?: string | null
          competition_category?: string
          current_season_id?: string | null
          id?: number
          league_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_state_active_generator_version_id_fkey"
            columns: ["active_generator_version_id"]
            isOneToOne: false
            referencedRelation: "generator_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_state_current_season_id_fkey"
            columns: ["current_season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      match_proposals: {
        Row: {
          created_at: string
          fixture_id: string
          generated_by: string
          id: string
          result: Json
          result_sha256: string
        }
        Insert: {
          created_at?: string
          fixture_id: string
          generated_by: string
          id?: string
          result: Json
          result_sha256: string
        }
        Update: {
          created_at?: string
          fixture_id?: string
          generated_by?: string
          id?: string
          result?: Json
          result_sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_proposals_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "competition_fixture_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_proposals_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "competition_fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_proposals_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      match_results: {
        Row: {
          accepted_at: string
          accepted_by: string
          fixture_id: string
          proposal_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_by: string
          fixture_id: string
          proposal_id: string
        }
        Update: {
          accepted_at?: string
          accepted_by?: string
          fixture_id?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_results_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "match_results_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "competition_fixture_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "competition_fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "competition_fixture_status"
            referencedColumns: ["proposal_id"]
          },
          {
            foreignKeyName: "match_results_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "match_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      player_pool_exits: {
        Row: {
          created_at: string
          entry_window_id: string | null
          exit_age_years: number
          id: string
          player_id: string
          reason: string
          season_id: string
        }
        Insert: {
          created_at?: string
          entry_window_id?: string | null
          exit_age_years: number
          id?: string
          player_id: string
          reason?: string
          season_id: string
        }
        Update: {
          created_at?: string
          entry_window_id?: string | null
          exit_age_years?: number
          id?: string
          player_id?: string
          reason?: string
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_pool_exits_entry_window_id_fkey"
            columns: ["entry_window_id"]
            isOneToOne: false
            referencedRelation: "entry_windows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_pool_exits_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "player_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_pool_exits_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_pool_exits_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      player_ratings_current: {
        Row: {
          acceleration: number
          aerial_marking: number
          agility: number
          anticipation: number
          attacking_rating: number
          awareness: number
          ball_carrying: number
          best_role: string
          central_rating: number
          composure: number
          contested_possession: number
          decision_making: number
          defensive_rating: number
          defensive_spoiling: number
          discipline: number
          durability: number
          evasion: number
          ground_ball_skill: number
          hand_passing: number
          kicking_accuracy: number
          kicking_on_run: number
          kicking_power: number
          opposite_side_skill: number
          overall_rating: number
          player_id: string
          recovery: number
          speed: number
          stamina: number
          strength: number
          tackling: number
          updated_at: string
          vertical_leap: number
        }
        Insert: {
          acceleration: number
          aerial_marking: number
          agility: number
          anticipation: number
          attacking_rating: number
          awareness: number
          ball_carrying: number
          best_role: string
          central_rating: number
          composure: number
          contested_possession: number
          decision_making: number
          defensive_rating: number
          defensive_spoiling: number
          discipline: number
          durability: number
          evasion: number
          ground_ball_skill: number
          hand_passing: number
          kicking_accuracy: number
          kicking_on_run: number
          kicking_power: number
          opposite_side_skill: number
          overall_rating: number
          player_id: string
          recovery: number
          speed: number
          stamina: number
          strength: number
          tackling: number
          updated_at?: string
          vertical_leap: number
        }
        Update: {
          acceleration?: number
          aerial_marking?: number
          agility?: number
          anticipation?: number
          attacking_rating?: number
          awareness?: number
          ball_carrying?: number
          best_role?: string
          central_rating?: number
          composure?: number
          contested_possession?: number
          decision_making?: number
          defensive_rating?: number
          defensive_spoiling?: number
          discipline?: number
          durability?: number
          evasion?: number
          ground_ball_skill?: number
          hand_passing?: number
          kicking_accuracy?: number
          kicking_on_run?: number
          kicking_power?: number
          opposite_side_skill?: number
          overall_rating?: number
          player_id?: string
          recovery?: number
          speed?: number
          stamina?: number
          strength?: number
          tackling?: number
          updated_at?: string
          vertical_leap?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_ratings_current_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "player_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_ratings_current_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_representative_eligibility: {
        Row: {
          active: boolean
          created_at: string
          eligibility_code: string
          eligibility_name: string
          eligibility_type: string
          id: string
          player_id: string
          source: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          eligibility_code: string
          eligibility_name: string
          eligibility_type: string
          id?: string
          player_id: string
          source?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          eligibility_code?: string
          eligibility_name?: string
          eligibility_type?: string
          id?: string
          player_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_representative_eligibility_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_representative_eligibility_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_season_snapshots: {
        Row: {
          acceleration: number
          aerial_marking: number
          age_years: number
          agility: number
          anticipation: number
          attacking_rating: number
          awareness: number
          ball_carrying: number
          best_role: string
          central_rating: number
          composure: number
          contested_possession: number
          created_at: string
          decision_making: number
          defensive_rating: number
          defensive_spoiling: number
          discipline: number
          durability: number
          evasion: number
          ground_ball_skill: number
          hand_passing: number
          id: string
          kicking_accuracy: number
          kicking_on_run: number
          kicking_power: number
          model_version: string
          opposite_side_skill: number
          overall_rating: number
          player_id: string
          recovery: number
          season_id: string
          speed: number
          stamina: number
          status: string
          strength: number
          tackling: number
          team_id: string | null
          vertical_leap: number
        }
        Insert: {
          acceleration: number
          aerial_marking: number
          age_years: number
          agility: number
          anticipation: number
          attacking_rating: number
          awareness: number
          ball_carrying: number
          best_role: string
          central_rating: number
          composure: number
          contested_possession: number
          created_at?: string
          decision_making: number
          defensive_rating: number
          defensive_spoiling: number
          discipline: number
          durability: number
          evasion: number
          ground_ball_skill: number
          hand_passing: number
          id?: string
          kicking_accuracy: number
          kicking_on_run: number
          kicking_power: number
          model_version: string
          opposite_side_skill: number
          overall_rating: number
          player_id: string
          recovery: number
          season_id: string
          speed: number
          stamina: number
          status: string
          strength: number
          tackling: number
          team_id?: string | null
          vertical_leap: number
        }
        Update: {
          acceleration?: number
          aerial_marking?: number
          age_years?: number
          agility?: number
          anticipation?: number
          attacking_rating?: number
          awareness?: number
          ball_carrying?: number
          best_role?: string
          central_rating?: number
          composure?: number
          contested_possession?: number
          created_at?: string
          decision_making?: number
          defensive_rating?: number
          defensive_spoiling?: number
          discipline?: number
          durability?: number
          evasion?: number
          ground_ball_skill?: number
          hand_passing?: number
          id?: string
          kicking_accuracy?: number
          kicking_on_run?: number
          kicking_power?: number
          model_version?: string
          opposite_side_skill?: number
          overall_rating?: number
          player_id?: string
          recovery?: number
          season_id?: string
          speed?: number
          stamina?: number
          status?: string
          strength?: number
          tackling?: number
          team_id?: string | null
          vertical_leap?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_season_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_season_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_team_history: {
        Row: {
          effective_at: string
          ended_at: string | null
          id: string
          notes: string | null
          player_id: string
          season_id: string | null
          team_id: string | null
          transaction_type: string
        }
        Insert: {
          effective_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          player_id: string
          season_id?: string | null
          team_id?: string | null
          transaction_type?: string
        }
        Update: {
          effective_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          player_id?: string
          season_id?: string | null
          team_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_team_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_team_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_team_history_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_team_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          birthplace_city: string | null
          birthplace_country_code: string
          birthplace_country_name: string
          birthplace_region_code: string | null
          birthplace_region_name: string | null
          competition_category: string
          created_at: string
          current_team_id: string | null
          date_of_birth: string
          entry_class_label: string | null
          entry_type: string
          first_eligible_season_id: string | null
          first_name: string
          generation_batch_id: string
          generator_version_id: string
          height_cm: number
          id: string
          last_name: string
          nationality_code: string | null
          nationality_name: string | null
          pool_exited_at: string | null
          preferred_side: string
          primary_archetype: string
          retired_at: string | null
          secondary_archetype: string | null
          status: string
          weight_kg: number
        }
        Insert: {
          birthplace_city?: string | null
          birthplace_country_code: string
          birthplace_country_name: string
          birthplace_region_code?: string | null
          birthplace_region_name?: string | null
          competition_category: string
          created_at?: string
          current_team_id?: string | null
          date_of_birth: string
          entry_class_label?: string | null
          entry_type?: string
          first_eligible_season_id?: string | null
          first_name: string
          generation_batch_id: string
          generator_version_id: string
          height_cm: number
          id?: string
          last_name: string
          nationality_code?: string | null
          nationality_name?: string | null
          pool_exited_at?: string | null
          preferred_side?: string
          primary_archetype: string
          retired_at?: string | null
          secondary_archetype?: string | null
          status?: string
          weight_kg: number
        }
        Update: {
          birthplace_city?: string | null
          birthplace_country_code?: string
          birthplace_country_name?: string
          birthplace_region_code?: string | null
          birthplace_region_name?: string | null
          competition_category?: string
          created_at?: string
          current_team_id?: string | null
          date_of_birth?: string
          entry_class_label?: string | null
          entry_type?: string
          first_eligible_season_id?: string | null
          first_name?: string
          generation_batch_id?: string
          generator_version_id?: string
          height_cm?: number
          id?: string
          last_name?: string
          nationality_code?: string | null
          nationality_name?: string | null
          pool_exited_at?: string | null
          preferred_side?: string
          primary_archetype?: string
          retired_at?: string | null
          secondary_archetype?: string | null
          status?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_current_team_id_fkey"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_first_eligible_season_id_fkey"
            columns: ["first_eligible_season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_generation_batch_id_fkey"
            columns: ["generation_batch_id"]
            isOneToOne: false
            referencedRelation: "generation_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_generator_version_id_fkey"
            columns: ["generator_version_id"]
            isOneToOne: false
            referencedRelation: "generator_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      retirements: {
        Row: {
          created_at: string
          development_run_id: string | null
          final_overall: number
          id: string
          player_id: string
          reason: string
          retirement_age_years: number
          season_id: string
        }
        Insert: {
          created_at?: string
          development_run_id?: string | null
          final_overall: number
          id?: string
          player_id: string
          reason?: string
          retirement_age_years: number
          season_id: string
        }
        Update: {
          created_at?: string
          development_run_id?: string | null
          final_overall?: number
          id?: string
          player_id?: string
          reason?: string
          retirement_age_years?: number
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retirements_development_run_id_fkey"
            columns: ["development_run_id"]
            isOneToOne: false
            referencedRelation: "development_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retirements_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "player_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retirements_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retirements_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_imports: {
        Row: {
          competition_category: string
          completed_at: string
          executed_by_role: string
          id: string
          payload_sha256: string
          population_sha256: string
          season_id: string
          source_sha256: string[]
          summary: Json
        }
        Insert: {
          competition_category: string
          completed_at?: string
          executed_by_role?: string
          id?: string
          payload_sha256: string
          population_sha256: string
          season_id: string
          source_sha256: string[]
          summary: Json
        }
        Update: {
          competition_category?: string
          completed_at?: string
          executed_by_role?: string
          id?: string
          payload_sha256?: string
          population_sha256?: string
          season_id?: string
          source_sha256?: string[]
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "roster_imports_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          competition_category: string
          created_at: string
          ends_on: string | null
          event_name: string | null
          id: string
          label: string
          season_month: number | null
          season_number: number | null
          season_year: number
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          competition_category: string
          created_at?: string
          ends_on?: string | null
          event_name?: string | null
          id?: string
          label: string
          season_month?: number | null
          season_number?: number | null
          season_year: number
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          competition_category?: string
          created_at?: string
          ends_on?: string | null
          event_name?: string | null
          id?: string
          label?: string
          season_month?: number | null
          season_number?: number | null
          season_year?: number
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_season_rosters: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          match_team: Json
          roster_import_id: string
          season_id: string
          team_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          match_team: Json
          roster_import_id: string
          season_id: string
          team_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          match_team?: Json
          roster_import_id?: string
          season_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_season_rosters_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_season_rosters_roster_import_id_fkey"
            columns: ["roster_import_id"]
            isOneToOne: false
            referencedRelation: "roster_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_season_rosters_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_season_rosters_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          active: boolean
          competition_category: string
          created_at: string
          id: string
          name: string
          short_name: string | null
        }
        Insert: {
          active?: boolean
          competition_category: string
          created_at?: string
          id?: string
          name: string
          short_name?: string | null
        }
        Update: {
          active?: boolean
          competition_category?: string
          created_at?: string
          id?: string
          name?: string
          short_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      competition_fixture_status: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          competition_id: string | null
          id: string | null
          ordinal: number | null
          proposal_id: string | null
          result_sha256: string | null
          round_id: string | null
          scores: Json | null
          teams: Json | null
          winner: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_fixtures_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      competition_team_records: {
        Row: {
          competition_id: string | null
          losses: number | null
          name: string | null
          played: number | null
          points_against: number | null
          points_for: number | null
          team_id: string | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_rosters_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_rosters_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_registry: {
        Row: {
          acceleration: number | null
          aerial_marking: number | null
          agility: number | null
          anticipation: number | null
          attacking_rating: number | null
          awareness: number | null
          ball_carrying: number | null
          best_role: string | null
          birthplace_city: string | null
          birthplace_country_code: string | null
          birthplace_country_name: string | null
          birthplace_region_code: string | null
          birthplace_region_name: string | null
          central_rating: number | null
          competition_category: string | null
          composure: number | null
          contested_possession: number | null
          current_team_id: string | null
          current_team_name: string | null
          date_of_birth: string | null
          decision_making: number | null
          defensive_rating: number | null
          defensive_spoiling: number | null
          discipline: number | null
          durability: number | null
          evasion: number | null
          first_name: string | null
          ground_ball_skill: number | null
          hand_passing: number | null
          height_cm: number | null
          id: string | null
          kicking_accuracy: number | null
          kicking_on_run: number | null
          kicking_power: number | null
          last_name: string | null
          nationality_code: string | null
          nationality_name: string | null
          opposite_side_skill: number | null
          overall_rating: number | null
          preferred_side: string | null
          primary_archetype: string | null
          recovery: number | null
          secondary_archetype: string | null
          speed: number | null
          stamina: number | null
          status: string | null
          strength: number | null
          tackling: number | null
          updated_at: string | null
          vertical_leap: number | null
          weight_kg: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_current_team_id_fkey"
            columns: ["current_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_match_proposal_v1: {
        Args: {
          p_actor: string
          p_expected_revision: number
          p_proposal_id: string
        }
        Returns: Json
      }
      activate_competition_v1: {
        Args: {
          p_actor: string
          p_competition_id: string
          p_expected_revision: number
        }
        Returns: Json
      }
      commit_generated_players: {
        Args: {
          p_created_by?: string
          p_generator_version_id: string
          p_players: Json
          p_season_id: string
          p_seed: string
          p_summary?: Json
        }
        Returns: Json
      }
      create_exhibition_competition_v1: {
        Args: { p_actor: string; p_definition: Json; p_season_id: string }
        Returns: Json
      }
      import_founding_rosters_v1: {
        Args: {
          p_payload: Json
          p_population_sha256: string
          p_season_id: string
          p_source_sha256: string[]
        }
        Returns: Json
      }
      stage_match_proposal_v1: {
        Args: { p_actor: string; p_fixture_id: string; p_result: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
