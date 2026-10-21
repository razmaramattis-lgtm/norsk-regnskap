import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { kr } from "@/lib/format";
import { PageHeader, Panel, Empty, theadCls, selectCls } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/varer")({
  head: () => ({ meta: [{ title: "Varer og tjenester – Fjordbok" }] }),
  component: Varer,
});

export function useArticles() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["articles", company.id],
    queryFn: async () => (await supabase.from("articles").select("*").eq("company_id", company.id).order("navn")).data ?? [],
  });
}

function Varer() {
  const { company, canWrite } = useCompany();
  const { data = [], isLoading } = useArticles();
  const qc = useQueryClient();
  const [f, setF] = useState({ varenr: "", navn: "", enhet: "stk", pris: "", mva_sats: company.mva_registrert ? 25 : 0 });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("articles").insert({ ...f, pris: Number(f.pris || 0), company_id: company.id });
    if (error) { toast.error(error.message); return; }
    setF({ ...f, varenr: "", navn: "", pris: "" });
    qc.invalidateQueries({ queryKey: ["articles"] });
  }
  return (
    <>
      <PageHeader title="Varer og tjenester" sub="Brukes som forslag på fakturalinjer." />
      {canWrite && (
        <form onSubmit={add} className="mb-6 flex flex-wrap gap-2">
          <Input placeholder="Varenr" className="w-28 font-mono" value={f.varenr} onChange={(e) => setF({ ...f, varenr: e.target.value })} />
          <Input placeholder="Navn" className="min-w-60 flex-1" value={f.navn} onChange={(e) => setF({ ...f, navn: e.target.value })} required />
          <Input placeholder="Enhet" className="w-24" value={f.enhet} onChange={(e) => setF({ ...f, enhet: e.target.value })} />
          <Input placeholder="Pris eks. mva" className="num w-36" value={f.pris} onChange={(e) => setF({ ...f, pris: e.target.value.replace(",", ".") })} />
          <select className={selectCls} value={f.mva_sats} onChange={(e) => setF({ ...f, mva_sats: Number(e.target.value) })}><option value={25}>25 %</option><option value={15}>15 %</option><option value={12}>12 %</option><option value={0}>0 %</option></select>
          <Button type="submit">Legg til</Button>
        </form>
      )}
      <Panel>
        {isLoading ? <Empty>Laster …</Empty> : data.length === 0 ? <Empty>Ingen varer ennå.</Empty> : (
          <table className="w-full text-sm">
            <thead className={theadCls}><tr><th className="px-4 py-3">Varenr</th><th className="px-4 py-3">Navn</th><th className="px-4 py-3">Enhet</th><th className="px-4 py-3 text-right">Pris</th><th className="px-4 py-3 text-right">MVA</th><th /></tr></thead>
            <tbody>{data.map((a) => (
              <tr key={a.id} className="border-b last:border-0"><td className="px-4 py-3 font-mono">{a.varenr}</td><td className="px-4 py-3">{a.navn}</td><td className="px-4 py-3">{a.enhet}</td><td className="num px-4 py-3">{kr(a.pris)}</td><td className="num px-4 py-3">{Number(a.mva_sats)} %</td>
                <td className="px-4 py-3 text-right">{canWrite && <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("articles").delete().eq("id", a.id); qc.invalidateQueries({ queryKey: ["articles"] }); }}>Slett</Button>}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
