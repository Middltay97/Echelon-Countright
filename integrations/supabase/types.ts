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
      barcode_aliases: {
        Row: {
          barcode: string
          created_at: string
          created_by: string | null
          id: string
          sku: string
        }
        Insert: {
          barcode: string
          created_at?: string
          created_by?: string | null
          id?: string
          sku: string
        }
        Update: {
          barcode?: string
          created_at?: string
          created_by?: string | null
          id?: string
          sku?: string
        }
        Relationships: []
      }
      count_allocation_rules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          percentage: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          percentage: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          percentage?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      count_events: {
        Row: {
          action: string
          client_event_id: string | null
          created_at: string
          cycle_id: string
          id: string
          item_id: string | null
          qty_after: number | null
          qty_before: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          action: string
          client_event_id?: string | null
          created_at?: string
          cycle_id: string
          id?: string
          item_id?: string | null
          qty_after?: number | null
          qty_before?: number | null
          source?: string | null
          user_id: string
        }
        Update: {
          action?: string
          client_event_id?: string | null
          created_at?: string
          cycle_id?: string
          id?: string
          item_id?: string | null
          qty_after?: number | null
          qty_before?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "count_events_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "count_items"
            referencedColumns: ["id"]
          },
        ]
      }
      count_items: {
        Row: {
          barcode: string | null
          counted_at: string | null
          counted_by: string | null
          counted_qty: number | null
          created_at: string
          cycle_id: string
          description: string | null
          expected_qty: number
          id: string
          is_unexpected: boolean
          location: string | null
          location2: string | null
          mislocated: boolean
          notes: string | null
          sku: string | null
          status: Database["public"]["Enums"]["item_status"]
          unit_cost: number | null
          uom: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          barcode?: string | null
          counted_at?: string | null
          counted_by?: string | null
          counted_qty?: number | null
          created_at?: string
          cycle_id: string
          description?: string | null
          expected_qty?: number
          id?: string
          is_unexpected?: boolean
          location?: string | null
          location2?: string | null
          mislocated?: boolean
          notes?: string | null
          sku?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          unit_cost?: number | null
          uom?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          barcode?: string | null
          counted_at?: string | null
          counted_by?: string | null
          counted_qty?: number | null
          created_at?: string
          cycle_id?: string
          description?: string | null
          expected_qty?: number
          id?: string
          is_unexpected?: boolean
          location?: string | null
          location2?: string | null
          mislocated?: boolean
          notes?: string | null
          sku?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          unit_cost?: number | null
          uom?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "count_items_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_active_counter: {
        Row: {
          acquired_at: string
          badge_id: string
          cycle_id: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          badge_id: string
          cycle_id: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          badge_id?: string
          cycle_id?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_active_counter_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: true
            referencedRelation: "cycle_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_assignments: {
        Row: {
          assigned_at: string
          cycle_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          cycle_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          cycle_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_assignments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycle_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_counts: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          baseline_filename: string | null
          baseline_source: string | null
          count_ended_at: string | null
          count_started_at: string | null
          created_at: string
          created_by: string
          due_date: string | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["cycle_status"]
          verify_ended_at: string | null
          verify_started_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          baseline_filename?: string | null
          baseline_source?: string | null
          count_ended_at?: string | null
          count_started_at?: string | null
          created_at?: string
          created_by: string
          due_date?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["cycle_status"]
          verify_ended_at?: string | null
          verify_started_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          baseline_filename?: string | null
          baseline_source?: string | null
          count_ended_at?: string | null
          count_started_at?: string | null
          created_at?: string
          created_by?: string
          due_date?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["cycle_status"]
          verify_ended_at?: string | null
          verify_started_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_counts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_recipients: {
        Row: {
          created_at: string
          email: string
          id: string
          label: string | null
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          label?: string | null
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          label?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_recipients_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          badge_id: string | null
          created_at: string
          default_warehouse_id: string | null
          full_name: string | null
          id: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          badge_id?: string | null
          created_at?: string
          default_warehouse_id?: string | null
          full_name?: string | null
          id: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          badge_id?: string | null
          created_at?: string
          default_warehouse_id?: string | null
          full_name?: string | null
          id?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_warehouse_fkey"
            columns: ["default_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_diagnostics: {
        Row: {
          badge_id: string | null
          candidate_keys: string[] | null
          char_codes: number[] | null
          closest_master_sku: string | null
          created_at: string
          cycle_id: string | null
          id: string
          length: number | null
          lookup_key: string | null
          normalized: string | null
          notes: Json | null
          raw: string
          result_status: string
          user_id: string | null
        }
        Insert: {
          badge_id?: string | null
          candidate_keys?: string[] | null
          char_codes?: number[] | null
          closest_master_sku?: string | null
          created_at?: string
          cycle_id?: string | null
          id?: string
          length?: number | null
          lookup_key?: string | null
          normalized?: string | null
          notes?: Json | null
          raw: string
          result_status: string
          user_id?: string | null
        }
        Update: {
          badge_id?: string | null
          candidate_keys?: string[] | null
          char_codes?: number[] | null
          closest_master_sku?: string | null
          created_at?: string
          cycle_id?: string | null
          id?: string
          length?: number | null
          lookup_key?: string | null
          normalized?: string | null
          notes?: Json | null
          raw?: string
          result_status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sku_master: {
        Row: {
          barcode: string | null
          description: string | null
          is_ancillary: boolean
          is_tertiary: boolean
          location: string | null
          location2: string | null
          master_key: string
          on_hand_qty: number | null
          sku: string
          unit_cost: number | null
          uom: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          barcode?: string | null
          description?: string | null
          is_ancillary?: boolean
          is_tertiary?: boolean
          location?: string | null
          location2?: string | null
          master_key: string
          on_hand_qty?: number | null
          sku: string
          unit_cost?: number | null
          uom?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          barcode?: string | null
          description?: string | null
          is_ancillary?: boolean
          is_tertiary?: boolean
          location?: string | null
          location2?: string | null
          master_key?: string
          on_hand_qty?: number | null
          sku?: string
          unit_cost?: number | null
          uom?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_profiles_with_badges: {
        Args: never
        Returns: {
          badge_id: string
          full_name: string
          id: string
        }[]
      }
      delete_cycle: { Args: { _cycle_id: string }; Returns: undefined }
      find_count_item_by_code: {
        Args: { p_code: string; p_cycle_id: string }
        Returns: {
          barcode: string | null
          counted_at: string | null
          counted_by: string | null
          counted_qty: number | null
          created_at: string
          cycle_id: string
          description: string | null
          expected_qty: number
          id: string
          is_unexpected: boolean
          location: string | null
          location2: string | null
          mislocated: boolean
          notes: string | null
          sku: string | null
          status: Database["public"]["Enums"]["item_status"]
          unit_cost: number | null
          uom: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "count_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      find_master_sku_by_code: {
        Args: { p_code: string }
        Returns: {
          barcode: string | null
          description: string | null
          is_ancillary: boolean
          is_tertiary: boolean
          location: string | null
          location2: string | null
          master_key: string
          on_hand_qty: number | null
          sku: string
          unit_cost: number | null
          uom: string | null
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "sku_master"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_profile_names: {
        Args: { _ids: string[] }
        Returns: {
          full_name: string
          id: string
          team_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_profile_names: {
        Args: never
        Returns: {
          full_name: string
          id: string
          team_id: string
        }[]
      }
      mobile_apply_scan: {
        Args: {
          p_action: string
          p_add_qty: number
          p_client_event_id: string
          p_cycle_id: string
          p_item_id: string
          p_user_id: string
        }
        Returns: number
      }
      normalize_bin: { Args: { bin: string }; Returns: string }
      normalize_code: { Args: { code: string }; Returns: string }
      refresh_open_cycle_expected_qty: { Args: never; Returns: number }
      sku_candidates: { Args: { code: string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "verifier" | "counter"
      cycle_status:
        | "draft"
        | "in_progress"
        | "verifying"
        | "verified"
        | "finalized"
        | "cancelled"
      item_status: "uncounted" | "counted" | "recount" | "verified"
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
      app_role: ["admin", "verifier", "counter"],
      cycle_status: [
        "draft",
        "in_progress",
        "verifying",
        "verified",
        "finalized",
        "cancelled",
      ],
      item_status: ["uncounted", "counted", "recount", "verified"],
    },
  },
} as const
