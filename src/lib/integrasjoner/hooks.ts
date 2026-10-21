import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import type { DomeneId } from "./domener";

export type IntegrasjonRad = {
  id: string;
  domene: DomeneId;
  leverandor: string | null;
  status: string;
  miljo: string;
  notat: string | null;
  konfig: Record<string, unknown>;
};

export function useIntegrasjoner() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["integrations", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("company_id", company.id);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        domene: r.domene as DomeneId,
        konfig: (r.konfig ?? {}) as Record<string, unknown>,
      })) as IntegrasjonRad[];
    },
  });
}

export function useHarAnsatte() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["har-ansatte", company.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id);
      return (count ?? 0) > 0;
    },
  });
}
