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
      anleggsmidler: {
        Row: {
          anskaffelseskost: number
          anskaffet: string
          company_id: string
          created_at: string
          id: string
          konto: string | null
          navn: string
          notat: string | null
          opprettet_av: string | null
          salgssum: number | null
          saldogruppe: string
          solgt: string | null
        }
        Insert: {
          anskaffelseskost: number
          anskaffet: string
          company_id: string
          created_at?: string
          id?: string
          konto?: string | null
          navn: string
          notat?: string | null
          opprettet_av?: string | null
          salgssum?: number | null
          saldogruppe: string
          solgt?: string | null
        }
        Update: {
          anskaffelseskost?: number
          anskaffet?: string
          company_id?: string
          created_at?: string
          id?: string
          konto?: string | null
          navn?: string
          notat?: string | null
          opprettet_av?: string | null
          salgssum?: number | null
          saldogruppe?: string
          solgt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anleggsmidler_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      maanedsavslutning_avkrysning: {
        Row: {
          company_id: string
          kontrollert_at: string
          kontrollert_av: string
          periode: string
          punkt: string
        }
        Insert: {
          company_id: string
          kontrollert_at?: string
          kontrollert_av?: string
          periode: string
          punkt: string
        }
        Update: {
          company_id?: string
          kontrollert_at?: string
          kontrollert_av?: string
          periode?: string
          punkt?: string
        }
        Relationships: [
          {
            foreignKeyName: "maanedsavslutning_avkrysning_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_keys: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_used_at: string | null
          navn: string
          prefix: string
          revoked_at: string | null
        }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: "agent_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_proposals: {
        Row: {
          agent_navn: string | null
          avgjort_at: string | null
          avgjort_av: string | null
          avvisningsgrunn: string | null
          bank_transaction_id: string | null
          begrunnelse: string | null
          company_id: string
          created_at: string
          id: string
          kilde: string
          opprettet_av: string | null
          payload: Json
          sikkerhet: number | null
          status: string
          tittel: string
          type: string
          voucher_id: string | null
        }
        Insert: {
          agent_navn?: string | null
          avgjort_at?: string | null
          avgjort_av?: string | null
          avvisningsgrunn?: string | null
          bank_transaction_id?: string | null
          begrunnelse?: string | null
          company_id: string
          created_at?: string
          id?: string
          kilde?: string
          opprettet_av?: string | null
          payload: Json
          sikkerhet?: number | null
          status?: string
          tittel: string
          type?: string
          voucher_id?: string | null
        }
        Update: {
          agent_navn?: string | null
          avgjort_at?: string | null
          avgjort_av?: string | null
          avvisningsgrunn?: string | null
          bank_transaction_id?: string | null
          begrunnelse?: string | null
          company_id?: string
          created_at?: string
          id?: string
          kilde?: string
          opprettet_av?: string | null
          payload?: Json
          sikkerhet?: number | null
          status?: string
          tittel?: string
          type?: string
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_proposals_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_proposals_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          aktiv: boolean
          company_id: string
          created_at: string
          enhet: string
          id: string
          mva_sats: number
          navn: string
          pris: number
          varenr: string | null
        }
        Insert: {
          aktiv?: boolean
          company_id: string
          created_at?: string
          enhet?: string
          id?: string
          mva_sats?: number
          navn: string
          pris?: number
          varenr?: string | null
        }
        Update: {
          aktiv?: boolean
          company_id?: string
          created_at?: string
          enhet?: string
          id?: string
          mva_sats?: number
          navn?: string
          pris?: number
          varenr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          company_id: string
          created_at: string
          detaljer: Json | null
          handling: string
          id: number
          objekt: string | null
          objekt_id: string | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          detaljer?: Json | null
          handling: string
          id?: number
          objekt?: string | null
          objekt_id?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          detaljer?: Json | null
          handling?: string
          id?: number
          objekt?: string | null
          objekt_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          bankkonto: string
          belop: number
          company_id: string
          created_at: string
          dato: string
          id: string
          import_hash: string | null
          referanse: string | null
          status: string
          tekst: string
          voucher_id: string | null
        }
        Insert: {
          bankkonto?: string
          belop: number
          company_id: string
          created_at?: string
          dato: string
          id?: string
          import_hash?: string | null
          referanse?: string | null
          status?: string
          tekst?: string
          voucher_id?: string | null
        }
        Update: {
          bankkonto?: string
          belop?: number
          company_id?: string
          created_at?: string
          dato?: string
          id?: string
          import_hash?: string | null
          referanse?: string | null
          status?: string
          tekst?: string
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          adresse: string | null
          aga_sone: string
          company_type: Database["public"]["Enums"]["company_type"]
          created_at: string
          created_by: string
          epost: string | null
          feriepengesats: number
          id: string
          kontonummer: string | null
          laast_til: string | null
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
          aga_sone?: string
          company_type?: Database["public"]["Enums"]["company_type"]
          created_at?: string
          created_by?: string
          epost?: string | null
          feriepengesats?: number
          id?: string
          kontonummer?: string | null
          laast_til?: string | null
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
          aga_sone?: string
          company_type?: Database["public"]["Enums"]["company_type"]
          created_at?: string
          created_by?: string
          epost?: string | null
          feriepengesats?: number
          id?: string
          kontonummer?: string | null
          laast_til?: string | null
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
      documents: {
        Row: {
          company_id: string
          created_at: string
          filnavn: string
          id: string
          lastet_opp_av: string | null
          mime: string | null
          oppbevares_til: string
          path: string
          sha256: string | null
          storrelse: number | null
          supplier_invoice_id: string | null
          voucher_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          filnavn: string
          id?: string
          lastet_opp_av?: string | null
          mime?: string | null
          oppbevares_til?: string
          path: string
          sha256?: string | null
          storrelse?: number | null
          supplier_invoice_id?: string | null
          voucher_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          filnavn?: string
          id?: string
          lastet_opp_av?: string | null
          mime?: string | null
          oppbevares_til?: string
          path?: string
          sha256?: string | null
          storrelse?: number | null
          supplier_invoice_id?: string | null
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          fodselsdato: string | null
          trekkmetode: string
          tabelltrekk: number
          trekktabell: string | null
          aktiv: boolean
          ansatt_dato: string | null
          company_id: string
          created_at: string
          epost: string | null
          id: string
          kontonummer: string | null
          lonnstype: string
          maanedslonn: number
          navn: string
          otp_prosent: number
          skattetrekk_prosent: number
          stilling: string | null
          stillingsprosent: number
          timelonn: number
        }
        Insert: {
          fodselsdato?: string | null
          trekkmetode?: string
          tabelltrekk?: number
          trekktabell?: string | null
          aktiv?: boolean
          ansatt_dato?: string | null
          company_id: string
          created_at?: string
          epost?: string | null
          id?: string
          kontonummer?: string | null
          lonnstype?: string
          maanedslonn?: number
          navn: string
          otp_prosent?: number
          skattetrekk_prosent?: number
          stilling?: string | null
          stillingsprosent?: number
          timelonn?: number
        }
        Update: {
          fodselsdato?: string | null
          trekkmetode?: string
          tabelltrekk?: number
          trekktabell?: string | null
          aktiv?: boolean
          ansatt_dato?: string | null
          company_id?: string
          created_at?: string
          epost?: string | null
          id?: string
          kontonummer?: string | null
          lonnstype?: string
          maanedslonn?: number
          navn?: string
          otp_prosent?: number
          skattetrekk_prosent?: number
          stilling?: string | null
          stillingsprosent?: number
          timelonn?: number
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      innsendinger: {
        Row: {
          company_id: string
          created_at: string
          dokument: string | null
          domene: string
          feil: Json | null
          id: string
          kvittering: Json | null
          objekt_id: string | null
          oppdatert_at: string
          opprettet_av: string | null
          payload: Json | null
          periode: string | null
          referanse: string | null
          sendt_at: string | null
          status: string
          type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          dokument?: string | null
          domene: string
          feil?: Json | null
          id?: string
          kvittering?: Json | null
          objekt_id?: string | null
          oppdatert_at?: string
          opprettet_av?: string | null
          payload?: Json | null
          periode?: string | null
          referanse?: string | null
          sendt_at?: string | null
          status?: string
          type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          dokument?: string | null
          domene?: string
          feil?: Json | null
          id?: string
          kvittering?: Json | null
          objekt_id?: string | null
          oppdatert_at?: string
          opprettet_av?: string | null
          payload?: Json | null
          periode?: string | null
          referanse?: string | null
          sendt_at?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "innsendinger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          company_id: string
          domene: string
          id: string
          konfig: Json
          leverandor: string | null
          miljo: string
          notat: string | null
          oppdatert_at: string
          oppdatert_av: string | null
          status: string
        }
        Insert: {
          company_id: string
          domene: string
          id?: string
          konfig?: Json
          leverandor?: string | null
          miljo?: string
          notat?: string | null
          oppdatert_at?: string
          oppdatert_av?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          domene?: string
          id?: string
          konfig?: Json
          leverandor?: string | null
          miljo?: string
          notat?: string | null
          oppdatert_at?: string
          oppdatert_av?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_company_id_fkey"
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
          er_kreditnota: boolean
          fakturadato: string
          fakturanr: number | null
          forfallsdato: string
          id: string
          kid: string | null
          kreditnota_for: string | null
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
          er_kreditnota?: boolean
          fakturadato?: string
          fakturanr?: number | null
          forfallsdato?: string
          id?: string
          kid?: string | null
          kreditnota_for?: string | null
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
          er_kreditnota?: boolean
          fakturadato?: string
          fakturanr?: number | null
          forfallsdato?: string
          id?: string
          kid?: string | null
          kreditnota_for?: string | null
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
            foreignKeyName: "invoices_kreditnota_for_fkey"
            columns: ["kreditnota_for"]
            isOneToOne: false
            referencedRelation: "invoices"
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
      payroll_lines: {
        Row: {
          naturalytelse: number
          godtgjorelse: number
          trekk: number
          poster: Json
          aga: number
          brutto: number
          company_id: string
          employee_id: string
          feriepenger: number
          id: string
          netto: number
          otp: number
          run_id: string
          skattetrekk: number
          tillegg: number
          timer: number
        }
        Insert: {
          naturalytelse?: number
          godtgjorelse?: number
          trekk?: number
          poster?: Json
          aga?: number
          brutto?: number
          company_id: string
          employee_id: string
          feriepenger?: number
          id?: string
          netto?: number
          otp?: number
          run_id: string
          skattetrekk?: number
          tillegg?: number
          timer?: number
        }
        Update: {
          naturalytelse?: number
          godtgjorelse?: number
          trekk?: number
          poster?: Json
          aga?: number
          brutto?: number
          company_id?: string
          employee_id?: string
          feriepenger?: number
          id?: string
          netto?: number
          otp?: number
          run_id?: string
          skattetrekk?: number
          tillegg?: number
          timer?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          halvt_trekk: boolean
          company_id: string
          created_at: string
          id: string
          periode: string
          status: string
          utbetalingsdato: string
          voucher_id: string | null
        }
        Insert: {
          halvt_trekk?: boolean
          company_id: string
          created_at?: string
          id?: string
          periode: string
          status?: string
          utbetalingsdato: string
          voucher_id?: string | null
        }
        Update: {
          halvt_trekk?: boolean
          company_id?: string
          created_at?: string
          id?: string
          periode?: string
          status?: string
          utbetalingsdato?: string
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_voucher_id_fkey"
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
      supplier_invoice_lines: {
        Row: {
          beskrivelse: string | null
          company_id: string
          id: string
          konto: string
          linjenr: number
          mva_sats: number
          netto: number
          supplier_invoice_id: string
        }
        Insert: {
          beskrivelse?: string | null
          company_id: string
          id?: string
          konto: string
          linjenr?: number
          mva_sats?: number
          netto?: number
          supplier_invoice_id: string
        }
        Update: {
          beskrivelse?: string | null
          company_id?: string
          id?: string
          konto?: string
          linjenr?: number
          mva_sats?: number
          netto?: number
          supplier_invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoice_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoice_lines_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          betalt_voucher_id: string | null
          company_id: string
          created_at: string
          fakturadato: string
          fakturanr: string | null
          forfallsdato: string
          id: string
          kid: string | null
          mva: number
          netto: number
          status: Database["public"]["Enums"]["supplier_invoice_status"]
          supplier_id: string
          total: number
          voucher_id: string | null
        }
        Insert: {
          betalt_voucher_id?: string | null
          company_id: string
          created_at?: string
          fakturadato?: string
          fakturanr?: string | null
          forfallsdato?: string
          id?: string
          kid?: string | null
          mva?: number
          netto?: number
          status?: Database["public"]["Enums"]["supplier_invoice_status"]
          supplier_id: string
          total?: number
          voucher_id?: string | null
        }
        Update: {
          betalt_voucher_id?: string | null
          company_id?: string
          created_at?: string
          fakturadato?: string
          fakturanr?: string | null
          forfallsdato?: string
          id?: string
          kid?: string | null
          mva?: number
          netto?: number
          status?: Database["public"]["Enums"]["supplier_invoice_status"]
          supplier_id?: string
          total?: number
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_betalt_voucher_id_fkey"
            columns: ["betalt_voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          adresse: string | null
          company_id: string
          created_at: string
          epost: string | null
          id: string
          kontonummer: string | null
          land: string
          navn: string
          org_nr: string | null
          postnr: string | null
          poststed: string | null
          standard_konto: string | null
        }
        Insert: {
          adresse?: string | null
          company_id: string
          created_at?: string
          epost?: string | null
          id?: string
          kontonummer?: string | null
          land?: string
          navn: string
          org_nr?: string | null
          postnr?: string | null
          poststed?: string | null
          standard_konto?: string | null
        }
        Update: {
          adresse?: string | null
          company_id?: string
          created_at?: string
          epost?: string | null
          id?: string
          kontonummer?: string | null
          land?: string
          navn?: string
          org_nr?: string | null
          postnr?: string | null
          poststed?: string | null
          standard_konto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      agent_foreslaa_bilag: {
        Args: {
          _agent_navn?: string
          _bank_transaction_id?: string
          _begrunnelse: string
          _key: string
          _payload: Json
          _sikkerhet?: number
          _tittel: string
        }
        Returns: string
      }
      agent_hent_banktransaksjoner: { Args: { _grense?: number; _key: string }; Returns: Json }
      agent_hent_kontoplan: { Args: { _key: string }; Returns: Json }
      approve_proposal: { Args: { _id: string }; Returns: string }
      byraa_oversikt: {
        Args: never
        Returns: {
          bilagsutkast: number
          company_id: string
          forfalt_kundebelop: number
          forfalt_leverandorbelop: number
          forfalte_kundefakturaer: number
          forfalte_leverandorfakturaer: number
          har_ansatte: boolean
          siste_bilagsdato: string
          siste_bokforte_bilagsdato: string
          ubehandlede_banktransaksjoner: number
          ventende_forslag: number
        }[]
      }
      create_agent_key: { Args: { _company: string; _navn: string }; Returns: string }
      revoke_agent_key: { Args: { _id: string }; Returns: undefined }
      book_bank_transaction: {
        Args: {
          _invoice: string
          _motkonto: string
          _mva_sats: number
          _supplier_invoice: string
          _tx: string
        }
        Returns: string
      }
      book_payroll: { Args: { _run: string }; Returns: string }
      book_supplier_invoice: { Args: { _inv: string }; Returns: string }
      can_write: { Args: { _company: string }; Returns: boolean }
      close_year: { Args: { _aar: number; _company: string }; Returns: string }
      credit_invoice: { Args: { _invoice: string }; Returns: string }
      is_admin: { Args: { _company: string }; Returns: boolean }
      is_member: { Args: { _company: string }; Returns: boolean }
      kid_mod10: { Args: { _base: string }; Returns: string }
      log_audit: {
        Args: {
          _company: string
          _det: Json
          _handling: string
          _id: string
          _objekt: string
        }
        Returns: undefined
      }
      pay_supplier_invoice: {
        Args: { _dato: string; _inv: string }
        Returns: string
      }
      post_voucher: { Args: { _voucher: string }; Returns: number }
      reject_proposal: {
        Args: { _grunn?: string; _id: string }
        Returns: undefined
      }
      register_invoice_payment: {
        Args: { _dato: string; _invoice: string }
        Returns: string
      }
      reverse_voucher: { Args: { _voucher: string }; Returns: string }
      send_invoice: { Args: { _invoice: string }; Returns: number }
      set_period_lock: {
        Args: { _company: string; _dato: string }
        Returns: undefined
      }
    }
    Enums: {
      company_type: "enk" | "as"
      invoice_status: "utkast" | "sendt" | "betalt" | "kreditert"
      member_role: "eier" | "admin" | "regnskapsforer" | "leser"
      supplier_invoice_status: "utkast" | "bokfort" | "betalt"
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
      supplier_invoice_status: ["utkast", "bokfort", "betalt"],
      voucher_status: ["utkast", "bokfort"],
    },
  },
} as const
