import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div>
        <h1 className="text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-card shadow-paper ${className}`}>{children}</div>;
}

export function useAccounts() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["accounts", company.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").eq("company_id", company.id).order("number");
      if (error) throw error;
      return data;
    },
  });
}

export type BokfortLinje = { konto: string; debet: number; kredit: number; mva_kode: string | null; dato: string };

export function usePostedLines(fra: string, til: string) {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["lines", company.id, fra, til],
    queryFn: async () => {
      const out: BokfortLinje[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("account_balances")
          .select("konto, debet, kredit, mva_kode, dato")
          .eq("company_id", company.id)
          .gte("dato", fra)
          .lte("dato", til)
          .range(from, from + 999);
        if (error) throw error;
        out.push(...(data as BokfortLinje[]));
        if (!data || data.length < 1000) break;
      }
      return out.map((l) => ({ ...l, debet: Number(l.debet), kredit: Number(l.kredit) }));
    },
  });
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-6 py-16 text-center text-sm text-muted-foreground">{children}</div>;
}

export const selectCls = "h-9 rounded-md border border-input bg-card px-2 text-sm";

export function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return <th className={`px-4 py-3 ${right ? "text-right" : ""}`}>{children}</th>;
}

export const theadCls = "border-b text-left text-xs uppercase tracking-wide text-muted-foreground";
