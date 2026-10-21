import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Repeat } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, idag, kr } from "@/lib/format";
import { PageHeader, Panel, Empty } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCustomers, STATUS } from "@/components/app/kunder";
import { INTERVALLER, type Intervall } from "@/lib/faktura";

export const Route = createFileRoute("/_authenticated/app/fakturaer/")({
  head: () => ({ meta: [{ title: "Fakturaer – Fjordbok" }] }),
  component: Fakturaer,
});

function Fakturaer() {
  const { company, canWrite } = useCompany();
  const { data: kunder = [] } = useCustomers();
  const nav = useNavigate();
  const { data = [], isLoading } = useQuery({
    queryKey: ["invoices", company.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*, customers(navn)").eq("company_id", company.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function ny() {
    if (!kunder.length) { toast.error("Legg til en kunde først"); return; }
    const { data, error } = await supabase.from("invoices").insert({ company_id: company.id, customer_id: kunder[0]!.id }).select("id").single();
    if (error) { toast.error(error.message); return; }
    nav({ to: "/app/fakturaer/$id", params: { id: data.id } });
  }

  return (
    <>
      <PageHeader title="Fakturaer" sub="Utgående fakturaer med KID. Sendte fakturaer bokføres automatisk." actions={canWrite && <Button onClick={ny}><Plus /> Ny faktura</Button>} />
      <Repeterende />
      <Panel className="overflow-x-auto">
        {isLoading ? <Empty>Laster …</Empty> : data.length === 0 ? <Empty>Ingen fakturaer ennå.</Empty> : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Nr</th><th className="px-4 py-3">Kunde</th><th className="px-4 py-3">Fakturadato</th><th className="px-4 py-3">Forfall</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Beløp</th><th className="px-4 py-3 text-right">Gjenstår</th></tr>
            </thead>
            <tbody>
              {data.map((f) => {
                const forfalt = f.status === "sendt" && f.forfallsdato < idag();
                return (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono"><Link to="/app/fakturaer/$id" params={{ id: f.id }} className="text-primary hover:underline">{f.fakturanr ?? "–"}</Link></td>
                    <td className="px-4 py-3">{f.customers?.navn}</td>
                    <td className="px-4 py-3">{dato(f.fakturadato)}</td>
                    <td className={`px-4 py-3 ${forfalt ? "text-destructive" : ""}`}>{f.status !== "utkast" && dato(f.forfallsdato)}</td>
                    <td className="px-4 py-3"><Badge variant={forfalt ? "destructive" : STATUS[f.status]!.v}>{forfalt ? "Forfalt" : f.status === "sendt" && Number(f.innbetalt) > 0 ? "Delbetalt" : STATUS[f.status]!.t}</Badge></td>
                    <td className="num px-4 py-3">{kr(f.total)}</td>
                    <td className="num px-4 py-3">{f.status === "sendt" ? kr(Number(f.total) - Number(f.innbetalt)) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

/** Repeterende fakturaer: utkast som er klare lages med ett klikk, og sendes etter kontroll. */
function Repeterende() {
  const { company, canWrite } = useCompany();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data = [] } = useQuery({
    queryKey: ["repeterende", company.id],
    queryFn: async () =>
      (
        await supabase
          .from("repeterende_fakturaer")
          .select("id, intervall, neste_dato, aktiv, mal_faktura, invoices(fakturanr, total, customers(navn))")
          .eq("company_id", company.id)
          .eq("aktiv", true)
          .order("neste_dato")
      ).data ?? [],
  });
  if (!data.length) return null;
  async function lag(id: string) {
    const { data: ny, error } = await supabase.rpc("lag_repeterende_utkast", { _id: id });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries();
    nav({ to: "/app/fakturaer/$id", params: { id: ny } });
  }
  return (
    <Panel className="mb-6 overflow-x-auto">
      <h2 className="flex items-center gap-2 px-4 pt-4 text-xl"><Repeat className="h-4 w-4" /> Repeterende fakturaer</h2>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {data.map((r) => {
            const klar = r.neste_dato <= idag();
            return (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2">{r.invoices?.customers?.navn}</td>
                <td className="px-4 py-2 text-muted-foreground">{INTERVALLER[r.intervall as Intervall]?.navn} · som faktura {r.invoices?.fakturanr}</td>
                <td className={`px-4 py-2 ${klar ? "font-medium" : ""}`}>{klar ? "Klar nå" : `Neste ${dato(r.neste_dato)}`}</td>
                <td className="num px-4 py-2">{kr(r.invoices?.total)}</td>
                <td className="px-4 py-2 text-right">
                  {canWrite && <Button size="sm" variant={klar ? "default" : "outline"} onClick={() => lag(r.id)}>Lag utkast</Button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
