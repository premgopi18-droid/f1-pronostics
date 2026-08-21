// ⚠️ FICHIER GÉNÉRÉ — ne jamais éditer à la main.
// Régénérer après chaque migration qui change le schéma :
//   via MCP Supabase : generate_typescript_types (projet oegnropofqlzkuwleqtt)
//   ou : npx supabase gen types typescript --project-id oegnropofqlzkuwleqtt > lib/database.types.ts
// (en conservant ce bandeau). Source de vérité : le schéma prod.

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          created_at: string
          dedup_key: string | null
          id: string
          sent_at: string | null
          title: string
          url: string
        }
        Insert: {
          body: string
          created_at?: string
          dedup_key?: string | null
          id?: string
          sent_at?: string | null
          title: string
          url?: string
        }
        Update: {
          body?: string
          created_at?: string
          dedup_key?: string | null
          id?: string
          sent_at?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      circuit_tracks: {
        Row: {
          circuit_name: string
          geojson: Json
          id: string
          updated_at: string
        }
        Insert: {
          circuit_name: string
          geojson: Json
          id: string
          updated_at?: string
        }
        Update: {
          circuit_name?: string
          geojson?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      constructors: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          season: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          season: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          season?: number
        }
        Relationships: []
      }
      drivers: {
        Row: {
          code: string
          constructor_id: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
          number: number | null
          season: number
        }
        Insert: {
          code: string
          constructor_id?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          number?: number | null
          season: number
        }
        Update: {
          code?: string
          constructor_id?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          number?: number | null
          season?: number
        }
        Relationships: [
          {
            foreignKeyName: "drivers_constructor_id_fkey"
            columns: ["constructor_id"]
            isOneToOne: false
            referencedRelation: "constructors"
            referencedColumns: ["id"]
          },
        ]
      }
      fastest_lap_predictions: {
        Row: {
          driver_id: string
          id: string
          season: number
          session_id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          driver_id: string
          id?: string
          season: number
          session_id: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          driver_id?: string
          id?: string
          season?: number
          session_id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fastest_lap_predictions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fastest_lap_predictions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fastest_lap_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grands_prix: {
        Row: {
          circuit: string
          country: string
          created_at: string
          id: string
          is_cancelled: boolean
          is_sprint_weekend: boolean
          name: string
          notified_open_at: string | null
          notified_reminder_24h_at: string | null
          notified_scores_at: string | null
          race_laps: number | null
          round: number
          scoring_finalized_at: string | null
          season: number
          weekend_starts_at: string | null
        }
        Insert: {
          circuit: string
          country: string
          created_at?: string
          id?: string
          is_cancelled?: boolean
          is_sprint_weekend?: boolean
          name: string
          notified_open_at?: string | null
          notified_reminder_24h_at?: string | null
          notified_scores_at?: string | null
          race_laps?: number | null
          round: number
          scoring_finalized_at?: string | null
          season: number
          weekend_starts_at?: string | null
        }
        Update: {
          circuit?: string
          country?: string
          created_at?: string
          id?: string
          is_cancelled?: boolean
          is_sprint_weekend?: boolean
          name?: string
          notified_open_at?: string | null
          notified_reminder_24h_at?: string | null
          notified_scores_at?: string | null
          race_laps?: number | null
          round?: number
          scoring_finalized_at?: string | null
          season?: number
          weekend_starts_at?: string | null
        }
        Relationships: []
      }
      items_played: {
        Row: {
          effect_applied: boolean | null
          gp_id: string | null
          id: string
          item_type: string
          league_id: string | null
          payload: Json
          played_at: string
          points_delta_actor: number | null
          points_delta_target: number | null
          resolved_at: string | null
          season: number
          user_id: string
          was_shielded: boolean | null
        }
        Insert: {
          effect_applied?: boolean | null
          gp_id?: string | null
          id?: string
          item_type: string
          league_id?: string | null
          payload?: Json
          played_at?: string
          points_delta_actor?: number | null
          points_delta_target?: number | null
          resolved_at?: string | null
          season: number
          user_id: string
          was_shielded?: boolean | null
        }
        Update: {
          effect_applied?: boolean | null
          gp_id?: string | null
          id?: string
          item_type?: string
          league_id?: string | null
          payload?: Json
          played_at?: string
          points_delta_actor?: number | null
          points_delta_target?: number | null
          resolved_at?: string | null
          season?: number
          user_id?: string
          was_shielded?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "items_played_gp_id_fkey"
            columns: ["gp_id"]
            isOneToOne: false
            referencedRelation: "grands_prix"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_played_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_played_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          id: string
          is_admin: boolean
          joined_at: string
          league_id: string
          season: number
          user_id: string
        }
        Insert: {
          id?: string
          is_admin?: boolean
          joined_at?: string
          league_id: string
          season: number
          user_id: string
        }
        Update: {
          id?: string
          is_admin?: boolean
          joined_at?: string
          league_id?: string
          season?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          invite_open: boolean
          max_members: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          invite_open?: boolean
          max_members: number
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          invite_open?: boolean
          max_members?: number
          name?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          entries: Json
          id: string
          is_valid: boolean
          season: number
          session_id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          entries: Json
          id?: string
          is_valid?: boolean
          season: number
          session_id: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          entries?: Json
          id?: string
          is_valid?: boolean
          season?: number
          session_id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_key: string | null
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_deleted: boolean
          notif_announcements: boolean
          notif_imminence_scope: string
          onboarding_completed: boolean
          pseudo: string
          updated_at: string
        }
        Insert: {
          avatar_key?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id: string
          is_deleted?: boolean
          notif_announcements?: boolean
          notif_imminence_scope?: string
          onboarding_completed?: boolean
          pseudo: string
          updated_at?: string
        }
        Update: {
          avatar_key?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          notif_announcements?: boolean
          notif_imminence_scope?: string
          onboarding_completed?: boolean
          pseudo?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          base_score: number
          breakdown: Json
          computed_at: string
          exact_positions: number
          final_score: number
          id: string
          league_id: string
          season: number
          session_id: string
          user_id: string
        }
        Insert: {
          base_score?: number
          breakdown?: Json
          computed_at?: string
          exact_positions?: number
          final_score?: number
          id?: string
          league_id: string
          season: number
          session_id: string
          user_id: string
        }
        Update: {
          base_score?: number
          breakdown?: Json
          computed_at?: string
          exact_positions?: number
          final_score?: number
          id?: string
          league_id?: string
          season?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      season_predictions: {
        Row: {
          entries: Json
          id: string
          locked_at: string | null
          season: number
          submitted_at: string
          type: string
          user_id: string
        }
        Insert: {
          entries: Json
          id?: string
          locked_at?: string | null
          season: number
          submitted_at?: string
          type: string
          user_id: string
        }
        Update: {
          entries?: Json
          id?: string
          locked_at?: string | null
          season?: number
          submitted_at?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      season_scores: {
        Row: {
          computed_at: string
          id: string
          league_id: string
          season: number
          total: number | null
          user_id: string
          wcc_bonus: number
          wcc_score: number
          wdc_bonus: number
          wdc_score: number
        }
        Insert: {
          computed_at?: string
          id?: string
          league_id: string
          season: number
          total?: number | null
          user_id: string
          wcc_bonus?: number
          wcc_score?: number
          wdc_bonus?: number
          wdc_score?: number
        }
        Update: {
          computed_at?: string
          id?: string
          league_id?: string
          season?: number
          total?: number | null
          user_id?: string
          wcc_bonus?: number
          wcc_score?: number
          wdc_bonus?: number
          wdc_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_scores_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_results: {
        Row: {
          best_lap_time: string | null
          constructor_code: string | null
          created_at: string
          dnf: boolean
          dns: boolean
          driver_id: string
          fastest_lap: boolean
          id: string
          position: number | null
          season: number
          session_id: string
        }
        Insert: {
          best_lap_time?: string | null
          constructor_code?: string | null
          created_at?: string
          dnf?: boolean
          dns?: boolean
          driver_id: string
          fastest_lap?: boolean
          id?: string
          position?: number | null
          season: number
          session_id: string
        }
        Update: {
          best_lap_time?: string | null
          constructor_code?: string | null
          created_at?: string
          dnf?: boolean
          dns?: boolean
          driver_id?: string
          fastest_lap?: boolean
          id?: string
          position?: number | null
          season?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_results_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          gp_id: string
          id: string
          notified_deadline_at: string | null
          notified_imminence_at: string | null
          notified_post_session_at: string | null
          notified_provisional_at: string | null
          results_confirmed_at: string | null
          season: number
          starts_at: string
          type: string
        }
        Insert: {
          created_at?: string
          gp_id: string
          id?: string
          notified_deadline_at?: string | null
          notified_imminence_at?: string | null
          notified_post_session_at?: string | null
          notified_provisional_at?: string | null
          results_confirmed_at?: string | null
          season: number
          starts_at: string
          type: string
        }
        Update: {
          created_at?: string
          gp_id?: string
          id?: string
          notified_deadline_at?: string | null
          notified_imminence_at?: string | null
          notified_post_session_at?: string | null
          notified_provisional_at?: string | null
          results_confirmed_at?: string | null
          season?: number
          starts_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_gp_id_fkey"
            columns: ["gp_id"]
            isOneToOne: false
            referencedRelation: "grands_prix"
            referencedColumns: ["id"]
          },
        ]
      }
      gp_lineups: {
        Row: {
          detected_at: string
          driver_id: string
          gp_id: string
          id: string
          notified_at: string | null
          observed_at: string | null
          season: number
          team_name: string
        }
        Insert: {
          detected_at?: string
          driver_id: string
          gp_id: string
          id?: string
          notified_at?: string | null
          observed_at?: string | null
          season: number
          team_name: string
        }
        Update: {
          detected_at?: string
          driver_id?: string
          gp_id?: string
          id?: string
          notified_at?: string | null
          observed_at?: string | null
          season?: number
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "gp_lineups_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gp_lineups_gp_id_fkey"
            columns: ["gp_id"]
            isOneToOne: false
            referencedRelation: "grands_prix"
            referencedColumns: ["id"]
          },
        ]
      }
      starting_grids: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          position: number
          season: number
          session_id: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          position: number
          season: number
          session_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          position?: number
          season?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "starting_grids_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "starting_grids_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_items: {
        Row: {
          id: string
          item_type: string
          league_id: string
          season: number
          user_id: string
          uses_remaining: number
        }
        Insert: {
          id?: string
          item_type: string
          league_id: string
          season: number
          user_id: string
          uses_remaining: number
        }
        Update: {
          id?: string
          item_type?: string
          league_id?: string
          season?: number
          user_id?: string
          uses_remaining?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_items_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_season_items: {
        Row: {
          created_at: string | null
          id: string
          item_type: string
          season: number
          user_id: string
          uses_remaining: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_type: string
          season: number
          user_id: string
          uses_remaining?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item_type?: string
          season?: number
          user_id?: string
          uses_remaining?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_season_item: {
        Args: {
          p_from: number
          p_item_type: string
          p_season: number
          p_to: number
          p_user_id: string
        }
        Returns: undefined
      }
      create_league: {
        Args: {
          p_items: Json
          p_max_members: number
          p_name: string
          p_season: number
          p_user_id: string
        }
        Returns: {
          invite_code: string
          league_id: string
        }[]
      }
      delete_own_account: { Args: never; Returns: undefined }
      is_member_of_league: {
        Args: { check_league_id: string }
        Returns: boolean
      }
      mark_items_resolved: {
        Args: {
          p_items: Json
        }
        Returns: undefined
      }
      play_item: {
        Args: {
          p_gp_id: string
          p_item_type: string
          p_league_id: string
          p_payload: Json
          p_season: number
          p_user_id: string
        }
        Returns: undefined
      }
      shared_league: { Args: { other_user_id: string }; Returns: boolean }
      toggle_invites: { Args: { p_league_id: string }; Returns: boolean }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
