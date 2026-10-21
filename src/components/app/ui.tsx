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

export type BokfortVoucherLinje = {
  konto: string;
  debet: number;
  kredit: number;
  voucher_id: string;
  bilagsnr: number | null;
  dato: string;
  beskrivelse: string;
};

/** Bokførte linjer på bilagsnivå – brukes til å gå ned på bilagene bak en konto i rapportene. */
export function usePostedVoucherLines(fra: string, til: string) {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["voucher-lines", company.id, fra, til],
    queryFn: async () => {
      const out: BokfortVoucherLinje[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("voucher_lines")
          .select("konto, debet, kredit, voucher_id, vouchers!inner(bilagsnr, dato, beskrivelse, status)")
          .eq("company_id", company.id)
          .eq("vouchers.status", "bokfort")
          .gte("vouchers.dato", fra)
          .lte("vouchers.dato", til)
          .range(from, from + 999);
        if (error) throw error;
        out.push(
          ...(data ?? []).map((l) => {
            const v = l.vouchers as unknown as { bilagsnr: number | null; dato: string; beskrivelse: string };
            return {
              konto: l.konto,
              debet: Number(l.debet),
              kredit: Number(l.kredit),
              voucher_id: l.voucher_id,
              bilagsnr: v.bilagsnr,
              dato: v.dato,
              beskrivelse: v.beskrivelse,
            };
          }),
        );
        if (!data || data.length < 1000) break;
      }
      return out;
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

type Tone = "ok" | "warn" | "bad" | "info" | "muted";
const TONE: Record<Tone, string> = {
  ok: "bg-success/12 text-success ring-success/25",
  warn: "bg-warning/15 text-[oklch(0.45_0.1_70)] ring-warning/30",
  bad: "bg-destructive/10 text-destructive ring-destructive/25",
  info: "bg-primary/10 text-primary ring-primary/20",
  muted: "bg-muted text-muted-foreground ring-border",
};

/** Liten statusmerkelapp med rolig fargebruk. */
export function StatusPill({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

/** Tallkort for nøkkeltall. */
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "bad" | "ok" }) {
  return (
    <Panel className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="num mt-3 text-left font-serif text-2xl">{value}</div>
      {sub && <div className={`mt-1 text-xs ${tone === "bad" ? "text-destructive" : tone === "ok" ? "text-success" : "text-muted-foreground"}`}>{sub}</div>}
    </Panel>
  );
}
