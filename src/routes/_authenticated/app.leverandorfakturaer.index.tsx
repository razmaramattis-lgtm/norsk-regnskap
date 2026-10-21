import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, idag, kr } from "@/lib/format";
import { useSuppliers } from "@/components/app/leverandorer";
import { PageHeader, Panel, Empty, theadCls } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BetalingsfilDialog, type BetalbarFaktura } from "@/components/app/Betalingsfil";

export const Route = createFileRoute("/_authenticated/app/leverandorfakturaer/")({
  head: () => ({ meta: [{ title: "Inngående fakturaer – Fjordbok" }] }),
  component: Liste,
});

const ST: Record<string, string> = { utkast: "Utkast", bokfort: "Ubetalt", betalt: "Betalt" };

function Liste() {
  const { company, canWrite } = useCompany();
  const [valgte, setValgte] = useState<Set<string>>(new Set());
  const [visFil, setVisFil] = useState(false);
  const { data: lev = [] } = useSuppliers();
  const nav = useNavigate();
  const { data = [], isLoading } = useQuery({
    queryKey: ["sinv", company.id],
    queryFn: async () => (await supabase.from("supplier_invoices").select("*, suppliers(navn, kontonummer)").eq("company_id", company.id).order("forfallsdato")).data ?? [],
  });
  async function ny() {
    if (!lev.length) { toast.error("Legg til en leverandør først"); return; }
    const { data, error } = await supabase.from("supplier_invoices").insert({ company_id: company.id, supplier_id: lev[0]!.id }).select("id").single();
    if (error) { toast.error(error.message); return; }
    nav({ to: "/app/leverandorfakturaer/$id", params: { id: data.id } });
  }
  const betalbare = data.filter((f) => f.status === "bokfort");
  const valgteFakturaer = betalbare.filter((f) => valgte.has(f.id)) as unknown as BetalbarFaktura[];
  const toggle = (id: string) => setValgte((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ubetalt = data.filter((f) => f.status === "bokfort").reduce((s, f) => s + Number(f.total), 0);
  return (
    <>
      <PageHeader title="Inngående fakturaer" sub={`Leverandørgjeld (2400): ${kr(ubetalt)}`} actions={canWrite && (<>
        <Button variant="outline" disabled={valgteFakturaer.length === 0} onClick={() => setVisFil(true)}><FileDown /> Betalingsfil{valgteFakturaer.length ? ` (${valgteFakturaer.length})` : ""}</Button>
        <Button onClick={ny}><Plus /> Registrer faktura</Button>
      </>)} />
      <Panel>
        {isLoading ? <Empty>Laster …</Empty> : data.length === 0 ? <Empty>Ingen leverandørfakturaer ennå.</Empty> : (
          <table className="w-full text-sm">
            <thead className={theadCls}><tr><th className="w-10 px-4 py-3" /><th className="px-4 py-3">Leverandør</th><th className="px-4 py-3">Fakturanr</th><th className="px-4 py-3">Fakturadato</th><th className="px-4 py-3">Forfall</th><th className="px-4 py-3">KID</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Beløp</th></tr></thead>
            <tbody>
              {data.map((f) => {
                const forfalt = f.status === "bokfort" && f.forfallsdato < idag();
                return (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">{f.status === "bokfort" && canWrite && <Checkbox checked={valgte.has(f.id)} onCheckedChange={() => toggle(f.id)} aria-label={`Velg ${f.suppliers?.navn ?? "faktura"}`} />}</td>
                    <td className="px-4 py-3"><Link to="/app/leverandorfakturaer/$id" params={{ id: f.id }} className="text-primary hover:underline">{f.suppliers?.navn}</Link></td>
                    <td className="px-4 py-3 font-mono">{f.fakturanr}</td>
                    <td className="px-4 py-3">{dato(f.fakturadato)}</td>
                    <td className={`px-4 py-3 ${forfalt ? "text-destructive" : ""}`}>{dato(f.forfallsdato)}</td>
                    <td className="px-4 py-3 font-mono">{f.kid}</td>
                    <td className="px-4 py-3"><Badge variant={forfalt ? "destructive" : f.status === "betalt" ? "default" : "outline"}>{forfalt ? "Forfalt" : ST[f.status]}</Badge></td>
                    <td className="num px-4 py-3">{kr(f.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
      {visFil && <BetalingsfilDialog fakturaer={valgteFakturaer} company={company} onClose={() => setVisFil(false)} />}
    </>
  );
}
