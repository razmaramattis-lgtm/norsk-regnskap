import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato } from "@/lib/format";
import { lastOppDokument, apneDokument } from "@/components/app/Vedlegg";
import { PageHeader, Panel, Empty, theadCls } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/arkiv")({
  head: () => ({ meta: [{ title: "Bilagsarkiv – Fjordbok" }] }),
  component: Arkiv,
});

function Arkiv() {
  const { company, canWrite } = useCompany();
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["docs-all", company.id],
    queryFn: async () => (await supabase.from("documents").select("*, vouchers(bilagsnr), supplier_invoices(fakturanr)").eq("company_id", company.id).order("created_at", { ascending: false })).data ?? [],
  });
  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    setBusy(true);
    try {
      for (const f of files) await lastOppDokument(company.id, f);
      toast.success(`${files.length} dokument(er) arkivert`);
      qc.invalidateQueries({ queryKey: ["docs-all"] });
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); e.target.value = ""; }
  }
  return (
    <>
      <PageHeader title="Bilagsarkiv" sub="Dokumentasjon oppbevares i minst 5 år etter regnskapsårets slutt (bokføringsloven § 13). Arkiverte filer kan ikke slettes."
        actions={canWrite && <><input ref={ref} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={onFiles} /><Button disabled={busy} onClick={() => ref.current?.click()}><Upload /> Last opp</Button></>} />
      <Panel>
        {isLoading ? <Empty>Laster …</Empty> : data.length === 0 ? <Empty>Ingen dokumenter. Last opp kvitteringer og fakturaer, og koble dem til bilag.</Empty> : (
          <table className="w-full text-sm">
            <thead className={theadCls}><tr><th className="px-4 py-3">Fil</th><th className="px-4 py-3">Lastet opp</th><th className="px-4 py-3">Koblet til</th><th className="px-4 py-3">Oppbevares til</th><th className="px-4 py-3">SHA-256</th></tr></thead>
            <tbody>{data.map((d) => (
              <tr key={d.id} className="border-b last:border-0">
                <td className="px-4 py-3"><button className="text-primary hover:underline" onClick={() => apneDokument(d.path)}>{d.filnavn}</button></td>
                <td className="px-4 py-3">{dato(d.created_at)}</td>
                <td className="px-4 py-3">
                  {d.voucher_id ? <Link to="/app/bilag/$id" params={{ id: d.voucher_id }}><Badge variant="secondary">Bilag {d.vouchers?.bilagsnr ?? "utkast"}</Badge></Link>
                    : d.supplier_invoice_id ? <Link to="/app/leverandorfakturaer/$id" params={{ id: d.supplier_invoice_id }}><Badge variant="secondary">Lev.faktura {d.supplier_invoices?.fakturanr}</Badge></Link>
                    : <Badge variant="outline">Ikke koblet</Badge>}
                </td>
                <td className="px-4 py-3">{dato(d.oppbevares_til)}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.sha256?.slice(0, 16)}…</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
