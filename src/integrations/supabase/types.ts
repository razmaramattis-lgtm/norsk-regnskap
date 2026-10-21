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
      account_templates: {
        Row: {
          kun_for: Database["public"]["Enums"]["company_type"] | null
          mva_kode: string | null
          name: string
          number: string
        }
        Insert: {
          kun_for?: Database["public"]["Enums"]["company_type"] | null
          mva_kode?: string | null
          name: string
          number: string
        }
        Update: {
          kun_for?: Database["public"]["Enums"]["company_type"] | null
          mva_kode?: string | null
          name?: string
          number?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          aktiv: boolean
          company_id: string
          id: string
          mva_kode: string | null
          name: string
          number: string
        }
        Insert: {
          aktiv?: boolean
          company_id: string
          id?: string
          mva_kode?: string | null
          name: string
          number: string
        }
        Update: {
          aktiv?: boolean
          company_id?: string
          id?: string
          mva_kode?: string | null
          name?: string
          number?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          adresse: string | null
          company_type: Database["public"]["Enums"]["company_type"]
          created_at: string
          created_by: string
          epost: string | null
          id: string
          kontonummer: string | null
          mva_registrert: boolean
          mva_termin: string
          name: string
          neste_bilagsnr: number
          neste_fakturanr: number
          org_nr: string | null
          postnr: string | null
          poststed: string | null
          regnskapsaar_start: number
        }
        Insert: {
          adresse?: string | null
          company_type?: Database["public"]["Enums"]["company_type"]
          created_at?: string
          created_by?: string
          epost?: string | null
          id?: string
          kontonummer?: string | null
          mva_registrert?: boolean
          mva_termin?: string
          name: string
          neste_bilagsnr?: number
          neste_fakturanr?: number
          org_nr?: string | null
          postnr?: string | null
          poststed?: string | null
          regnskapsaar_start?: number
        }
        Update: {
          adresse?: string | null
          company_type?: Database["public"]["Enums"]["company_type"]
          created_at?: string
          created_by?: string
          epost?: string | null
          id?: string
          kontonummer?: string | null
          mva_registrert?: boolean
          mva_termin?: string
          name?: string
          neste_bilagsnr?: number
          neste_fakturanr?: number
          org_nr?: string | null
          postnr?: string | null
          poststed?: string | null
          regnskapsaar_start?: number
        }
        Relationships: []
      }
      company_invites: {
        Row: {
          company_id: string
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          adresse: string | null
          betalingsfrist: number
          company_id: string
          created_at: string
          epost: string | null
          id: string
          land: string
          navn: string
          org_nr: string | null
          postnr: string | null
          poststed: string | null
        }
        Insert: {
          adresse?: string | null
          betalingsfrist?: number
          company_id: string
          created_at?: string
          epost?: string | null
          id?: string
          land?: string
          navn: string
          org_nr?: string | null
          postnr?: string | null
          poststed?: string | null
        }
        Update: {
          adresse?: string | null
          betalingsfrist?: number
          company_id?: string
          created_at?: string
          epost?: string | null
          id?: string
          land?: string
          navn?: string
          org_nr?: string | null
          postnr?: string | null
          poststed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          antall: number
          beskrivelse: string
          company_id: string
          enhetspris: number
          id: string
          invoice_id: string
          linjenr: number
          mva_sats: number
        }
        Insert: {
          antall?: number
          beskrivelse: string
          company_id: string
          enhetspris?: number
          id?: string
          invoice_id: string
          linjenr?: number
          mva_sats?: number
        }
        Update: {
          antall?: number
          beskrivelse?: string
          company_id?: string
          enhetspris?: number
          id?: string
          invoice_id?: string
          linjenr?: number
          mva_sats?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          betalt_voucher_id: string | null
          company_id: string
          created_at: string
          customer_id: string
          fakturadato: string
          fakturanr: number | null
          forfallsdato: string
          id: string
          kid: string | null
          merknad: string | null
          mva: number
          netto: number
          status: Database["public"]["Enums"]["invoice_status"]
          total: number
          voucher_id: string | null
        }
        Insert: {
          betalt_voucher_id?: string | null
          company_id: string
          created_at?: string
          customer_id: string
          fakturadato?: string
          fakturanr?: number | null
          forfallsdato?: string
          id?: string
          kid?: string | null
          merknad?: string | null
          mva?: number
          netto?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          total?: number
          voucher_id?: string | null
        }
        Update: {
          betalt_voucher_id?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          fakturadato?: string
          fakturanr?: number | null
          forfallsdato?: string
          id?: string
          kid?: string | null
          merknad?: string | null
          mva?: number
          netto?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          total?: number
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_betalt_voucher_id_fkey"
            columns: ["betalt_voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      voucher_lines: {
        Row: {
          company_id: string
          debet: number
          id: string
          konto: string
          kredit: number
          linjenr: number
          mva_kode: string | null
          tekst: string | null
          voucher_id: string
        }
        Insert: {
          company_id: string
          debet?: number
          id?: string
          konto: string
          kredit?: number
          linjenr?: number
          mva_kode?: string | null
          tekst?: string | null
          voucher_id: string
        }
        Update: {
          company_id?: string
          debet?: number
          id?: string
          konto?: string
          kredit?: number
          linjenr?: number
          mva_kode?: string | null
          tekst?: string | null
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_lines_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          beskrivelse: string
          bilagsnr: number | null
          bokfort_at: string | null
          bokfort_av: string | null
          company_id: string
          created_at: string
          created_by: string
          dato: string
          id: string
          kilde: string
          korrigerer: string | null
          status: Database["public"]["Enums"]["voucher_status"]
        }
        Insert: {
          beskrivelse?: string
          bilagsnr?: number | null
          bokfort_at?: string | null
          bokfort_av?: string | null
          company_id: string
          created_at?: string
          created_by?: string
          dato?: string
          id?: string
          kilde?: string
          korrigerer?: string | null
          status?: Database["public"]["Enums"]["voucher_status"]
        }
        Update: {
          beskrivelse?: string
          bilagsnr?: number | null
          bokfort_at?: string | null
          bokfort_av?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          dato?: string
          id?: string
          kilde?: string
          korrigerer?: string | null
          status?: Database["public"]["Enums"]["voucher_status"]
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_korrigerer_fkey"
            columns: ["korrigerer"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          company_id: string | null
          dato: string | null
          debet: number | null
          konto: string | null
          kredit: number | null
          mva_kode: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voucher_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_my_invites: { Args: never; Returns: number }
      can_write: { Args: { _company: string }; Returns: boolean }
      is_admin: { Args: { _company: string }; Returns: boolean }
      is_member: { Args: { _company: string }; Returns: boolean }
      kid_mod10: { Args: { _base: string }; Returns: string }
      post_voucher: { Args: { _voucher: string }; Returns: number }
      register_invoice_payment: {
        Args: { _dato: string; _invoice: string }
        Returns: string
      }
      reverse_voucher: { Args: { _voucher: string }; Returns: string }
      send_invoice: { Args: { _invoice: string }; Returns: number }
    }
    Enums: {
      company_type: "enk" | "as"
      invoice_status: "utkast" | "sendt" | "betalt" | "kreditert"
      member_role: "eier" | "admin" | "regnskapsforer" | "leser"
      voucher_status: "utkast" | "bokfort"
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
    Enums: {
      company_type: ["enk", "as"],
      invoice_status: ["utkast", "sendt", "betalt", "kreditert"],
      member_role: ["eier", "admin", "regnskapsforer", "leser"],
      voucher_status: ["utkast", "bokfort"],
    },
  },
} as const
