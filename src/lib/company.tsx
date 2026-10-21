import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Role = Database["public"]["Enums"]["member_role"];

type Ctx = {
  company: Company;
  role: Role;
  canWrite: boolean;
  isAdmin: boolean;
  companies: { company: Company; role: Role }[];
  setActive: (id: string) => void;
};

const CompanyCtx = createContext<Ctx | null>(null);
const KEY = "aktivt-firma";

export function useMemberships() {
  return useQuery({
    queryKey: ["memberships"],
    queryFn: async () => {
      await supabase.rpc("accept_my_invites");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("company_members")
        .select("role, companies(*)")
        .eq("user_id", u.user.id);
      if (error) throw error;
      return (data ?? [])
        .filter((m) => m.companies)
        .map((m) => ({ role: m.role, company: m.companies as unknown as Company }));
    },
  });
}

export function CompanyProvider({
  memberships,
  children,
}: {
  memberships: { company: Company; role: Role }[];
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    setActiveId(localStorage.getItem(KEY));
  }, []);
  const current = memberships.find((m) => m.company.id === activeId) ?? memberships[0];
  const setActive = (id: string) => {
    localStorage.setItem(KEY, id);
    setActiveId(id);
    qc.invalidateQueries();
  };
  const role = current.role;
  return (
    <CompanyCtx.Provider
      value={{
        company: current.company,
        role,
        canWrite: role !== "leser",
        isAdmin: role === "eier" || role === "admin",
        companies: memberships,
        setActive,
      }}
    >
      {children}
    </CompanyCtx.Provider>
  );
}

export function useCompany() {
  const c = useContext(CompanyCtx);
  if (!c) throw new Error("useCompany utenfor CompanyProvider");
  return c;
}

export const ROLLENAVN: Record<Role, string> = {
  eier: "Eier",
  admin: "Administrator",
  regnskapsforer: "Regnskapsfører",
  leser: "Lesetilgang",
};

export function setActiveCompanyId(id: string) {
  localStorage.setItem(KEY, id);
}
