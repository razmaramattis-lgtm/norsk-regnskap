import { createFileRoute } from "@tanstack/react-router";
import { useCompany } from "@/lib/company";
import { formatOrgNr } from "@/lib/format";
import { useCustomers, NyKunde } from "@/components/app/kunder";
import { PageHeader, Panel, Empty } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/app/kunder")({
  head: () => ({ meta: [{ title: "Kunder – Fjordbok" }] }),
  component: Kunder,
});

function Kunder() {
  const { canWrite } = useCompany();
  const { data = [], isLoading } = useCustomers();
  return (
    <>
      <PageHeader title="Kunder" actions={canWrite && <NyKunde />} />
      <Panel>
        {isLoading ? <Empty>Laster …</Empty> : data.length === 0 ? <Empty>Ingen kunder ennå.</Empty> : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Navn</th><th className="px-4 py-3">Org.nr</th><th className="px-4 py-3">E-post</th><th className="px-4 py-3">Poststed</th><th className="px-4 py-3 text-right">Frist</th></tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{c.navn}</td>
                  <td className="px-4 py-3 font-mono">{formatOrgNr(c.org_nr)}</td>
                  <td className="px-4 py-3">{c.epost}</td>
                  <td className="px-4 py-3">{[c.postnr, c.poststed].filter(Boolean).join(" ")}{c.land !== "NO" ? ` (${c.land})` : ""}</td>
                  <td className="num px-4 py-3">{c.betalingsfrist} dager</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

