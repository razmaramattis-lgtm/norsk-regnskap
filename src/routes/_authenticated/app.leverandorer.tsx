import { createFileRoute } from "@tanstack/react-router";
import { useCompany } from "@/lib/company";
import { formatOrgNr } from "@/lib/format";
import { useSuppliers, NyLeverandor } from "@/components/app/leverandorer";
import { PageHeader, Panel, Empty, theadCls } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/app/leverandorer")({
  head: () => ({ meta: [{ title: "Leverandører – Fjordbok" }] }),
  component: Leverandorer,
});

function Leverandorer() {
  const { canWrite } = useCompany();
  const { data = [], isLoading } = useSuppliers();
  return (
    <>
      <PageHeader title="Leverandører" actions={canWrite && <NyLeverandor />} />
      <Panel>
        {isLoading ? <Empty>Laster …</Empty> : data.length === 0 ? <Empty>Ingen leverandører ennå.</Empty> : (
          <table className="w-full text-sm">
            <thead className={theadCls}><tr><th className="px-4 py-3">Navn</th><th className="px-4 py-3">Org.nr</th><th className="px-4 py-3">Bankkonto</th><th className="px-4 py-3">Standardkonto</th><th className="px-4 py-3">E-post</th></tr></thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{s.navn}</td>
                  <td className="px-4 py-3 font-mono">{formatOrgNr(s.org_nr)}</td>
                  <td className="px-4 py-3 font-mono">{s.kontonummer}</td>
                  <td className="px-4 py-3 font-mono">{s.standard_konto}</td>
                  <td className="px-4 py-3">{s.epost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
