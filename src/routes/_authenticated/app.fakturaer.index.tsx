import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, idag, kr } from "@/lib/format";
import { PageHeader, Panel, Empty } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCustomers, STATUS } from "@/components/app/kunder";

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
    const { data, error } = await supabase.from("invoices").insert({ company_id: company.id, customer_id: kunder[0].id }).select("id").single();
    if (error) { toast.error(error.message); return; }
    nav({ to: "/app/fakturaer/$id", params: { id: data.id } });
  }

  return (
    <>
      <PageHeader title="Fakturaer" sub="Utgående fakturaer med KID. Sendte fakturaer bokføres automatisk." actions={canWrite && <Button onClick={ny}><Plus /> Ny faktura</Button>} />
      <Panel>
        {isLoading ? <Empty>Laster …</Empty> : data.length === 0 ? <Empty>Ingen fakturaer ennå.</Empty> : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Nr</th><th className="px-4 py-3">Kunde</th><th className="px-4 py-3">Fakturadato</th><th className="px-4 py-3">Forfall</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Beløp</th></tr>
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
                    <td className="px-4 py-3"><Badge variant={forfalt ? "destructive" : STATUS[f.status]!.v}>{forfalt ? "Forfalt" : STATUS[f.status]!.t}</Badge></td>
                    <td className="num px-4 py-3">{kr(f.total)}</td>
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
