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
      activation_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          reference: string
          sponsor_id: string | null
          sponsor_markup: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          reference: string
          sponsor_id?: string | null
          sponsor_markup?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          reference?: string
          sponsor_id?: string | null
          sponsor_markup?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          revoked?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked?: boolean
          user_id?: string
        }
        Relationships: []
      }
      data_packages: {
        Row: {
          active: boolean
          agent_price: number
          created_at: string
          id: string
          network: Database["public"]["Enums"]["network_type"]
          price: number
          size_label: string
          size_mb: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          agent_price: number
          created_at?: string
          id?: string
          network: Database["public"]["Enums"]["network_type"]
          price: number
          size_label: string
          size_mb: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          agent_price?: number
          created_at?: string
          id?: string
          network?: Database["public"]["Enums"]["network_type"]
          price?: number
          size_label?: string
          size_mb?: number
          sort_order?: number
        }
        Relationships: []
      }
      notification_dismissals: {
        Row: {
          dismissed_at: string
          notification_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          notification_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_dismissals_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          sponsor_id: string | null
          store_activated_at: string | null
          subagent_activated_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          sponsor_id?: string | null
          store_activated_at?: string | null
          subagent_activated_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          sponsor_id?: string | null
          store_activated_at?: string | null
          subagent_activated_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      result_checkers: {
        Row: {
          active: boolean
          agent_price: number
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
        }
        Insert: {
          active?: boolean
          agent_price: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price: number
        }
        Update: {
          active?: boolean
          agent_price?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: number
          maintenance_mode: boolean
          store_activation_enabled: boolean
          store_activation_fee: number
          subagent_activation_base_fee: number
          subagent_activation_enabled: boolean
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_url: string | null
        }
        Insert: {
          id?: number
          maintenance_mode?: boolean
          store_activation_enabled?: boolean
          store_activation_fee?: number
          subagent_activation_base_fee?: number
          subagent_activation_enabled?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_url?: string | null
        }
        Update: {
          id?: number
          maintenance_mode?: boolean
          store_activation_enabled?: boolean
          store_activation_fee?: number
          subagent_activation_base_fee?: number
          subagent_activation_enabled?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_url?: string | null
        }
        Relationships: []
      }
      store_package_prices: {
        Row: {
          id: string
          package_id: string
          price: number
          store_id: string
        }
        Insert: {
          id?: string
          package_id: string
          price: number
          store_id: string
        }
        Update: {
          id?: string
          package_id?: string
          price?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_package_prices_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "data_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_package_prices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          slug: string
          sponsor_id: string | null
          support_phone: string
          support_whatsapp: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
          sponsor_id?: string | null
          support_phone: string
          support_whatsapp?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sponsor_id?: string | null
          support_phone?: string
          support_whatsapp?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subagent_activation_markup: {
        Row: {
          created_at: string
          markup: number
          sponsor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          markup?: number
          sponsor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          markup?: number
          sponsor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subagent_prices: {
        Row: {
          created_at: string
          id: string
          package_id: string
          price: number
          sponsor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          price: number
          sponsor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          price?: number
          sponsor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subagent_prices_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "data_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      subagents: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone: string
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          gateway_event_id: string | null
          id: string
          metadata: Json | null
          network: Database["public"]["Enums"]["network_type"] | null
          package_id: string | null
          recipient_phone: string | null
          reference: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          gateway_event_id?: string | null
          id?: string
          metadata?: Json | null
          network?: Database["public"]["Enums"]["network_type"] | null
          package_id?: string | null
          recipient_phone?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          gateway_event_id?: string | null
          id?: string
          metadata?: Json | null
          network?: Database["public"]["Enums"]["network_type"] | null
          package_id?: string | null
          recipient_phone?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "data_packages"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          account_name: string
          account_number: string
          admin_note: string | null
          amount: number
          available_at: string
          bank_name: string
          created_at: string
          id: string
          momo_network: string | null
          source: string
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          admin_note?: string | null
          amount: number
          available_at?: string
          bank_name: string
          created_at?: string
          id?: string
          momo_network?: string | null
          source?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          admin_note?: string | null
          amount?: number
          available_at?: string
          bank_name?: string
          created_at?: string
          id?: string
          momo_network?: string | null
          source?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
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
      complete_wallet_topup: {
        Args: {
          _channel: string
          _gateway_event_id: string
          _reference: string
        }
        Returns: undefined
      }
      credit_wallet: {
        Args: {
          _amount: number
          _description: string
          _reference: string
          _user_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_activation_completed: {
        Args: { _reference: string }
        Returns: undefined
      }
      mark_store_order_paid: {
        Args: {
          _channel: string
          _gateway_event_id: string
          _reference: string
        }
        Returns: string
      }
      purchase_checker:
        | { Args: { _checker_id: string; _user_id: string }; Returns: string }
        | {
            Args: { _checker_id: string; _phone?: string; _user_id: string }
            Returns: string
          }
      purchase_data: {
        Args: { _package_id: string; _phone: string; _user_id: string }
        Returns: string
      }
      request_store_withdrawal: {
        Args: {
          _amount: number
          _momo_name: string
          _momo_network: string
          _momo_number: string
          _user_id: string
        }
        Returns: string
      }
      request_withdrawal: {
        Args: {
          _account: string
          _amount: number
          _bank: string
          _name: string
          _user_id: string
        }
        Returns: string
      }
      sponsor_activation_earnings: {
        Args: { _user_id: string }
        Returns: number
      }
      sponsor_profit_total: { Args: { _user_id: string }; Returns: number }
      store_profit_available: { Args: { _user_id: string }; Returns: number }
      store_profit_total: { Args: { _user_id: string }; Returns: number }
      store_tx_cost: { Args: { _tx_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
      network_type:
        | "mtn"
        | "airteltigo_ishare"
        | "airteltigo_bigtime"
        | "telecel"
      transaction_status:
        | "pending_payment"
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "refunded"
      transaction_type:
        | "wallet_topup"
        | "data_purchase"
        | "checker_purchase"
        | "store_sale"
        | "withdrawal"
        | "refund"
      withdrawal_status: "pending" | "approved" | "paid" | "rejected"
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
      app_role: ["admin", "user"],
      network_type: [
        "mtn",
        "airteltigo_ishare",
        "airteltigo_bigtime",
        "telecel",
      ],
      transaction_status: [
        "pending_payment",
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
      ],
      transaction_type: [
        "wallet_topup",
        "data_purchase",
        "checker_purchase",
        "store_sale",
        "withdrawal",
        "refund",
      ],
      withdrawal_status: ["pending", "approved", "paid", "rejected"],
    },
  },
} as const
