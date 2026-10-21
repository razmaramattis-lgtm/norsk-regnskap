import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, kr } from "@/lib/format";
import { PageHeader, Panel, Empty } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/bilag/")({
  head: () => ({ meta: [{ title: "Bilag – Fjordbok" }] }),
  component: BilagListe,
});

const KILDE: Record<string, string> = { manuell: "Manuell", faktura: "Faktura", innbetaling: "Innbetaling", korreksjon: "Korreksjon", leverandorfaktura: "Leverandørfaktura", utbetaling: "Utbetaling", bank: "Bank", lonn: "Lønn", aarsavslutning: "Årsavslutning" };

function BilagListe() {
  const { company, canWrite } = useCompany();
  const { data = [], isLoading } = useQuery({
    queryKey: ["vouchers", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vouchers")
        .select("id, bilagsnr, dato, beskrivelse, status, kilde, voucher_lines(debet)")
        .eq("company_id", company.id)
        .order("status", { ascending: true })
        .order("bilagsnr", { ascending: false, nullsFirst: true })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
  return (
    <>
      <PageHeader
        title="Bilag"
        sub="Bokførte bilag er låst og nummerert fortløpende. Feil rettes med korreksjonsbilag."
        actions={canWrite && <Button asChild><Link to="/app/bilag/ny"><Plus /> Nytt bilag</Link></Button>}
      />
      <Panel>
        {isLoading ? <Empty>Laster …</Empty> : data.length === 0 ? <Empty>Ingen bilag ennå.</Empty> : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Nr</th><th className="px-4 py-3">Dato</th><th className="px-4 py-3">Beskrivelse</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Beløp</th></tr>
            </thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono">
                    <Link to="/app/bilag/$id" params={{ id: v.id }} className="text-primary hover:underline">
                      {v.bilagsnr ?? <Badge variant="outline">Utkast</Badge>}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{dato(v.dato)}</td>
                  <td className="px-4 py-3">{v.beskrivelse}</td>
                  <td className="px-4 py-3 text-muted-foreground">{KILDE[v.kilde] ?? v.kilde}</td>
                  <td className="num px-4 py-3">{kr(v.voucher_lines.reduce((s, l) => s + Number(l.debet), 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
