export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      building_specifications: {
        Row: {
          appliance_specifications: Json | null
          cabinetry_specifications: Json | null
          concrete_requirements: Json | null
          created_at: string | null
          electrical_specifications: Json | null
          exterior_materials: Json | null
          flooring_specifications: Json | null
          foundation_dimensions: Json | null
          foundation_type: string | null
          framing_type: string | null
          hvac_specifications: Json | null
          id: string
          interior_finishes: Json | null
          lumber_specifications: Json | null
          plumbing_specifications: Json | null
          project_id: string | null
          roof_specifications: Json | null
          structural_loads: Json | null
          updated_at: string | null
          wall_specifications: Json | null
          window_door_specifications: Json | null
        }
        Insert: {
          appliance_specifications?: Json | null
          cabinetry_specifications?: Json | null
          concrete_requirements?: Json | null
          created_at?: string | null
          electrical_specifications?: Json | null
          exterior_materials?: Json | null
          flooring_specifications?: Json | null
          foundation_dimensions?: Json | null
          foundation_type?: string | null
          framing_type?: string | null
          hvac_specifications?: Json | null
          id?: string
          interior_finishes?: Json | null
          lumber_specifications?: Json | null
          plumbing_specifications?: Json | null
          project_id?: string | null
          roof_specifications?: Json | null
          structural_loads?: Json | null
          updated_at?: string | null
          wall_specifications?: Json | null
          window_door_specifications?: Json | null
        }
        Update: {
          appliance_specifications?: Json | null
          cabinetry_specifications?: Json | null
          concrete_requirements?: Json | null
          created_at?: string | null
          electrical_specifications?: Json | null
          exterior_materials?: Json | null
          flooring_specifications?: Json | null
          foundation_dimensions?: Json | null
          foundation_type?: string | null
          framing_type?: string | null
          hvac_specifications?: Json | null
          id?: string
          interior_finishes?: Json | null
          lumber_specifications?: Json | null
          plumbing_specifications?: Json | null
          project_id?: string | null
          roof_specifications?: Json | null
          structural_loads?: Json | null
          updated_at?: string | null
          wall_specifications?: Json | null
          window_door_specifications?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "building_specifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      document_categories: {
        Row: {
          category_type: string
          created_at: string | null
          description: string | null
          file_types_allowed: string[] | null
          id: string
          max_file_size_mb: number | null
          name: string
          required_for_phases: string[] | null
        }
        Insert: {
          category_type: string
          created_at?: string | null
          description?: string | null
          file_types_allowed?: string[] | null
          id?: string
          max_file_size_mb?: number | null
          name: string
          required_for_phases?: string[] | null
        }
        Update: {
          category_type?: string
          created_at?: string | null
          description?: string | null
          file_types_allowed?: string[] | null
          id?: string
          max_file_size_mb?: number | null
          name?: string
          required_for_phases?: string[] | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          document_type: string | null
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          is_current_version: boolean | null
          metadata: Json | null
          mime_type: string | null
          phase_id: string | null
          project_id: string | null
          supersedes_document_id: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          uploaded_by: string | null
          version_number: number | null
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          document_type?: string | null
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          is_current_version?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          phase_id?: string | null
          project_id?: string | null
          supersedes_document_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          uploaded_by?: string | null
          version_number?: number | null
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          document_type?: string | null
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          is_current_version?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          phase_id?: string | null
          project_id?: string | null
          supersedes_document_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          uploaded_by?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_supersedes_document_id_fkey"
            columns: ["supersedes_document_id"]
            isOneToOne: false
            referencedRelation: "project_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      project_measurements: {
        Row: {
          calculation_method: string | null
          confidence_level: string | null
          created_at: string | null
          id: string
          measurement_category: string
          measurement_name: string
          measurement_unit: string
          measurement_value: number
          notes: string | null
          phase_id: string | null
          project_id: string | null
          source_document_id: string | null
          total_with_waste: number | null
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
          waste_factor: number | null
        }
        Insert: {
          calculation_method?: string | null
          confidence_level?: string | null
          created_at?: string | null
          id?: string
          measurement_category: string
          measurement_name: string
          measurement_unit: string
          measurement_value: number
          notes?: string | null
          phase_id?: string | null
          project_id?: string | null
          source_document_id?: string | null
          total_with_waste?: number | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          waste_factor?: number | null
        }
        Update: {
          calculation_method?: string | null
          confidence_level?: string | null
          created_at?: string | null
          id?: string
          measurement_category?: string
          measurement_name?: string
          measurement_unit?: string
          measurement_value?: number
          notes?: string | null
          phase_id?: string | null
          project_id?: string | null
          source_document_id?: string | null
          total_with_waste?: number | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
          waste_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_measurements_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_measurements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          id: string
          joined_at: string
          permissions: string[] | null
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          permissions?: string[] | null
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          permissions?: string[] | null
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          created_at: string
          dependencies: string[] | null
          end_date: string | null
          estimated_duration_days: number | null
          id: string
          phase_name: string
          phase_order: number
          project_id: string
          start_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dependencies?: string[] | null
          end_date?: string | null
          estimated_duration_days?: number | null
          id?: string
          phase_name: string
          phase_order: number
          project_id: string
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dependencies?: string[] | null
          end_date?: string | null
          estimated_duration_days?: number | null
          id?: string
          phase_name?: string
          phase_order?: number
          project_id?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_requirements: {
        Row: {
          category_id: string | null
          created_at: string | null
          id: string
          is_required: boolean | null
          measurement_unit: string | null
          notes: string | null
          phase_id: string | null
          priority: string | null
          project_id: string | null
          requirement_name: string
          requirement_type: string
          updated_at: string | null
          value_boolean: boolean | null
          value_date: string | null
          value_file_id: string | null
          value_jsonb: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          measurement_unit?: string | null
          notes?: string | null
          phase_id?: string | null
          priority?: string | null
          project_id?: string | null
          requirement_name: string
          requirement_type: string
          updated_at?: string | null
          value_boolean?: boolean | null
          value_date?: string | null
          value_file_id?: string | null
          value_jsonb?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          measurement_unit?: string | null
          notes?: string | null
          phase_id?: string | null
          priority?: string | null
          project_id?: string | null
          requirement_name?: string
          requirement_type?: string
          updated_at?: string | null
          value_boolean?: boolean | null
          value_date?: string | null
          value_file_id?: string | null
          value_jsonb?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_requirements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vendor_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_requirements_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          completed_date: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_cost: number | null
          id: string
          phase_id: string | null
          priority: string | null
          project_id: string
          status: string | null
          task_name: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          id?: string
          phase_id?: string | null
          priority?: string | null
          project_id: string
          status?: string | null
          task_name: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          id?: string
          phase_id?: string | null
          priority?: string | null
          project_id?: string
          status?: string | null
          task_name?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          architectural_style: string | null
          bathrooms: number | null
          bedrooms: number | null
          budget: number | null
          city: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          lot_size_acres: number | null
          name: string
          owner_id: string
          project_type: string | null
          square_footage: number | null
          start_date: string | null
          state: string | null
          status: string | null
          stories: number | null
          timeline: Json | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          architectural_style?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          budget?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          lot_size_acres?: number | null
          name: string
          owner_id: string
          project_type?: string | null
          square_footage?: number | null
          start_date?: string | null
          state?: string | null
          status?: string | null
          stories?: number | null
          timeline?: Json | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          architectural_style?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          budget?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          lot_size_acres?: number | null
          name?: string
          owner_id?: string
          project_type?: string | null
          square_footage?: number | null
          start_date?: string | null
          state?: string | null
          status?: string | null
          stories?: number | null
          timeline?: Json | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      site_information: {
        Row: {
          access_routes: Json | null
          building_codes: Json | null
          created_at: string | null
          environmental_factors: Json | null
          flood_zone: string | null
          hoa_restrictions: Json | null
          id: string
          project_id: string | null
          property_survey: Json | null
          septic_location: unknown | null
          setback_requirements: Json | null
          soil_bearing_capacity: number | null
          soil_conditions: Json | null
          topographic_data: Json | null
          updated_at: string | null
          utility_locations: Json | null
          water_table_depth: number | null
          well_location: unknown | null
          zoning_classification: string | null
        }
        Insert: {
          access_routes?: Json | null
          building_codes?: Json | null
          created_at?: string | null
          environmental_factors?: Json | null
          flood_zone?: string | null
          hoa_restrictions?: Json | null
          id?: string
          project_id?: string | null
          property_survey?: Json | null
          septic_location?: unknown | null
          setback_requirements?: Json | null
          soil_bearing_capacity?: number | null
          soil_conditions?: Json | null
          topographic_data?: Json | null
          updated_at?: string | null
          utility_locations?: Json | null
          water_table_depth?: number | null
          well_location?: unknown | null
          zoning_classification?: string | null
        }
        Update: {
          access_routes?: Json | null
          building_codes?: Json | null
          created_at?: string | null
          environmental_factors?: Json | null
          flood_zone?: string | null
          hoa_restrictions?: Json | null
          id?: string
          project_id?: string | null
          property_survey?: Json | null
          septic_location?: unknown | null
          setback_requirements?: Json | null
          soil_bearing_capacity?: number | null
          soil_conditions?: Json | null
          topographic_data?: Json | null
          updated_at?: string | null
          utility_locations?: Json | null
          water_table_depth?: number | null
          well_location?: unknown | null
          zoning_classification?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_information_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_categories: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          phase: string
          subcategory: string | null
          typical_cost: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          phase: string
          subcategory?: string | null
          typical_cost?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          phase?: string
          subcategory?: string | null
          typical_cost?: string | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          ai_generated: boolean | null
          business_name: string
          category_id: string
          city: string | null
          contact_name: string | null
          cost_estimate_avg: number | null
          cost_estimate_high: number | null
          cost_estimate_low: number | null
          created_at: string
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          project_id: string
          rating: number | null
          review_count: number | null
          state: string | null
          status: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          ai_generated?: boolean | null
          business_name: string
          category_id: string
          city?: string | null
          contact_name?: string | null
          cost_estimate_avg?: number | null
          cost_estimate_high?: number | null
          cost_estimate_low?: number | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          project_id: string
          rating?: number | null
          review_count?: number | null
          state?: string | null
          status?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          ai_generated?: boolean | null
          business_name?: string
          category_id?: string
          city?: string | null
          contact_name?: string | null
          cost_estimate_avg?: number | null
          cost_estimate_high?: number | null
          cost_estimate_low?: number | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          project_id?: string
          rating?: number | null
          review_count?: number | null
          state?: string | null
          status?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vendor_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_project_access: {
        Args: { project_uuid: string; user_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "owner_builder" | "contractor" | "crew_member" | "admin"
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
      user_role: ["owner_builder", "contractor", "crew_member", "admin"],
    },
  },
} as const
