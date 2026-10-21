import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";

export function useEmployees() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["employees", company.id],
    queryFn: async () => (await supabase.from("employees").select("*").eq("company_id", company.id).order("navn")).data ?? [],
  });
}

export function useArticles() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["articles", company.id],
    queryFn: async () => (await supabase.from("articles").select("*").eq("company_id", company.id).order("navn")).data ?? [],
  });
}

/** De siste bokførte bilagene, nyest først, til forslag basert på tidligere føringer. */
export function useTidligereBilag() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["tidligere-bilag", company.id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("vouchers")
        .select("id, dato, beskrivelse, voucher_lines(konto, tekst, debet, kredit, mva_kode)")
        .eq("company_id", company.id)
        .eq("status", "bokfort")
        .in("kilde", ["manuell", "bank", "regel", "agent", "mottak"])
        .order("dato", { ascending: false })
        .limit(400);
      return (data ?? []).map((v) => ({
        id: v.id,
        dato: v.dato,
        beskrivelse: v.beskrivelse,
        linjer: v.voucher_lines.map((l) => ({ ...l, debet: Number(l.debet), kredit: Number(l.kredit) })),
      }));
    },
  });
}
