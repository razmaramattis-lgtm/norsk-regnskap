import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, kr } from "@/lib/format";
import { PageHeader, Panel, Empty, selectCls } from "@/components/app/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/bilag/")({
  head: () => ({ meta: [{ title: "Bilag – Fjordbok" }] }),
  component: BilagListe,
});

const KILDE: Record<string, string> = { manuell: "Manuell", faktura: "Faktura", innbetaling: "Innbetaling", korreksjon: "Korreksjon", leverandorfaktura: "Leverandørfaktura", utbetaling: "Utbetaling", bank: "Bank", lonn: "Lønn", aarsavslutning: "Årsavslutning", avskrivning: "Avskrivning", mva_oppgjor: "MVA-oppgjør", saft_import: "Import", regel: "Forslag", agent: "Forslag" };

function BilagListe() {
  const { company, canWrite } = useCompany();
  const [sok, setSok] = useState("");
  const [status, setStatus] = useState("");
  const [maaned, setMaaned] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["vouchers", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vouchers")
        .select("id, bilagsnr, dato, beskrivelse, status, kilde, voucher_lines(debet)")
        .eq("company_id", company.id)
        .order("status", { ascending: true })
        .order("bilagsnr", { ascending: false, nullsFirst: true })
        .limit(2000);
      if (error) throw error;
      return data;
    },
  });
  const belop = (v: (typeof data)[number]) => v.voucher_lines.reduce((s, l) => s + Number(l.debet), 0);
  const q = sok.trim().toLowerCase().replace(",", ".");
  const vist = data.filter(
    (v) =>
      (!status || v.status === status) &&
      (!maaned || v.dato.startsWith(maaned)) &&
      (!q || v.beskrivelse.toLowerCase().includes(q) || String(v.bilagsnr ?? "") === q || belop(v).toFixed(2).startsWith(q)),
  );
  return (
    <>
      <PageHeader
        title="Bilag"
        sub="Bokførte bilag er låst og nummerert fortløpende. Feil rettes med korreksjonsbilag."
        actions={canWrite && <Button asChild><Link to="/app/bilag/ny"><Plus /> Nytt bilag</Link></Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input className="w-full max-w-xs" placeholder="Søk i beskrivelse, nummer eller beløp" value={sok} onChange={(e) => setSok(e.target.value)} />
        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Alle</option>
          <option value="utkast">Utkast</option>
          <option value="bokfort">Bokført</option>
        </select>
        <Input type="month" className="w-44" value={maaned} onChange={(e) => setMaaned(e.target.value)} aria-label="Måned" />
        <span className="text-sm text-muted-foreground">{vist.length} bilag · {kr(vist.reduce((s, v) => s + belop(v), 0))}</span>
      </div>
      <Panel className="overflow-x-auto">
        {isLoading ? <Empty>Laster …</Empty> : vist.length === 0 ? <Empty>{data.length ? "Ingen bilag passer søket." : "Ingen bilag ennå."}</Empty> : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Nr</th><th className="px-4 py-3">Dato</th><th className="px-4 py-3">Beskrivelse</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Beløp</th></tr>
            </thead>
            <tbody>
              {vist.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono">
                    <Link to="/app/bilag/$id" params={{ id: v.id }} className="text-primary hover:underline">
                      {v.bilagsnr ?? <Badge variant="outline">Utkast</Badge>}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{dato(v.dato)}</td>
                  <td className="px-4 py-3">{v.beskrivelse}</td>
                  <td className="px-4 py-3 text-muted-foreground">{KILDE[v.kilde] ?? v.kilde}</td>
                  <td className="num px-4 py-3">{kr(belop(v))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
