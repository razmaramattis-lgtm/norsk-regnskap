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
