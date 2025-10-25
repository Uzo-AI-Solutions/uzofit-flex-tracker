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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      completed_sets: {
        Row: {
          created_at: string
          id: string
          reps: number
          session_item_id: string
          set_number: number
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          reps: number
          session_item_id: string
          set_number: number
          updated_at?: string
          weight: number
        }
        Update: {
          created_at?: string
          id?: string
          reps?: number
          session_item_id?: string
          set_number?: number
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "completed_sets_session_item_id_fkey"
            columns: ["session_item_id"]
            isOneToOne: false
            referencedRelation: "session_items"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          category: string
          deleted_at: string | null
          id: string
          instructions: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          deleted_at?: string | null
          id?: string
          instructions?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          deleted_at?: string | null
          id?: string
          instructions?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          deleted_at: string | null
          duration_weeks: number
          id: string
          is_active: boolean
          name: string
          start_date: string
          updated_at: string
          user_id: string
          workout_id: string
        }
        Insert: {
          deleted_at?: string | null
          duration_weeks: number
          id?: string
          is_active?: boolean
          name: string
          start_date?: string
          updated_at?: string
          user_id: string
          workout_id: string
        }
        Update: {
          deleted_at?: string | null
          duration_weeks?: number
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
          updated_at?: string
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      session_groups: {
        Row: {
          group_type: Database["public"]["Enums"]["group_type"]
          id: string
          name: string
          position: number
          rest_seconds: number | null
          session_id: string
          updated_at: string
        }
        Insert: {
          group_type: Database["public"]["Enums"]["group_type"]
          id?: string
          name: string
          position: number
          rest_seconds?: number | null
          session_id: string
          updated_at?: string
        }
        Update: {
          group_type?: Database["public"]["Enums"]["group_type"]
          id?: string
          name?: string
          position?: number
          rest_seconds?: number | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_groups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_items: {
        Row: {
          exercise_name: string
          id: string
          notes: string | null
          position: number
          rest_seconds: number | null
          session_group_id: string
          target_reps: number | null
          target_sets: number | null
          target_weight: number | null
          updated_at: string
        }
        Insert: {
          exercise_name: string
          id?: string
          notes?: string | null
          position: number
          rest_seconds?: number | null
          session_group_id: string
          target_reps?: number | null
          target_sets?: number | null
          target_weight?: number | null
          updated_at?: string
        }
        Update: {
          exercise_name?: string
          id?: string
          notes?: string | null
          position?: number
          rest_seconds?: number | null
          session_group_id?: string
          target_reps?: number | null
          target_sets?: number | null
          target_weight?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_items_session_group_id_fkey"
            columns: ["session_group_id"]
            isOneToOne: false
            referencedRelation: "session_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          day_dow: Database["public"]["Enums"]["day_of_week"] | null
          finished_at: string | null
          id: string
          plan_id: string | null
          started_at: string
          title: string
          total_volume: number | null
          updated_at: string
          user_id: string
          workout_id: string
        }
        Insert: {
          day_dow?: Database["public"]["Enums"]["day_of_week"] | null
          finished_at?: string | null
          id?: string
          plan_id?: string | null
          started_at: string
          title: string
          total_volume?: number | null
          updated_at?: string
          user_id: string
          workout_id: string
        }
        Update: {
          day_dow?: Database["public"]["Enums"]["day_of_week"] | null
          finished_at?: string | null
          id?: string
          plan_id?: string | null
          started_at?: string
          title?: string
          total_volume?: number | null
          updated_at?: string
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          system_instructions: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          system_instructions?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          system_instructions?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_days: {
        Row: {
          deleted_at: string | null
          dow: Database["public"]["Enums"]["day_of_week"]
          id: string
          position: number
          updated_at: string
          workout_id: string
        }
        Insert: {
          deleted_at?: string | null
          dow: Database["public"]["Enums"]["day_of_week"]
          id?: string
          position?: number
          updated_at?: string
          workout_id: string
        }
        Update: {
          deleted_at?: string | null
          dow?: Database["public"]["Enums"]["day_of_week"]
          id?: string
          position?: number
          updated_at?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_days_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_groups: {
        Row: {
          deleted_at: string | null
          group_type: Database["public"]["Enums"]["group_type"]
          id: string
          name: string
          position: number
          rest_seconds: number | null
          updated_at: string
          workout_day_id: string
        }
        Insert: {
          deleted_at?: string | null
          group_type: Database["public"]["Enums"]["group_type"]
          id?: string
          name: string
          position: number
          rest_seconds?: number | null
          updated_at?: string
          workout_day_id: string
        }
        Update: {
          deleted_at?: string | null
          group_type?: Database["public"]["Enums"]["group_type"]
          id?: string
          name?: string
          position?: number
          rest_seconds?: number | null
          updated_at?: string
          workout_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_groups_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_items: {
        Row: {
          deleted_at: string | null
          exercise_id: string
          id: string
          notes: string | null
          position: number
          rest_seconds_override: number | null
          target_reps: number | null
          target_sets: number | null
          target_weight: number | null
          updated_at: string
          workout_group_id: string
        }
        Insert: {
          deleted_at?: string | null
          exercise_id: string
          id?: string
          notes?: string | null
          position: number
          rest_seconds_override?: number | null
          target_reps?: number | null
          target_sets?: number | null
          target_weight?: number | null
          updated_at?: string
          workout_group_id: string
        }
        Update: {
          deleted_at?: string | null
          exercise_id?: string
          id?: string
          notes?: string | null
          position?: number
          rest_seconds_override?: number | null
          target_reps?: number | null
          target_sets?: number | null
          target_weight?: number | null
          updated_at?: string
          workout_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_items_workout_group_id_fkey"
            columns: ["workout_group_id"]
            isOneToOne: false
            referencedRelation: "workout_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          deleted_at: string | null
          id: string
          name: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          deleted_at?: string | null
          id?: string
          name: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          deleted_at?: string | null
          id?: string
          name?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clone_workout: {
        Args: {
          p_change_reps?: number
          p_new_name: string
          p_scale_weights?: number
          p_user_id: string
          p_workout_id: string
        }
        Returns: Json
      }
      create_complete_workout: {
        Args: {
          p_days?: Json
          p_user_id: string
          p_workout_name: string
          p_workout_summary?: string
        }
        Returns: Json
      }
      get_exercise_history: {
        Args: {
          p_end_date?: string
          p_exercise_name: string
          p_limit?: number
          p_start_date?: string
          p_user_id: string
        }
        Returns: Json
      }
      get_workout_analytics: {
        Args: {
          p_end_date?: string
          p_start_date?: string
          p_user_id: string
          p_workout_id?: string
        }
        Returns: Json
      }
      start_session_from_workout: {
        Args: {
          p_dow?: Database["public"]["Enums"]["day_of_week"]
          p_plan_id?: string
          p_title?: string
          p_user_id: string
          p_workout_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      day_of_week: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"
      group_type: "single" | "superset" | "triset" | "circuit"
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
    Enums: {
      day_of_week: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      group_type: ["single", "superset", "triset", "circuit"],
    },
  },
} as const
