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
      app_users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_by: string | null
          is_active: boolean
          permissions: string[]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_type: Database["public"]["Enums"]["app_user_type"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          invited_by?: string | null
          is_active?: boolean
          permissions?: string[]
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_type: Database["public"]["Enums"]["app_user_type"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          permissions?: string[]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_type?: Database["public"]["Enums"]["app_user_type"]
        }
        Relationships: []
      }
      agents: {
        Row: {
          created_at: string
          id: string
          knowledge_base: string | null
          modules: string[] | null
          name: string
          role: string
          system_prompt: string
          updated_at: string
          whatsapp_display_name: string | null
          whatsapp_phone: string | null
          whatsapp_profile_picture_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          knowledge_base?: string | null
          modules?: string[] | null
          name: string
          role: string
          system_prompt: string
          updated_at?: string
          whatsapp_display_name?: string | null
          whatsapp_phone?: string | null
          whatsapp_profile_picture_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          knowledge_base?: string | null
          modules?: string[] | null
          name?: string
          role?: string
          system_prompt?: string
          updated_at?: string
          whatsapp_display_name?: string | null
          whatsapp_phone?: string | null
          whatsapp_profile_picture_url?: string | null
        }
        Relationships: []
      }
      captacao_items: {
        Row: {
          created_at: string
          custom_data: Json
          dedupe_key: string | null
          external_id: string | null
          funnel_id: string | null
          id: string
          listing_url: string | null
          preview: string | null
          source: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_data?: Json
          dedupe_key?: string | null
          external_id?: string | null
          funnel_id?: string | null
          id?: string
          listing_url?: string | null
          preview?: string | null
          source?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_data?: Json
          dedupe_key?: string | null
          external_id?: string | null
          funnel_id?: string | null
          id?: string
          listing_url?: string | null
          preview?: string | null
          source?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captacao_items_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          agent: string
          content: string
          created_at: string
          id: string
          is_system: boolean
          role: string
          thread_id: string
        }
        Insert: {
          agent: string
          content: string
          created_at?: string
          id?: string
          is_system?: boolean
          role: string
          thread_id: string
        }
        Update: {
          agent?: string
          content?: string
          created_at?: string
          id?: string
          is_system?: boolean
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["thread_id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          agent_ids: string[]
          created_at: string
          custom_data: Json
          funnel_id: string | null
          last_message_at: string
          phone: string | null
          person_id: string | null
          preview: string | null
          score: number | null
          status: string | null
          thread_id: string
          thread_kind: string
          title: string
          unread: boolean
          updated_at: string
        }
        Insert: {
          agent_ids?: string[]
          created_at?: string
          custom_data?: Json
          funnel_id?: string | null
          last_message_at?: string
          phone?: string | null
          person_id?: string | null
          preview?: string | null
          score?: number | null
          status?: string | null
          thread_id: string
          thread_kind?: string
          title: string
          unread?: boolean
          updated_at?: string
        }
        Update: {
          agent_ids?: string[]
          created_at?: string
          custom_data?: Json
          funnel_id?: string | null
          last_message_at?: string
          phone?: string | null
          person_id?: string | null
          preview?: string | null
          score?: number | null
          status?: string | null
          thread_id?: string
          thread_kind?: string
          title?: string
          unread?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          created_at: string
          id: string
          name: string
          options: string[] | null
          required: boolean | null
          target_entity: string
          type: Database["public"]["Enums"]["custom_field_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          options?: string[] | null
          required?: boolean | null
          target_entity: string
          type: Database["public"]["Enums"]["custom_field_type"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          options?: string[] | null
          required?: boolean | null
          target_entity?: string
          type?: Database["public"]["Enums"]["custom_field_type"]
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          file_extension: string | null
          file_name: string
          file_path: string
          file_size_bytes: number | null
          file_url: string
          id: string
          mime_type: string | null
          person_id: string | null
          property_id: string | null
          tags: string[]
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_extension?: string | null
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          person_id?: string | null
          property_id?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          file_extension?: string | null
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          person_id?: string | null
          property_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          created_at: string
          description: string | null
          file_url: string
          id: string
          process_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_url: string
          id?: string
          process_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_url?: string
          id?: string
          process_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "client_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_processes: {
        Row: {
          client_user_id: string
          created_at: string
          id: string
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_user_id: string
          created_at?: string
          id?: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_user_id?: string
          created_at?: string
          id?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_processes_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          color: string | null
          created_at: string
          funnel_id: string
          id: string
          order: number
          title: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          funnel_id: string
          id?: string
          order?: number
          title: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          funnel_id?: string
          id?: string
          order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stage_people_rules: {
        Row: {
          add_roles: Database["public"]["Enums"]["person_role"][]
          add_tags: string[]
          created_at: string
          funnel_id: string
          id: string
          points_delta: number
          remove_roles: Database["public"]["Enums"]["person_role"][]
          remove_tags: string[]
          stage_id: string | null
          stage_title: string
          updated_at: string
        }
        Insert: {
          add_roles?: Database["public"]["Enums"]["person_role"][]
          add_tags?: string[]
          created_at?: string
          funnel_id: string
          id?: string
          points_delta?: number
          remove_roles?: Database["public"]["Enums"]["person_role"][]
          remove_tags?: string[]
          stage_id?: string | null
          stage_title: string
          updated_at?: string
        }
        Update: {
          add_roles?: Database["public"]["Enums"]["person_role"][]
          add_tags?: string[]
          created_at?: string
          funnel_id?: string
          id?: string
          points_delta?: number
          remove_roles?: Database["public"]["Enums"]["person_role"][]
          remove_tags?: string[]
          stage_id?: string | null
          stage_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stage_people_rules_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_stage_people_rules_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          agent_id: string | null
          content: string
          created_at: string
          id: string
          is_system: boolean | null
          person_id: string | null
          role: string
        }
        Insert: {
          agent_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          person_id?: string | null
          role: string
        }
        Update: {
          agent_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          person_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          cover_image: string | null
          created_at: string
          custom_data: Json | null
          description: string
          id: string
          images: string[] | null
          landing_page: Json | null
          map_embed_url: string | null
          price: number
          slug: string
          status: Database["public"]["Enums"]["property_status"]
          title: string
          updated_at: string
        }
        Insert: {
          address: string
          cover_image?: string | null
          created_at?: string
          custom_data?: Json | null
          description: string
          id?: string
          images?: string[] | null
          landing_page?: Json | null
          map_embed_url?: string | null
          price: number
          slug: string
          status?: Database["public"]["Enums"]["property_status"]
          title: string
          updated_at?: string
        }
        Update: {
          address?: string
          cover_image?: string | null
          created_at?: string
          custom_data?: Json | null
          description?: string
          id?: string
          images?: string[] | null
          landing_page?: Json | null
          map_embed_url?: string | null
          price?: number
          slug?: string
          status?: Database["public"]["Enums"]["property_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          crm_funnel_id: string | null
          crm_score: number
          crm_status: string | null
          crm_unread: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          last_interaction_preview: string | null
          metadata: Json
          origin: string | null
          primary_phone: string | null
          roles: Database["public"]["Enums"]["person_role"][]
          stage_points: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          crm_funnel_id?: string | null
          crm_score?: number
          crm_status?: string | null
          crm_unread?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          last_interaction_preview?: string | null
          metadata?: Json
          origin?: string | null
          primary_phone?: string | null
          roles?: Database["public"]["Enums"]["person_role"][]
          stage_points?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          crm_funnel_id?: string | null
          crm_score?: number
          crm_status?: string | null
          crm_unread?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          last_interaction_preview?: string | null
          metadata?: Json
          origin?: string | null
          primary_phone?: string | null
          roles?: Database["public"]["Enums"]["person_role"][]
          stage_points?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_crm_funnel_id_fkey"
            columns: ["crm_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_internal_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "broker" | "client"
      app_user_type: "internal" | "client"
      custom_field_type: "text" | "number" | "dropdown" | "date"
      person_role: "lead" | "client" | "buyer" | "seller"
      property_status: "active" | "inactive" | "sold"
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
      custom_field_type: ["text", "number", "dropdown", "date"],
      person_role: ["lead", "client", "buyer", "seller"],
      property_status: ["active", "inactive", "sold"],
    },
  },
} as const
