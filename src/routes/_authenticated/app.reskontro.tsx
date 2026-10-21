import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { kr } from "@/lib/format";
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
