import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { kr } from "@/lib/format";
import { PageHeader, Panel, Empty, theadCls } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/app/logg")({
  head: () => ({ meta: [{ title: "Revisjonslogg – Fjordbok" }] }),
  component: Logg,
});

const H: Record<string, string> = { bokfort: "Bilag bokført", periode_laast: "Periode låst" };

function Logg() {
  const { company } = useCompany();
  const { data = [], isLoading } = useQuery({
    queryKey: ["audit", company.id],
    queryFn: async () => (await supabase.from("audit_log").select("*").eq("company_id", company.id).order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  return (
    <>
      <PageHeader title="Revisjonslogg" sub="Sporbarhet for alle bokføringer og låsinger. Loggen kan ikke endres." />
      <Panel>
        {isLoading ? <Empty>Laster …</Empty> : data.length === 0 ? <Empty>Ingen hendelser ennå.</Empty> : (
          <table className="w-full text-sm">
            <thead className={theadCls}><tr><th className="px-4 py-3">Tidspunkt</th><th className="px-4 py-3">Hendelse</th><th className="px-4 py-3">Detaljer</th><th className="px-4 py-3">Bruker</th></tr></thead>
            <tbody>{data.map((l) => {
              const d = (l.detaljer ?? {}) as Record<string, unknown>;
              return (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{new Date(l.created_at).toLocaleString("nb-NO")}</td>
                  <td className="px-4 py-2">{H[l.handling] ?? l.handling}</td>
                  <td className="px-4 py-2">{d.bilagsnr ? `Bilag ${d.bilagsnr} · ${kr(d.belop as number)}` : d.til ? `Til og med ${d.til}` : ""}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{l.user_id?.slice(0, 8)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
