export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      body_measurements: {
        Row: {
          body_fat_pct: number | null;
          created_at: string;
          date: string;
          id: string;
          muscle_mass_kg: number | null;
          notes: string | null;
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          body_fat_pct?: number | null;
          created_at?: string;
          date: string;
          id?: string;
          muscle_mass_kg?: number | null;
          notes?: string | null;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          body_fat_pct?: number | null;
          created_at?: string;
          date?: string;
          id?: string;
          muscle_mass_kg?: number | null;
          notes?: string | null;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      cardio_sessions: {
        Row: {
          avg_hr: number | null;
          calories: number | null;
          created_at: string;
          distance: number | null;
          duration: number;
          external_id: string | null;
          id: string;
          max_hr: number | null;
          notes: string | null;
          source: string;
          started_at: string;
          type: string;
          user_id: string;
        };
        Insert: {
          avg_hr?: number | null;
          calories?: number | null;
          created_at?: string;
          distance?: number | null;
          duration: number;
          external_id?: string | null;
          id?: string;
          max_hr?: number | null;
          notes?: string | null;
          source?: string;
          started_at: string;
          type: string;
          user_id: string;
        };
        Update: {
          avg_hr?: number | null;
          calories?: number | null;
          created_at?: string;
          distance?: number | null;
          duration?: number;
          external_id?: string | null;
          id?: string;
          max_hr?: number | null;
          notes?: string | null;
          source?: string;
          started_at?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      exercise_goals: {
        Row: {
          created_at: string;
          exercise_id: string;
          id: string;
          target_one_rm: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          exercise_id: string;
          id?: string;
          target_one_rm: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          exercise_id?: string;
          id?: string;
          target_one_rm?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_goals_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_notes: {
        Row: {
          created_at: string;
          exercise_id: string;
          id: string;
          note: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          exercise_id: string;
          id?: string;
          note: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          exercise_id?: string;
          id?: string;
          note?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_notes_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      exercises: {
        Row: {
          created_at: string | null;
          description: string | null;
          equipment: string | null;
          id: string;
          is_bilateral: boolean | null;
          is_compound: boolean;
          is_public: boolean;
          media_url: string | null;
          movement: string | null;
          muscle_detail: string | null;
          muscle_group: string;
          name: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          equipment?: string | null;
          id?: string;
          is_bilateral?: boolean | null;
          is_compound?: boolean;
          is_public?: boolean;
          media_url?: string | null;
          movement?: string | null;
          muscle_detail?: string | null;
          muscle_group: string;
          name: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          equipment?: string | null;
          id?: string;
          is_bilateral?: boolean | null;
          is_compound?: boolean;
          is_public?: boolean;
          media_url?: string | null;
          movement?: string | null;
          muscle_detail?: string | null;
          muscle_group?: string;
          name?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      personal_records: {
        Row: {
          achieved_at: string | null;
          exercise_id: string;
          id: string;
          one_rm: number | null;
          rep_band: number;
          reps: number;
          user_id: string;
          weight: number;
          workout_set_id: string | null;
        };
        Insert: {
          achieved_at?: string | null;
          exercise_id: string;
          id?: string;
          one_rm?: number | null;
          rep_band: number;
          reps: number;
          user_id: string;
          weight: number;
          workout_set_id?: string | null;
        };
        Update: {
          achieved_at?: string | null;
          exercise_id?: string;
          id?: string;
          one_rm?: number | null;
          rep_band?: number;
          reps?: number;
          user_id?: string;
          weight?: number;
          workout_set_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'personal_records_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'personal_records_workout_set_id_fkey';
            columns: ['workout_set_id'];
            isOneToOne: false;
            referencedRelation: 'workout_sets';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          birth_year: number | null;
          days_per_week: number | null;
          email: string | null;
          equipment_available: string[] | null;
          full_name: string | null;
          goal: string | null;
          height_cm: number | null;
          id: string;
          onboarding_completed: boolean;
          sex: string | null;
          updated_at: string | null;
          username: string | null;
          weight_kg: number | null;
          weight_unit: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          birth_year?: number | null;
          days_per_week?: number | null;
          email?: string | null;
          equipment_available?: string[] | null;
          full_name?: string | null;
          goal?: string | null;
          height_cm?: number | null;
          id: string;
          onboarding_completed?: boolean;
          sex?: string | null;
          updated_at?: string | null;
          username?: string | null;
          weight_kg?: number | null;
          weight_unit?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          birth_year?: number | null;
          days_per_week?: number | null;
          email?: string | null;
          equipment_available?: string[] | null;
          full_name?: string | null;
          goal?: string | null;
          height_cm?: number | null;
          id?: string;
          onboarding_completed?: boolean;
          sex?: string | null;
          updated_at?: string | null;
          username?: string | null;
          weight_kg?: number | null;
          weight_unit?: string | null;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          created_at: string;
          id: string;
          platform: string;
          token: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          platform?: string;
          token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          platform?: string;
          token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      routine_templates: {
        Row: {
          created_at: string;
          days_data: Json;
          description: string | null;
          id: string;
          is_public: boolean;
          name: string;
        };
        Insert: {
          created_at?: string;
          days_data?: Json;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          name: string;
        };
        Update: {
          created_at?: string;
          days_data?: Json;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      user_routines: {
        Row: {
          id: string;
          routine: Json;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          routine?: Json;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          routine?: Json;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      wearable_connections: {
        Row: {
          access_expires_at: string | null;
          created_at: string;
          fitbit_user_id: string | null;
          id: string;
          last_error: string | null;
          last_sync_at: string | null;
          provider: string;
          scopes: string[];
          status: string;
          updated_at: string;
          user_id: string;
          vault_access_secret_id: string | null;
          vault_refresh_secret_id: string | null;
        };
        Insert: {
          access_expires_at?: string | null;
          created_at?: string;
          fitbit_user_id?: string | null;
          id?: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          provider: string;
          scopes?: string[];
          status?: string;
          updated_at?: string;
          user_id: string;
          vault_access_secret_id?: string | null;
          vault_refresh_secret_id?: string | null;
        };
        Update: {
          access_expires_at?: string | null;
          created_at?: string;
          fitbit_user_id?: string | null;
          id?: string;
          last_error?: string | null;
          last_sync_at?: string | null;
          provider?: string;
          scopes?: string[];
          status?: string;
          updated_at?: string;
          user_id?: string;
          vault_access_secret_id?: string | null;
          vault_refresh_secret_id?: string | null;
        };
        Relationships: [];
      };
      wearable_daily: {
        Row: {
          avg_hr: number | null;
          calories: number | null;
          created_at: string;
          date: string;
          distance_km: number | null;
          id: string;
          max_hr: number | null;
          resting_hr: number | null;
          source: string;
          steps: number | null;
          user_id: string;
        };
        Insert: {
          avg_hr?: number | null;
          calories?: number | null;
          created_at?: string;
          date: string;
          distance_km?: number | null;
          id?: string;
          max_hr?: number | null;
          resting_hr?: number | null;
          source: string;
          steps?: number | null;
          user_id: string;
        };
        Update: {
          avg_hr?: number | null;
          calories?: number | null;
          created_at?: string;
          date?: string;
          distance_km?: number | null;
          id?: string;
          max_hr?: number | null;
          resting_hr?: number | null;
          source?: string;
          steps?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      wearable_sleep: {
        Row: {
          awake_min: number | null;
          created_at: string;
          date: string;
          deep_min: number | null;
          duration_min: number | null;
          efficiency_pct: number | null;
          id: string;
          light_min: number | null;
          rem_min: number | null;
          source: string;
          user_id: string;
        };
        Insert: {
          awake_min?: number | null;
          created_at?: string;
          date: string;
          deep_min?: number | null;
          duration_min?: number | null;
          efficiency_pct?: number | null;
          id?: string;
          light_min?: number | null;
          rem_min?: number | null;
          source: string;
          user_id: string;
        };
        Update: {
          awake_min?: number | null;
          created_at?: string;
          date?: string;
          deep_min?: number | null;
          duration_min?: number | null;
          efficiency_pct?: number | null;
          id?: string;
          light_min?: number | null;
          rem_min?: number | null;
          source?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      workout_sets: {
        Row: {
          created_at: string | null;
          duration_seconds: number | null;
          exercise_id: string;
          id: string;
          is_pr: boolean | null;
          is_warmup: boolean;
          notes: string | null;
          one_rm: number | null;
          reps: number;
          rir: number | null;
          rpe: number | null;
          set_num: number;
          set_type: string;
          weight: number;
          workout_id: string;
        };
        Insert: {
          created_at?: string | null;
          duration_seconds?: number | null;
          exercise_id: string;
          id?: string;
          is_pr?: boolean | null;
          is_warmup?: boolean;
          notes?: string | null;
          one_rm?: number | null;
          reps: number;
          rir?: number | null;
          rpe?: number | null;
          set_num: number;
          set_type?: string;
          weight: number;
          workout_id: string;
        };
        Update: {
          created_at?: string | null;
          duration_seconds?: number | null;
          exercise_id?: string;
          id?: string;
          is_pr?: boolean | null;
          is_warmup?: boolean;
          notes?: string | null;
          one_rm?: number | null;
          reps?: number;
          rir?: number | null;
          rpe?: number | null;
          set_num?: number;
          set_type?: string;
          weight?: number;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sets_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_sets_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      workouts: {
        Row: {
          duration_min: number | null;
          duration_seconds: number | null;
          finished_at: string | null;
          id: string;
          name: string | null;
          notes: string | null;
          rating: number | null;
          started_at: string | null;
          status: string | null;
          total_sets: number | null;
          total_volume: number | null;
          total_volume_kg: number | null;
          user_id: string;
        };
        Insert: {
          duration_min?: number | null;
          duration_seconds?: number | null;
          finished_at?: string | null;
          id?: string;
          name?: string | null;
          notes?: string | null;
          rating?: number | null;
          started_at?: string | null;
          status?: string | null;
          total_sets?: number | null;
          total_volume?: number | null;
          total_volume_kg?: number | null;
          user_id: string;
        };
        Update: {
          duration_min?: number | null;
          duration_seconds?: number | null;
          finished_at?: string | null;
          id?: string;
          name?: string | null;
          notes?: string | null;
          rating?: number | null;
          started_at?: string | null;
          status?: string | null;
          total_sets?: number | null;
          total_volume?: number | null;
          total_volume_kg?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_daily_volume: {
        Row: {
          exercises_count: number | null;
          sets_count: number | null;
          total_volume_kg: number | null;
          user_id: string | null;
          workout_date: string | null;
        };
        Relationships: [];
      };
      v_last_trained_by_muscle: {
        Row: {
          days_since: number | null;
          last_trained_at: string | null;
          muscle_group: string | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      v_progression_1rm: {
        Row: {
          estimated_1rm: number | null;
          exercise_id: string | null;
          max_weight: number | null;
          session_date: string | null;
          session_volume_kg: number | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sets_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      v_weekly_volume_by_muscle: {
        Row: {
          muscle_group: string | null;
          sets_count: number | null;
          user_id: string | null;
          volume_kg: number | null;
          week_start: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_exercises_with_usage: {
        Args: { p_user_id: string };
        Returns: {
          created_at: string;
          id: string;
          muscle_group: string;
          name: string;
          usage_count: number;
          user_id: string;
        }[];
      };
      get_volume_by_muscle_group: {
        Args: { user_uuid: string };
        Returns: {
          muscle_group: string;
          total_volume: number;
        }[];
      };
      get_workouts_with_sets: {
        Args: { p_cursor?: string; p_limit?: number; p_user_id: string };
        Returns: Json;
      };
      import_wearable_workouts: {
        Args: { p_rows: Json; p_user_id: string };
        Returns: number;
      };
      pr_rep_band: { Args: { p_reps: number }; Returns: number };
      save_workout_with_sets: {
        Args: {
          p_exercise_id: string;
          p_finished_at: string;
          p_notes?: string;
          p_rating?: number;
          p_sets: Json;
          p_started_at: string;
          p_user_id: string;
        };
        Returns: string;
      };
      upsert_wearable_daily: {
        Args: { p_rows: Json; p_user_id: string };
        Returns: number;
      };
      upsert_wearable_sleep: {
        Args: { p_rows: Json; p_user_id: string };
        Returns: number;
      };
      wearable_get_tokens: {
        Args: { p_provider: string; p_user_id: string };
        Returns: {
          access_expires_at: string;
          access_token: string;
          fitbit_user_id: string;
          refresh_token: string;
          scopes: string[];
        }[];
      };
      wearable_store_tokens: {
        Args: {
          p_access: string;
          p_expires_at: string;
          p_fitbit_user_id: string;
          p_provider: string;
          p_refresh: string;
          p_scopes: string[];
          p_user_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
