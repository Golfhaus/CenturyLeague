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
      development_runs: {
        Row: {
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
      generation_batches: {
        Row: {
          committed: boolean
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
          current_season_id: string | null
          id: number
          updated_at: string
        }
        Insert: {
          active_development_model_version?: string
          active_generator_version_id?: string | null
          current_season_id?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          active_development_model_version?: string
          active_generator_version_id?: string | null
          current_season_id?: string | null
          id?: number
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
          age: number
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
          age: number
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
          age?: number
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
          first_name: string
          generation_batch_id: string
          generator_version_id: string
          height_cm: number
          id: string
          last_name: string
          nationality_code: string | null
          nationality_name: string | null
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
          first_name: string
          generation_batch_id: string
          generator_version_id: string
          height_cm: number
          id?: string
          last_name: string
          nationality_code?: string | null
          nationality_name?: string | null
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
          first_name?: string
          generation_batch_id?: string
          generator_version_id?: string
          height_cm?: number
          id?: string
          last_name?: string
          nationality_code?: string | null
          nationality_name?: string | null
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
          retirement_age: number
          season_id: string
        }
        Insert: {
          created_at?: string
          development_run_id?: string | null
          final_overall: number
          id?: string
          player_id: string
          reason?: string
          retirement_age: number
          season_id: string
        }
        Update: {
          created_at?: string
          development_run_id?: string | null
          final_overall?: number
          id?: string
          player_id?: string
          reason?: string
          retirement_age?: number
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
      seasons: {
        Row: {
          created_at: string
          id: string
          label: string
          season_year: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          season_year: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          season_year?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      [_ in never]: never
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
