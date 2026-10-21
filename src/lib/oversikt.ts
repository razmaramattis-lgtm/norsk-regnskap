import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OversiktRad } from "./klienter";

/** Status for alle firmaer innlogget bruker har tilgang til (`byraa_oversikt()`). */
export function useOversikt() {
  return useQuery({
    queryKey: ["byraa-oversikt"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("byraa_oversikt");
      if (error) throw error;
      return (data ?? []) as unknown as OversiktRad[];
    },
  });
}
