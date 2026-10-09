// Généré par `supabase gen types typescript` depuis le projet lié. Ne pas modifier à la main :
// régénérer après chaque migration avec `npm run db:types`.

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
      prospects: {
        Row: {
          ca_recuperable_eur: number | null
          contact_email: string | null
          contact_nom: string | null
          contact_telephone: string | null
          cree_le: string
          date_dernier_contact: string | null
          donnees_brutes: Json
          entreprise: string
          est_oublie: boolean
          etape: Database["public"]["Enums"]["etape_affaire"] | null
          etape_brute: string | null
          id: string
          import_id: string | null
          importe_le: string
          maj_le: string
          montant_eur: number | null
          notes: string | null
          opposition_prospection_le: string | null
          proba_recuperation: number | null
          score: number | null
          statut: Database["public"]["Enums"]["statut_prospect"]
          utilisateur_id: string
        }
        Insert: {
          ca_recuperable_eur?: number | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_telephone?: string | null
          cree_le?: string
          date_dernier_contact?: string | null
          donnees_brutes?: Json
          entreprise: string
          est_oublie?: boolean
          etape?: Database["public"]["Enums"]["etape_affaire"] | null
          etape_brute?: string | null
          id?: string
          import_id?: string | null
          importe_le?: string
          maj_le?: string
          montant_eur?: number | null
          notes?: string | null
          opposition_prospection_le?: string | null
          proba_recuperation?: number | null
          score?: number | null
          statut?: Database["public"]["Enums"]["statut_prospect"]
          utilisateur_id: string
        }
        Update: {
          ca_recuperable_eur?: number | null
          contact_email?: string | null
          contact_nom?: string | null
          contact_telephone?: string | null
          cree_le?: string
          date_dernier_contact?: string | null
          donnees_brutes?: Json
          entreprise?: string
          est_oublie?: boolean
          etape?: Database["public"]["Enums"]["etape_affaire"] | null
          etape_brute?: string | null
          id?: string
          import_id?: string | null
          importe_le?: string
          maj_le?: string
          montant_eur?: number | null
          notes?: string | null
          opposition_prospection_le?: string | null
          proba_recuperation?: number | null
          score?: number | null
          statut?: Database["public"]["Enums"]["statut_prospect"]
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      relances: {
        Row: {
          brevo_message_id: string | null
          copiee_le: string | null
          corps: string
          cree_le: string
          envoi_demande_le: string | null
          envoi_erreur: string | null
          envoi_statut: string | null
          envoyee_a: string | null
          envoyee_le: string | null
          id: string
          modele_ia: string | null
          objet: string
          prospect_id: string
          ton: Database["public"]["Enums"]["ton_relance"]
          utilisateur_id: string
        }
        Insert: {
          brevo_message_id?: string | null
          copiee_le?: string | null
          corps: string
          cree_le?: string
          envoi_demande_le?: string | null
          envoi_erreur?: string | null
          envoi_statut?: string | null
          envoyee_a?: string | null
          envoyee_le?: string | null
          id?: string
          modele_ia?: string | null
          objet: string
          prospect_id: string
          ton: Database["public"]["Enums"]["ton_relance"]
          utilisateur_id: string
        }
        Update: {
          brevo_message_id?: string | null
          copiee_le?: string | null
          corps?: string
          cree_le?: string
          envoi_demande_le?: string | null
          envoi_erreur?: string | null
          envoi_statut?: string | null
          envoyee_a?: string | null
          envoyee_le?: string | null
          id?: string
          modele_ia?: string | null
          objet?: string
          prospect_id?: string
          ton?: Database["public"]["Enums"]["ton_relance"]
          utilisateur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relances_prospect_fk"
            columns: ["prospect_id", "utilisateur_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id", "utilisateur_id"]
          },
        ]
      }
      utilisateurs: {
        Row: {
          cree_le: string
          email: string
          entreprise: string | null
          id: string
          maj_le: string
          nom: string | null
          panier_moyen_eur: number | null
          seuil_inactivite_jours: number
          signature: string | null
          taux_commission: number | null
          ton_relance: Database["public"]["Enums"]["ton_relance"]
        }
        Insert: {
          cree_le?: string
          email: string
          entreprise?: string | null
          id: string
          maj_le?: string
          nom?: string | null
          panier_moyen_eur?: number | null
          seuil_inactivite_jours?: number
          signature?: string | null
          taux_commission?: number | null
          ton_relance?: Database["public"]["Enums"]["ton_relance"]
        }
        Update: {
          cree_le?: string
          email?: string
          entreprise?: string | null
          id?: string
          maj_le?: string
          nom?: string | null
          panier_moyen_eur?: number | null
          seuil_inactivite_jours?: number
          signature?: string | null
          taux_commission?: number | null
          ton_relance?: Database["public"]["Enums"]["ton_relance"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      recalculer_prospects: { Args: never; Returns: number }
      recalculer_prospects_de: {
        Args: { p_utilisateur: string }
        Returns: number
      }
      recalculer_tous_les_prospects: { Args: never; Returns: number }
      tableau_de_bord: {
        Args: never
        Returns: {
          ca_recuperable_eur: number
          ca_recupere_eur: number
          dernier_import_le: string
          nb_affaires_ouvertes: number
          nb_gagnes_apres_relance: number
          nb_oublies: number
          nb_prospects: number
        }[]
      }
    }
    Enums: {
      etape_affaire:
        | "decouverte"
        | "qualification"
        | "proposition"
        | "negociation"
        | "gagne"
        | "perdu"
      statut_prospect: "a_traiter" | "relance" | "gagne" | "perdu" | "ignore"
      ton_relance: "formel" | "direct" | "chaleureux"
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
      etape_affaire: [
        "decouverte",
        "qualification",
        "proposition",
        "negociation",
        "gagne",
        "perdu",
      ],
      statut_prospect: ["a_traiter", "relance", "gagne", "perdu", "ignore"],
      ton_relance: ["formel", "direct", "chaleureux"],
    },
  },
} as const
