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
      alerts: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          is_active: boolean
          is_read: boolean
          priority: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          is_active?: boolean
          is_read?: boolean
          priority?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          is_active?: boolean
          is_read?: boolean
          priority?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          check_in: string
          check_out: string | null
          created_at: string
          employee_id: string
          hours_worked: number | null
          id: string
          user_id: string
        }
        Insert: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          employee_id: string
          hours_worked?: number | null
          id?: string
          user_id: string
        }
        Update: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          employee_id?: string
          hours_worked?: number | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_sessions: {
        Row: {
          created_at: string
          expires_at: string
          kiosk_user_id: string
          role: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          kiosk_user_id: string
          role?: string
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          kiosk_user_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_sessions_kiosk_user_id_fkey"
            columns: ["kiosk_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          daily_rate: number
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_rate?: number
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_rate?: number
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          photo_url: string | null
          price: number
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          photo_url?: string | null
          price?: number
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          photo_url?: string | null
          price?: number
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          delivered: boolean
          id: string
          menu_item_id: string | null
          name: string
          notes: string | null
          order_id: string
          price: number
          quantity: number
        }
        Insert: {
          created_at?: string
          delivered?: boolean
          id?: string
          menu_item_id?: string | null
          name: string
          notes?: string | null
          order_id: string
          price: number
          quantity: number
        }
        Update: {
          created_at?: string
          delivered?: boolean
          id?: string
          menu_item_id?: string | null
          name?: string
          notes?: string | null
          order_id?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          closed_at: string | null
          created_at: string
          customer_cpf: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          notes: string | null
          payment_method: string | null
          status: string
          table_number: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          status?: string
          table_number: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          status?: string
          table_number?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          payment_date: string
          period_end: string | null
          period_start: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          period_end?: string | null
          period_start?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          period_end?: string | null
          period_start?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          cost_price: number
          created_at: string
          expiry_date: string | null
          id: string
          is_active: boolean
          min_quantity: number
          name: string
          photo_url: string | null
          quantity: number
          sell_price: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number
          name: string
          photo_url?: string | null
          quantity?: number
          sell_price?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number
          name?: string
          photo_url?: string | null
          quantity?: number
          sell_price?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          display_name: string
          employee_password: string | null
          id: string
          is_pro: boolean
          kiosk_code: string | null
          kiosk_name: string
          kitchen_password: string | null
          phone: string | null
          updated_at: string
          waiter_code: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          employee_password?: string | null
          id: string
          is_pro?: boolean
          kiosk_code?: string | null
          kiosk_name?: string
          kitchen_password?: string | null
          phone?: string | null
          updated_at?: string
          waiter_code?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          employee_password?: string | null
          id?: string
          is_pro?: boolean
          kiosk_code?: string | null
          kiosk_name?: string
          kitchen_password?: string | null
          phone?: string | null
          updated_at?: string
          waiter_code?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          recurrence: string
          reminder_date: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          recurrence?: string
          reminder_date: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          recurrence?: string
          reminder_date?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          total_price: number
          transaction_id: string
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          total_price?: number
          transaction_id: string
          unit_price?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          total_price?: number
          transaction_id?: string
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          reason: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          reason?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          reason?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_purchases: {
        Row: {
          created_at: string
          id: string
          items: string
          notes: string | null
          purchase_date: string
          supplier_id: string | null
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: string
          notes?: string | null
          purchase_date?: string
          supplier_id?: string | null
          total_amount?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: string
          notes?: string | null
          purchase_date?: string
          supplier_id?: string | null
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          product_description: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          product_description?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          product_description?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          id: string
          payment_method: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          payment_method?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          payment_method?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _recalc_order_total: { Args: { _order_id: string }; Returns: undefined }
      _verify_employee: {
        Args: { _kiosk_code: string; _password: string }
        Returns: string
      }
      _verify_employee_token: { Args: { _token: string }; Returns: string }
      employee_cancel_order_v2: {
        Args: { _order_id: string; _token: string }
        Returns: undefined
      }
      employee_close_order_v2: {
        Args: { _order_id: string; _payment_method: string; _token: string }
        Returns: undefined
      }
      employee_get_kitchen_orders_v2: {
        Args: { _token: string }
        Returns: Json
      }
      employee_get_menu_v2: {
        Args: { _token: string }
        Returns: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          photo_url: string | null
          price: number
          sort_order: number
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "menu_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      employee_login:
        | { Args: { _kiosk_code: string; _password: string }; Returns: Json }
        | {
            Args: { _kiosk_code: string; _password: string; _role?: string }
            Returns: Json
          }
      employee_logout: { Args: { _token: string }; Returns: undefined }
      employee_place_order_v2: {
        Args: {
          _customer_name: string
          _items: Json
          _notes?: string
          _table_number: string
          _token: string
        }
        Returns: string
      }
      employee_remove_order_item_v2: {
        Args: { _item_id: string; _token: string }
        Returns: undefined
      }
      employee_set_item_delivered_v2: {
        Args: { _delivered: boolean; _item_id: string; _token: string }
        Returns: undefined
      }
      employee_update_item_quantity_v2: {
        Args: { _item_id: string; _quantity: number; _token: string }
        Returns: undefined
      }
      employee_update_order_status_v2: {
        Args: { _order_id: string; _status: string; _token: string }
        Returns: undefined
      }
      place_order: {
        Args: {
          _customer_cpf: string
          _customer_name: string
          _customer_phone: string
          _items: Json
          _kiosk_user_id: string
          _notes?: string
          _table_number: string
          _waiter_code: string
        }
        Returns: string
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
