import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { PageHeader, Panel, Empty, useAccounts } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/kontoplan")({
  head: () => ({ meta: [{ title: "Kontoplan – Fjordbok" }] }),
  component: Kontoplan,
});

const KLASSER: Record<string, string> = {
  "1": "Eiendeler", "2": "Egenkapital og gjeld", "3": "Salgs- og driftsinntekt", "4": "Varekostnad",
  "5": "Lønnskostnad", "6": "Andre driftskostnader", "7": "Andre driftskostnader", "8": "Finans og skatt",
};

function Kontoplan() {
  const { company, canWrite } = useCompany();
  const { data = [], isLoading } = useAccounts();
  const qc = useQueryClient();
  const [nr, setNr] = useState("");
  const [navn, setNavn] = useState("");
  const [sok, setSok] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(nr)) { toast.error("Kontonummer må være 4–6 siffer"); return; }
    const { error } = await supabase.from("accounts").insert({ company_id: company.id, number: nr, name: navn });
    if (error) { toast.error(error.message); return; }
    setNr(""); setNavn("");
    qc.invalidateQueries({ queryKey: ["accounts"] });
  }
  const filtrert = data.filter((a) => !sok || a.number.startsWith(sok) || a.name.toLowerCase().includes(sok.toLowerCase()));

  return (
    <>
      <PageHeader title="Kontoplan" sub="Basert på Norsk Standard NS 4102." actions={<Input placeholder="Søk" value={sok} onChange={(e) => setSok(e.target.value)} className="w-56" />} />
      {canWrite && (
        <form onSubmit={add} className="mb-6 flex gap-2">
          <Input placeholder="Nr" value={nr} onChange={(e) => setNr(e.target.value)} className="w-28 font-mono" />
          <Input placeholder="Kontonavn" value={navn} onChange={(e) => setNavn(e.target.value)} required />
          <Button type="submit">Legg til konto</Button>
        </form>
      )}
      <Panel>
        {isLoading ? <Empty>Laster …</Empty> : (
          <table className="w-full text-sm">
            <tbody>
              {filtrert.map((a, i) => {
                const ny = i === 0 || filtrert[i - 1]!.number[0] !== a.number[0];
                return (
                  <Fragment key={a.id}>
                    {ny && <tr key={"k" + a.number[0]} className="bg-muted/60"><td colSpan={3} className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Klasse {a.number[0]} · {KLASSER[a.number[0] ?? ""]}</td></tr>}
                    <tr key={a.id} className="border-b"><td className="w-24 px-4 py-2 font-mono">{a.number}</td><td className="px-4 py-2">{a.name}</td><td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">{a.mva_kode ? `MVA ${a.mva_kode}` : ""}</td></tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
