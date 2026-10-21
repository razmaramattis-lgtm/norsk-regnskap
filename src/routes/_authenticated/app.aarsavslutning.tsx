import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato } from "@/lib/format";
import { byggSaft } from "@/lib/saft";
import { PageHeader, Panel, selectCls } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/aarsavslutning")({
  head: () => ({ meta: [{ title: "Perioder og årsavslutning – Fjordbok" }] }),
  component: Aar,
});

async function hentAlt<T>(q: (from: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await q(f);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function Aar() {
  const { company, isAdmin } = useCompany();
  const qc = useQueryClient();
  const y = new Date().getFullYear();
  const [aar, setAar] = useState(y - 1);
  const [laas, setLaas] = useState(company.laast_til ?? `${y - 1}-12-31`);
  const [saftAar, setSaftAar] = useState(y);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try { await fn(); toast.success(ok); qc.invalidateQueries(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function lastNedSaft() {
    const fra = `${saftAar}-01-01`, til = `${saftAar}-12-31`;
    const [accounts, customers, suppliers, vouchers, ibLinjer] = await Promise.all([
      supabase.from("accounts").select("number, name").eq("company_id", company.id).order("number").then((r) => r.data ?? []),
      supabase.from("customers").select("id, navn, org_nr").eq("company_id", company.id).then((r) => r.data ?? []),
      supabase.from("suppliers").select("id, navn, org_nr").eq("company_id", company.id).then((r) => r.data ?? []),
      hentAlt((f) => supabase.from("vouchers").select("id, bilagsnr, dato, beskrivelse, voucher_lines(konto, debet, kredit, mva_kode, tekst)").eq("company_id", company.id).eq("status", "bokfort").gte("dato", fra).lte("dato", til).order("bilagsnr").range(f, f + 999)),
      hentAlt((f) => supabase.from("account_balances").select("konto, debet, kredit").eq("company_id", company.id).lt("dato", fra).range(f, f + 999)),
    ]);
    const inngaende: Record<string, number> = {};
    for (const l of ibLinjer) if (l.konto && l.konto < "3000") inngaende[l.konto] = (inngaende[l.konto] ?? 0) + Number(l.debet) - Number(l.kredit);
    const xml = byggSaft({
      company, fra, til, accounts, customers, suppliers, inngaende,
      vouchers: vouchers.map((v) => ({ ...v, lines: v.voucher_lines.map((l) => ({ ...l, debet: Number(l.debet), kredit: Number(l.kredit) })) })),
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
    a.download = `SAF-T_Financial_${company.org_nr ?? "firma"}_${saftAar}.xml`;
    a.click();
  }

  return (
    <>
      <PageHeader title="Perioder og årsavslutning" sub={company.laast_til ? `Regnskapet er låst til og med ${dato(company.laast_til)}` : "Ingen perioder er låst"} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="p-6">
          <Lock className="mb-3 h-5 w-5 text-primary" />
          <h2 className="mb-2 text-xl">Lås periode</h2>
          <p className="mb-4 text-sm text-muted-foreground">Etter låsing kan ingen bilag bokføres med dato i perioden. Låsingen kan ikke oppheves.</p>
          <Label>Lås til og med</Label>
          <Input type="date" className="mb-3 mt-1.5" value={laas} onChange={(e) => setLaas(e.target.value)} disabled={!isAdmin} />
          <Button disabled={!isAdmin || busy} onClick={() => run(async () => { const { error } = await supabase.rpc("set_period_lock", { _company: company.id, _dato: laas }); if (error) throw error; }, "Perioden er låst")}>Lås periode</Button>
        </Panel>
        <Panel className="p-6">
          <h2 className="mb-2 text-xl">Årsavslutning</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Overfører årsresultatet (konto 8800) til {company.company_type === "as" ? "annen egenkapital (2050) eller udekket tap (2080)" : "egenkapital (2050)"} per 31.12. Før dette: bokfør avskrivninger, periodiseringer{company.company_type === "as" ? ", skattekostnad (8300/2500) og eventuelt utbytte (8920/2800)" : ""}.
          </p>
          <select className={`${selectCls} mb-3 w-full`} value={aar} onChange={(e) => setAar(Number(e.target.value))}>{[y - 3, y - 2, y - 1, y].map((x) => <option key={x}>{x}</option>)}</select>
          <Button disabled={!isAdmin || busy} onClick={() => run(async () => { const { error } = await supabase.rpc("close_year", { _company: company.id, _aar: aar }); if (error) throw error; }, `Året ${aar} er avsluttet`)}>Avslutt {aar}</Button>
          <ul className="mt-6 space-y-1 text-xs text-muted-foreground">
            {company.company_type === "as" ? (<><li>• Årsregnskap til Regnskapsregisteret: 31. juli</li><li>• Skattemelding for AS (RF-1028) med næringsspesifikasjon: 31. mai</li><li>• Aksjonærregisteroppgave: 31. januar</li></>) : (<li>• Skattemelding med næringsspesifikasjon for ENK: 31. mai</li>)}
          </ul>
        </Panel>
        <Panel className="p-6">
          <Download className="mb-3 h-5 w-5 text-primary" />
          <h2 className="mb-2 text-xl">SAF-T Financial</h2>
          <p className="mb-4 text-sm text-muted-foreground">Standardfil (versjon 1.30) med kontoplan, kunder, leverandører og alle bilag. Skatteetaten kan kreve denne ved kontroll.</p>
          <select className={`${selectCls} mb-3 w-full`} value={saftAar} onChange={(e) => setSaftAar(Number(e.target.value))}>{[y - 3, y - 2, y - 1, y].map((x) => <option key={x}>{x}</option>)}</select>
          <Button variant="outline" disabled={busy} onClick={() => run(lastNedSaft, "SAF-T-fil lastet ned")}>Last ned SAF-T</Button>
        </Panel>
      </div>
    </>
  );
}
