import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato } from "@/lib/format";
import { PageHeader, Panel, Empty } from "@/components/app/ui";
import { BilagEditor } from "@/components/app/BilagEditor";
import { Vedlegg, useDokumenter } from "@/components/app/Vedlegg";
import { BilagDokumenter, BilagLinjer } from "@/components/app/BilagVisning";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/bilag/$id")({
  head: () => ({ meta: [{ title: "Bilag – Fjordbok" }] }),
  component: BilagSide,
});

function BilagSide() {
  const { id } = Route.useParams();
  const { canWrite } = useCompany();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: v, isLoading } = useQuery({
    queryKey: ["voucher", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("vouchers").select("*, voucher_lines(*)").eq("id", id).single();
      if (error) throw error;
      data.voucher_lines.sort((a, b) => a.linjenr - b.linjenr);
      return data;
    },
  });
  const { data: docs = [] } = useDokumenter({ voucherId: id });
  if (isLoading || !v) return <Empty>Laster …</Empty>;
  const harDocs = docs.length > 0;

  /** Nytt utkast med samme linjer og dagens dato, f.eks. for faste månedlige posteringer. */
  async function kopier() {
    const { data: ny, error } = await supabase
      .from("vouchers")
      .insert({ company_id: v!.company_id, dato: new Date().toISOString().slice(0, 10), beskrivelse: v!.beskrivelse })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    const { error: e2 } = await supabase.from("voucher_lines").insert(
      v!.voucher_lines.map((l) => ({ voucher_id: ny.id, company_id: l.company_id, konto: l.konto, tekst: l.tekst, debet: l.debet, kredit: l.kredit, mva_kode: l.mva_kode, linjenr: l.linjenr })),
    );
    if (e2) { await supabase.from("vouchers").delete().eq("id", ny.id); toast.error(e2.message); return; }
    toast.success("Kopi laget som utkast");
    qc.invalidateQueries();
    nav({ to: "/app/bilag/$id", params: { id: ny.id } });
  }

  if (v.status === "utkast") {
    return (
      <>
        <PageHeader
          title="Utkast"
          actions={canWrite && (
            <Button variant="ghost" onClick={async () => {
              await supabase.from("vouchers").delete().eq("id", id);
              qc.invalidateQueries();
              nav({ to: "/app/bilag" });
            }}>Slett utkast</Button>
          )}
        />
        <div className="mb-4"><Vedlegg voucherId={id} /></div>
        <div className={harDocs ? "grid gap-6 2xl:grid-cols-[minmax(0,1fr)_480px]" : ""}>
        {harDocs && <BilagDokumenter voucherId={id} className="h-[70vh] 2xl:order-2 2xl:sticky 2xl:top-6" />}
        <div className="min-w-0">
        <BilagEditor
          voucherId={id}
          initial={{
            dato: v.dato,
            beskrivelse: v.beskrivelse,
            linjer: v.voucher_lines.map((l) => ({ konto: l.konto, tekst: l.tekst ?? "", debet: Number(l.debet) ? String(l.debet) : "", kredit: Number(l.kredit) ? String(l.kredit) : "", mva_kode: l.mva_kode ?? "" })),
          }}
        />
        </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Bilag ${v.bilagsnr}`}
        sub={`${dato(v.dato)} · ${v.beskrivelse}`}
        actions={canWrite && (
          <>
          <Button variant="outline" onClick={kopier}><Copy /> Kopier</Button>
          <Button variant="outline" onClick={async () => {
            const { data, error } = await supabase.rpc("reverse_voucher", { _voucher: id });
            if (error) { toast.error(error.message); return; }
            toast.success("Korreksjonsbilag bokført");
            qc.invalidateQueries();
            nav({ to: "/app/bilag/$id", params: { id: data } });
          }}>Korriger (reverser)</Button>
          </>
        )}
      />
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" /> Bokført {v.bokfort_at ? new Date(v.bokfort_at).toLocaleString("nb-NO") : ""} – kan ikke endres.
      </div>
      <div className="mb-4"><Vedlegg voucherId={id} /></div>
      <div className={harDocs ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]" : ""}>
        <Panel className="h-fit overflow-x-auto"><BilagLinjer linjer={v.voucher_lines} /></Panel>
        {harDocs && <BilagDokumenter voucherId={id} className="h-[75vh]" />}
      </div>
    </>
  );
}
