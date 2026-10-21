import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCompany } from "@/lib/company";
import { dato, idag } from "@/lib/format";
import { dagerTil, fristerForAar, type Frist, type FristKategori } from "@/lib/frister";
import { useHarAnsatte } from "@/lib/integrasjoner/hooks";
import { PageHeader, Panel, StatusPill } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/app/frister")({
  head: () => ({ meta: [{ title: "Frister – Fjordbok" }] }),
  component: Frister,
});

const KATEGORI: Record<FristKategori, string> = {
  mva: "MVA",
  lonn: "Lønn",
  skatt: "Skatt",
  regnskap: "Regnskap",
  selskap: "Selskap",
};

function Frister() {
  const { company } = useCompany();
  const { data: harAnsatte = false } = useHarAnsatte();
  const aar = new Date().getFullYear();
  const [y, setY] = useState(aar);
  const [vis, setVis] = useState<FristKategori | "alle">("alle");
  const i = idag();
  const alle = fristerForAar(y, {
    selskapstype: company.company_type === "as" ? "as" : "enk",
    mvaRegistrert: company.mva_registrert,
    mvaTermin: company.mva_termin,
    harAnsatte,
  });
  const liste = vis === "alle" ? alle : alle.filter((f) => f.kategori === vis);
  const nesteId = alle.find((f) => f.dato >= i)?.id;

  return (
    <>
      <PageHeader
        title="Frister"
        sub="Beregnet ut fra firmatype, MVA-termin og om dere har ansatte. Frister på helg og helligdag er flyttet til neste virkedag."
        actions={
          <select
            className="h-9 rounded-md border border-input bg-card px-2 text-sm"
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
            aria-label="År"
          >
            {[aar - 1, aar, aar + 1].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["alle", "mva", "lonn", "skatt", "regnskap", "selskap"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setVis(k)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${vis === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
          >
            {k === "alle" ? "Alle" : KATEGORI[k]}
          </button>
        ))}
      </div>
      <Panel>
        <ul className="divide-y">
          {liste.map((f) => (
            <Rad key={f.id} f={f} idag={i} neste={f.id === nesteId} />
          ))}
        </ul>
      </Panel>
      <p className="mt-4 text-xs text-muted-foreground">
        Fristene er veiledende og må kontrolleres mot Skatteetaten og Brønnøysundregistrene, særlig
        for årsregnskap og skattemelding der unntak og utsettelser finnes.
      </p>
    </>
  );
}

function Rad({ f, idag: i, neste }: { f: Frist; idag: string; neste: boolean }) {
  const d = dagerTil(i, f.dato);
  const forbi = d < 0;
  const tone = forbi ? "muted" : d <= 7 ? "bad" : d <= 30 ? "warn" : "info";
  const tekst = forbi ? "Passert" : d === 0 ? "I dag" : d === 1 ? "I morgen" : `Om ${d} dager`;
  return (
    <li
      className={`flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 ${forbi ? "opacity-55" : ""} ${neste ? "bg-accent/40" : ""}`}
    >
      <div className="num w-28 shrink-0 text-left font-medium">{dato(f.dato)}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{f.tittel}</div>
        <div className="text-sm text-muted-foreground">
          {f.beskrivelse}
          {f.opprinnelig !== f.dato &&
            ` (opprinnelig ${dato(f.opprinnelig)}, flyttet til virkedag)`}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {KATEGORI[f.kategori]}
        </span>
        <StatusPill tone={tone}>{tekst}</StatusPill>
      </div>
    </li>
  );
}
