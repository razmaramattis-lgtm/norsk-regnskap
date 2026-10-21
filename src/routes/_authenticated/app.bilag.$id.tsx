import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, kr } from "@/lib/format";
import { PageHeader, Panel, Empty, useAccounts } from "@/components/app/ui";
import { BilagEditor } from "@/components/app/BilagEditor";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/bilag/$id")({
  head: () => ({ meta: [{ title: "Bilag – Fjordbok" }] }),
  component: BilagSide,
});

function BilagSide() {
  const { id } = Route.useParams();
  const { canWrite } = useCompany();
  const { data: kontoer = [] } = useAccounts();
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
  if (isLoading || !v) return <Empty>Laster …</Empty>;

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
        <BilagEditor
          voucherId={id}
          initial={{
            dato: v.dato,
            beskrivelse: v.beskrivelse,
            linjer: v.voucher_lines.map((l) => ({ konto: l.konto, tekst: l.tekst ?? "", debet: Number(l.debet) ? String(l.debet) : "", kredit: Number(l.kredit) ? String(l.kredit) : "", mva_kode: l.mva_kode ?? "" })),
          }}
        />
      </>
    );
  }

  const sum = v.voucher_lines.reduce((s, l) => s + Number(l.debet), 0);
  return (
    <>
      <PageHeader
        title={`Bilag ${v.bilagsnr}`}
        sub={`${dato(v.dato)} · ${v.beskrivelse}`}
        actions={canWrite && (
          <Button variant="outline" onClick={async () => {
            const { data, error } = await supabase.rpc("reverse_voucher", { _voucher: id });
            if (error) { toast.error(error.message); return; }
            toast.success("Korreksjonsbilag bokført");
            qc.invalidateQueries();
            nav({ to: "/app/bilag/$id", params: { id: data } });
          }}>Korriger (reverser)</Button>
        )}
      />
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" /> Bokført {v.bokfort_at ? new Date(v.bokfort_at).toLocaleString("nb-NO") : ""} – kan ikke endres.
      </div>
      <Panel>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-3">Konto</th><th className="px-4 py-3">Tekst</th><th className="px-4 py-3">MVA</th><th className="px-4 py-3 text-right">Debet</th><th className="px-4 py-3 text-right">Kredit</th></tr>
          </thead>
          <tbody>
            {v.voucher_lines.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="px-4 py-3"><span className="font-mono">{l.konto}</span> <span className="text-muted-foreground">{kontoer.find((k) => k.number === l.konto)?.name}</span></td>
                <td className="px-4 py-3">{l.tekst}</td>
                <td className="px-4 py-3 font-mono">{l.mva_kode}</td>
                <td className="num px-4 py-3">{Number(l.debet) ? kr(l.debet) : ""}</td>
                <td className="num px-4 py-3">{Number(l.kredit) ? kr(l.kredit) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t bg-muted/50 font-medium"><td colSpan={3} className="px-4 py-3">Sum</td><td className="num px-4 py-3">{kr(sum)}</td><td className="num px-4 py-3">{kr(sum)}</td></tr></tfoot>
        </table>
      </Panel>
    </>
  );
}
