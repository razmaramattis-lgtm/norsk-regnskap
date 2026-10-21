import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, idag, kr } from "@/lib/format";
import { mailto, purreEpost } from "@/lib/fakturatekst";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty, theadCls } from "@/components/app/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/app/reskontro")({
  head: () => ({ meta: [{ title: "Reskontro – Fjordbok" }] }),
  component: Reskontro,
});

const BOKSER = ["Ikke forfalt", "1–30 dager", "31–60 dager", "61–90 dager", "Over 90 dager"];
function boks(forfall: string) {
  const d = Math.floor((Date.now() - new Date(forfall).getTime()) / 86400000);
  return d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4;
}

function Aldersfordeling({ poster }: { poster: { navn: string; forfall: string; belop: number }[] }) {
  const per = new Map<string, number[]>();
  for (const p of poster) {
    const r = per.get(p.navn) ?? [0, 0, 0, 0, 0];
    r[boks(p.forfall)]! += p.belop;
    per.set(p.navn, r);
  }
  const tot = [0, 0, 0, 0, 0];
  per.forEach((r) => r.forEach((v, i) => (tot[i]! += v)));
  if (!per.size) return <Empty>Ingen åpne poster.</Empty>;
  return (
    <table className="w-full text-sm">
      <thead className={theadCls}><tr><th className="px-4 py-3">Navn</th>{BOKSER.map((b) => <th key={b} className="px-4 py-3 text-right">{b}</th>)}<th className="px-4 py-3 text-right">Sum</th></tr></thead>
      <tbody>{[...per.entries()].map(([n, r]) => <tr key={n} className="border-b"><td className="px-4 py-2">{n}</td>{r.map((v, i) => <td key={i} className={`num px-4 py-2 ${i >= 2 && v ? "text-destructive" : ""}`}>{v ? kr(v) : ""}</td>)}<td className="num px-4 py-2 font-medium">{kr(r.reduce((a, b) => a + b, 0))}</td></tr>)}</tbody>
      <tfoot><tr className="bg-muted/50 font-medium"><td className="px-4 py-3">Sum</td>{tot.map((v, i) => <td key={i} className="num px-4 py-3">{kr(v)}</td>)}<td className="num px-4 py-3">{kr(tot.reduce((a, b) => a + b, 0))}</td></tr></tfoot>
    </table>
  );
}

function Forfalte() {
  const { company } = useCompany();
  const { data = [] } = useQuery({
    queryKey: ["forfalte", company.id],
    queryFn: async () =>
      (
        await supabase
          .from("invoices")
          .select("id, fakturanr, kid, total, forfallsdato, customers(navn, epost)")
          .eq("company_id", company.id)
          .eq("status", "sendt")
          .eq("er_kreditnota", false)
          .lt("forfallsdato", idag())
          .order("forfallsdato")
      ).data ?? [],
  });
  if (!data.length) return null;
  return (
    <Panel className="mb-6 overflow-x-auto">
      <h2 className="px-4 pt-4 text-xl">Forfalte kundefakturaer</h2>
      <table className="mt-2 w-full text-sm">
        <thead className={theadCls}>
          <tr><th className="px-4 py-3">Faktura</th><th className="px-4 py-3">Kunde</th><th className="px-4 py-3">Forfalt</th><th className="px-4 py-3 text-right">Beløp</th><th /></tr>
        </thead>
        <tbody>
          {data.map((f) => {
            const kunde = { navn: f.customers?.navn ?? "", epost: f.customers?.epost ?? null };
            return (
              <tr key={f.id} className="border-b">
                <td className="px-4 py-2"><Link to="/app/fakturaer/$id" params={{ id: f.id }} className="text-primary hover:underline">{f.fakturanr}</Link></td>
                <td className="px-4 py-2">{kunde.navn}</td>
                <td className="num px-4 py-2 text-left text-destructive">{dato(f.forfallsdato)}</td>
                <td className="num px-4 py-2">{kr(f.total)}</td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="outline" asChild>
                    <a href={mailto(purreEpost(f, company, kunde, idag()))}><BellRing /> Purring</a>
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function Reskontro() {
  const { company } = useCompany();
  const { data: kunder = [], isLoading } = useQuery({
    queryKey: ["ar", company.id],
    queryFn: async () => ((await supabase.from("invoices").select("total, forfallsdato, customers(navn)").eq("company_id", company.id).eq("status", "sendt")).data ?? []).map((i) => ({ navn: i.customers?.navn ?? "", forfall: i.forfallsdato, belop: Number(i.total) })),
  });
  const { data: lev = [] } = useQuery({
    queryKey: ["ap", company.id],
    queryFn: async () => ((await supabase.from("supplier_invoices").select("total, forfallsdato, suppliers(navn)").eq("company_id", company.id).eq("status", "bokfort")).data ?? []).map((i) => ({ navn: i.suppliers?.navn ?? "", forfall: i.forfallsdato, belop: Number(i.total) })),
  });
  return (
    <>
      <PageHeader title="Reskontro" sub="Åpne poster fordelt etter alder." />
      <Forfalte />
      {isLoading ? <Empty>Laster …</Empty> : (
        <Tabs defaultValue="k">
          <TabsList><TabsTrigger value="k">Kundereskontro (1500)</TabsTrigger><TabsTrigger value="l">Leverandørreskontro (2400)</TabsTrigger></TabsList>
          <TabsContent value="k"><Panel className="overflow-x-auto"><Aldersfordeling poster={kunder} /></Panel></TabsContent>
          <TabsContent value="l"><Panel className="overflow-x-auto"><Aldersfordeling poster={lev} /></Panel></TabsContent>
        </Tabs>
      )}
    </>
  );
}
