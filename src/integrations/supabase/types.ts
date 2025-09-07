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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ad_progress: {
        Row: {
          created_at: string
          id: string
          last_view_date: string | null
          total_credits_earned: number
          updated_at: string
          user_id: string
          views_today: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_view_date?: string | null
          total_credits_earned?: number
          updated_at?: string
          user_id: string
          views_today?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_view_date?: string | null
          total_credits_earned?: number
          updated_at?: string
          user_id?: string
          views_today?: number
        }
        Relationships: []
      }
      ad_statistics: {
        Row: {
          ad_clicks: number
          ad_impressions: number
          created_at: string
          date: string
          id: string
          placement_id: string | null
          revenue_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_clicks?: number
          ad_impressions?: number
          created_at?: string
          date?: string
          id?: string
          placement_id?: string | null
          revenue_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_clicks?: number
          ad_impressions?: number
          created_at?: string
          date?: string
          id?: string
          placement_id?: string | null
          revenue_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown | null
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          target_id?: string | null
          target_table?: string
        }
        Relationships: []
      }
      bd_ativo: {
        Row: {
          created_at: string
          id: number
          number: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          number?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          number?: number | null
        }
        Relationships: []
      }
      device_sessions: {
        Row: {
          created_at: string | null
          device_fingerprint: string
          first_seen: string
          free_credits_claimed: boolean | null
          id: string
          ip_address: unknown
          last_seen: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          device_fingerprint: string
          first_seen?: string
          free_credits_claimed?: boolean | null
          id?: string
          ip_address: unknown
          last_seen?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string
          first_seen?: string
          free_credits_claimed?: boolean | null
          id?: string
          ip_address?: unknown
          last_seen?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      encrypted_pix_data: {
        Row: {
          created_at: string
          encrypted_pix_key: string
          id: string
          withdraw_request_id: string
        }
        Insert: {
          created_at?: string
          encrypted_pix_key: string
          id?: string
          withdraw_request_id: string
        }
        Update: {
          created_at?: string
          encrypted_pix_key?: string
          id?: string
          withdraw_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "encrypted_pix_data_withdraw_request_id_fkey"
            columns: ["withdraw_request_id"]
            isOneToOne: false
            referencedRelation: "withdraw_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          credits: number | null
          email: string
          id: string
          name: string
          points: number | null
          tutorial_completed: boolean | null
          tutorial_skipped: boolean | null
          tutorial_views: number
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string | null
          credits?: number | null
          email: string
          id?: string
          name: string
          points?: number | null
          tutorial_completed?: boolean | null
          tutorial_skipped?: boolean | null
          tutorial_views?: number
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string | null
          credits?: number | null
          email?: string
          id?: string
          name?: string
          points?: number | null
          tutorial_completed?: boolean | null
          tutorial_skipped?: boolean | null
          tutorial_views?: number
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          created_at: string
          credits_earned: number
          id: string
          milestone_completed_at: string
          milestone_type: string
          referral_code: string
          referred_user_id: string
          referred_user_name: string | null
          referrer_user_id: string
        }
        Insert: {
          created_at?: string
          credits_earned?: number
          id?: string
          milestone_completed_at?: string
          milestone_type: string
          referral_code: string
          referred_user_id: string
          referred_user_name?: string | null
          referrer_user_id: string
        }
        Update: {
          created_at?: string
          credits_earned?: number
          id?: string
          milestone_completed_at?: string
          milestone_type?: string
          referral_code?: string
          referred_user_id?: string
          referred_user_name?: string | null
          referrer_user_id?: string
        }
        Relationships: []
      }
      signup_eligibility: {
        Row: {
          block_number: number | null
          block_position: number | null
          created_at: string
          credits_amount: number | null
          credits_granted: boolean
          device_fingerprint: string
          eligible_user_position: number | null
          evaluation_reason: string | null
          id: string
          ip_address: unknown
          is_eligible: boolean
          risk_score: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          block_number?: number | null
          block_position?: number | null
          created_at?: string
          credits_amount?: number | null
          credits_granted?: boolean
          device_fingerprint: string
          eligible_user_position?: number | null
          evaluation_reason?: string | null
          id?: string
          ip_address: unknown
          is_eligible?: boolean
          risk_score?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          block_number?: number | null
          block_position?: number | null
          created_at?: string
          credits_amount?: number | null
          credits_granted?: boolean
          device_fingerprint?: string
          eligible_user_position?: number | null
          evaluation_reason?: string | null
          id?: string
          ip_address?: unknown
          is_eligible?: boolean
          risk_score?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sprites: {
        Row: {
          created_at: string | null
          id: string
          image: string
          name: string
          points: number
          price: number
          rarity: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image: string
          name: string
          points: number
          price: number
          rarity: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image?: string
          name?: string
          points?: number
          price?: number
          rarity?: string
        }
        Relationships: []
      }
      transaction_history: {
        Row: {
          amount: number
          created_at: string | null
          description: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description: string
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sprites: {
        Row: {
          acquired_at: string | null
          id: string
          sprite_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string | null
          id?: string
          sprite_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string | null
          id?: string
          sprite_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sprites_sprite_id_fkey"
            columns: ["sprite_id"]
            isOneToOne: false
            referencedRelation: "sprites"
            referencedColumns: ["id"]
          },
        ]
      }
      withdraw_requests: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          pix_key: string
          points: number
          processed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          pix_key: string
          points: number
          processed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          pix_key?: string
          points?: number
          processed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_withdrawal: {
        Args: { withdrawal_id: string }
        Returns: undefined
      }
      approve_withdrawal_secure: {
        Args: { withdrawal_id: string }
        Returns: undefined
      }
      assign_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      can_claim_free_credits: {
        Args: {
          p_device_fingerprint: string
          p_ip_address: unknown
          p_user_agent?: string
        }
        Returns: boolean
      }
      check_username_available: {
        Args: { username_input: string }
        Returns: boolean
      }
      claim_free_credits_secure: {
        Args: {
          p_device_fingerprint: string
          p_ip_address: unknown
          p_user_agent?: string
        }
        Returns: Json
      }
      claim_free_credits_ultra_secure: {
        Args: {
          p_browser_fingerprint?: string
          p_device_fingerprint: string
          p_ip_address: unknown
          p_localstorage_hash?: string
          p_user_agent?: string
        }
        Returns: Json
      }
      evaluate_initial_credits: {
        Args: {
          p_device_fingerprint: string
          p_ip_address: unknown
          p_user_agent?: string
          p_user_id: string
        }
        Returns: Json
      }
      generate_referral_code: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_referral_statistics: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_user_sprite_quantities: {
        Args: { p_user_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_user: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_target_id?: string
          p_target_table: string
        }
        Returns: undefined
      }
      lookup_login_identity: {
        Args: { identifier: string }
        Returns: Json
      }
      mark_free_credits_claimed: {
        Args: { p_device_fingerprint: string; p_user_id: string }
        Returns: undefined
      }
      process_ad_view: {
        Args: { p_placement_id?: string; p_user_id: string }
        Returns: Json
      }
      process_referral_reward: {
        Args: {
          p_milestone_type: string
          p_referred_user_id: string
          p_withdrawal_amount: number
        }
        Returns: boolean
      }
      purchase_sprite_admin_mode: {
        Args: { p_buyer_user_id: string; p_sprite_id: string }
        Returns: Json
      }
      purchase_sprite_with_lottery: {
        Args: { p_buyer_user_id: string; p_sprite_id: string }
        Returns: Json
      }
      reject_withdrawal_and_return_points: {
        Args: { withdrawal_id: string }
        Returns: undefined
      }
      reject_withdrawal_secure: {
        Args: { rejection_reason?: string; withdrawal_id: string }
        Returns: undefined
      }
      secure_role_assignment: {
        Args: {
          p_action?: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_target_user_id: string
        }
        Returns: boolean
      }
      store_encrypted_pix_key: {
        Args: { p_pix_key: string; p_withdraw_request_id: string }
        Returns: string
      }
      store_encrypted_pix_key_enhanced: {
        Args: { p_pix_key: string; p_withdraw_request_id: string }
        Returns: string
      }
      update_credits_after_payment: {
        Args: { p_credits: number; p_description?: string; p_user_id: string }
        Returns: boolean
      }
      validate_cnpj: {
        Args: { cnpj_input: string }
        Returns: boolean
      }
      validate_device_securely: {
        Args: {
          p_device_fingerprint: string
          p_ip_address: unknown
          p_user_agent?: string
        }
        Returns: Json
      }
      validate_device_ultra_secure: {
        Args: {
          p_browser_fingerprint?: string
          p_device_fingerprint: string
          p_ip_address: unknown
          p_localstorage_hash?: string
          p_user_agent?: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
