import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCompany } from "@/lib/company";
import { dato, idag, kr } from "@/lib/format";
import { sorterKlienter, vurderKlient, type Nivaa, type OversiktRad } from "@/lib/klienter";
import { useOversikt } from "@/lib/oversikt";
import { Empty, PageHeader, Panel, StatusPill, Th, theadCls } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/app/klienter")({
  head: () => ({ meta: [{ title: "Klientoversikt – Fjordbok" }] }),
  component: Klienter,
});

const NIVAA: Record<Nivaa, { tekst: string; tone: "bad" | "warn" | "ok" }> = {
  haster: { tekst: "Haster", tone: "bad" },
  folg_opp: { tekst: "Følg opp", tone: "warn" },
  ok: { tekst: "Rolig", tone: "ok" },
};

function Klienter() {
  const { companies, setActive } = useCompany();
  const nav = useNavigate();
  const { data: oversikt = [], isLoading } = useOversikt();
  const i = idag();

  const rader = sorterKlienter(
    companies
      .map(({ company, role }) => {
        const o = oversikt.find((x) => x.company_id === company.id);
        return {
          navn: company.name,
          company,
          role,
          o,
          vurdering: o ? vurderKlient(company, o, i) : null,
        };
      })
      .filter(
        (r): r is typeof r & { o: OversiktRad; vurdering: NonNullable<typeof r.vurdering> } =>
          !!r.o && !!r.vurdering,
      ),
  );
  const haster = rader.filter((r) => r.vurdering.nivaa === "haster").length;

  function apne(id: string) {
    setActive(id);
    nav({ to: "/app" });
  }

  return (
    <>
      <PageHeader
        title="Klientoversikt"
        sub={
          rader.length > 0
            ? `${rader.length} ${rader.length === 1 ? "firma" : "firmaer"}, mest hastende først${haster ? ` · ${haster} haster` : ""}.`
            : "Status for alle firmaer du har tilgang til."
        }
      />
      <Panel>
        {isLoading ? (
          <Empty>Laster …</Empty>
        ) : rader.length === 0 ? (
          <Empty>Ingen firmaer å vise.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadCls}>
                <tr>
                  <Th>Klient</Th>
                  <Th>Status</Th>
                  <Th>Neste frist</Th>
                  <Th right>Uavstemt</Th>
                  <Th right>Utkast</Th>
                  <Th right>Forslag</Th>
                  <Th right>Forfalt (kunde)</Th>
                  <Th right>Forfalt (lev.)</Th>
                  <Th>Sist bokført</Th>
                </tr>
              </thead>
              <tbody>
                {rader.map((r) => {
                  const n = NIVAA[r.vurdering.nivaa];
                  return (
                    <tr
                      key={r.company.id}
                      tabIndex={0}
                      role="link"
                      aria-label={`Åpne ${r.navn}`}
                      className="cursor-pointer border-b align-top transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                      onClick={() => apne(r.company.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") apne(r.company.id);
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.navn}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.company.company_type === "as" ? "Aksjeselskap" : "Enkeltpersonforetak"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={n.tone}>{n.tekst}</StatusPill>
                        {r.vurdering.punkter.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                            {r.vurdering.punkter.slice(0, 3).map((p) => (
                              <li key={p.tekst}>{p.tekst}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.vurdering.nesteFrist ? (
                          <>
                            <div>{r.vurdering.nesteFrist.tittel}</div>
                            <div className="text-xs text-muted-foreground">
                              {dato(r.vurdering.nesteFrist.dato)}
                            </div>
                          </>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="num px-4 py-3 text-right">
                        {r.o.ubehandlede_banktransaksjoner || "–"}
                      </td>
                      <td className="num px-4 py-3 text-right">{r.o.bilagsutkast || "–"}</td>
                      <td className="num px-4 py-3 text-right">{r.o.ventende_forslag || "–"}</td>
                      <td className="num px-4 py-3 text-right">
                        {r.o.forfalte_kundefakturaer
                          ? `${r.o.forfalte_kundefakturaer} · ${kr(Number(r.o.forfalt_kundebelop))}`
                          : "–"}
                      </td>
                      <td className="num px-4 py-3 text-right">
                        {r.o.forfalte_leverandorfakturaer
                          ? `${r.o.forfalte_leverandorfakturaer} · ${kr(Number(r.o.forfalt_leverandorbelop))}`
                          : "–"}
                      </td>
                      <td className="px-4 py-3">
                        {r.o.siste_bokforte_bilagsdato
                          ? dato(r.o.siste_bokforte_bilagsdato)
                          : "Aldri"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="mt-4 text-xs text-muted-foreground">
        Rekkefølgen bygger på enkle poeng: nær frist, uavstemte banktransaksjoner, bilagsutkast,
        ventende forslag, forfalte fakturaer og tid siden siste bokføring. Det er et hjelpemiddel
        for å velge hva du tar først, ikke en vurdering av risiko. Du ser bare firmaer du har
        tilgang til.
      </p>
    </>
  );
}
