import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCompany } from "@/lib/company";
import { kr, dato } from "@/lib/format";
import { beregnMvaMelding, terminer } from "@/lib/mva";
import { PageHeader, Panel, Empty, usePostedLines } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/app/mva")({
  head: () => ({ meta: [{ title: "MVA-melding – Fjordbok" }] }),
  component: Mva,
});

function Mva() {
  const { company } = useCompany();
  const aar = new Date().getFullYear();
  const [valgtAar, setAar] = useState(aar);
  const t = terminer(valgtAar, company.mva_termin);
  const [idx, setIdx] = useState(company.mva_termin === "aarlig" ? 0 : Math.floor(new Date().getMonth() / 2));
  const termin = t[Math.min(idx, t.length - 1)];
  const { data = [], isLoading } = usePostedLines(termin.fra, termin.til);
  const m = beregnMvaMelding(data);

  if (!company.mva_registrert) {
    return (
      <>
        <PageHeader title="MVA-melding" />
        <Panel><Empty>Firmaet er ikke registrert i Merverdiavgiftsregisteret. Endre dette under «Firma og brukere».</Empty></Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="MVA-melding"
        sub={`${termin.navn} · ${dato(termin.fra)}–${dato(termin.til)} · frist 10. i andre måned etter terminen`}
        actions={
          <>
            <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={valgtAar} onChange={(e) => setAar(Number(e.target.value))}>
              {[aar - 2, aar - 1, aar, aar + 1].map((y) => <option key={y}>{y}</option>)}
            </select>
            <select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
              {t.map((x, i) => <option key={x.navn} value={i}>{x.navn}</option>)}
            </select>
          </>
        }
      />
      <Panel>
        {isLoading ? <Empty>Laster …</Empty> : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Beskrivelse</th><th className="px-4 py-3 text-right">Grunnlag</th><th className="px-4 py-3 text-right">Avgift</th></tr>
            </thead>
            <tbody>
              {m.rader.map((r) => (
                <tr key={r.kode} className={`border-b ${r.grunnlag || r.avgift ? "" : "text-muted-foreground"}`}>
                  <td className="px-4 py-3 font-mono">{r.kode}</td>
                  <td className="px-4 py-3">{r.navn}</td>
                  <td className="num px-4 py-3">{kr(r.grunnlag)}</td>
                  <td className="num px-4 py-3">{kr(r.avgift)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/50">
              <tr><td colSpan={3} className="px-4 py-2">Sum utgående avgift</td><td className="num px-4 py-2">{kr(m.utgaende)}</td></tr>
              <tr><td colSpan={3} className="px-4 py-2">Sum fradragsberettiget inngående avgift</td><td className="num px-4 py-2">− {kr(m.inngaende)}</td></tr>
              <tr className="border-t text-base font-semibold">
                <td colSpan={3} className="px-4 py-3">{m.aBetale >= 0 ? "Å betale" : "Til gode"}</td>
                <td className="num px-4 py-3">{kr(Math.abs(m.aBetale))}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Panel>
      <p className="mt-4 text-xs text-muted-foreground">
        Tallene er hentet fra bokførte bilag med MVA-kode i perioden. Innsending via Altinn/Skatteetatens API kommer i en senere versjon.
      </p>
    </>
  );
}
