import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ExternalLink, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { PageHeader, Panel, StatusPill, selectCls } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { harAdapter } from "@/lib/integrasjoner/adapter";
import { DOMENE_LISTE, type DomeneInfo } from "@/lib/integrasjoner/domener";
import { useIntegrasjoner, type IntegrasjonRad } from "@/lib/integrasjoner/hooks";

export const Route = createFileRoute("/_authenticated/app/integrasjoner")({
  head: () => ({ meta: [{ title: "Integrasjoner – Fjordbok" }] }),
  component: Integrasjoner,
});

const STATUS: Record<string, { tekst: string; tone: "ok" | "warn" | "bad" | "info" | "muted" }> = {
  ikke_valgt: { tekst: "Ikke valgt", tone: "muted" },
  konfigurert: { tekst: "Valgt, ikke slått på", tone: "info" },
  testmodus: { tekst: "Testmodus", tone: "warn" },
  aktiv: { tekst: "Aktiv", tone: "ok" },
  feil: { tekst: "Feil", tone: "bad" },
};

function Integrasjoner() {
  const { data: rader = [] } = useIntegrasjoner();
  const klare = rader.filter((r) => r.status === "aktiv" || r.status === "testmodus").length;
  return (
    <>
      <PageHeader
        title="Integrasjoner"
        sub="Fjordbok er forberedt for e-faktura, MVA, a-melding, årsregnskap og skattemelding. Velg leverandør per tjeneste når dere er klare."
      />
      <Panel className="mb-6 flex items-start gap-4 p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="text-sm text-muted-foreground">
          <p className="text-foreground">
            Ingen data forlater Fjordbok før en integrasjon er valgt og slått på.
          </p>
          <p className="mt-1">
            Her lagres kun leverandørvalg og ikke-hemmelig oppsett. Nøkler, passord og sertifikater
            skal aldri skrives inn her; databasen avviser det.{" "}
            {klare === 0
              ? "Ingen integrasjoner er slått på ennå."
              : `${klare} av ${DOMENE_LISTE.length} er slått på.`}
          </p>
        </div>
      </Panel>
      <div className="space-y-4">
        {DOMENE_LISTE.map((d) => (
          <DomeneKort key={d.id} info={d} rad={rader.find((r) => r.domene === d.id)} />
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Leverandørnavnene er forslag til å starte søket, ikke anbefalinger, og er ikke verifisert
        mot offisielle lister. Kravene er hentet fra myndighetenes sider (se kildene under hver
        tjeneste) og kan endre seg.
      </p>
    </>
  );
}

function DomeneKort({ info, rad }: { info: DomeneInfo; rad: IntegrasjonRad | undefined }) {
  const { company, isAdmin } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [leverandor, setLeverandor] = useState(rad?.leverandor ?? "");
  const [status, setStatus] = useState(rad?.status ?? "ikke_valgt");
  const [miljo, setMiljo] = useState(rad?.miljo ?? "test");
  const [notat, setNotat] = useState(rad?.notat ?? "");
  const [busy, setBusy] = useState(false);

  const s = STATUS[rad?.status ?? "ikke_valgt"] ?? STATUS["ikke_valgt"]!;
  const kanAktiveres = harAdapter(info.id, leverandor.trim() || null);

  async function lagre() {
    const lev = leverandor.trim();
    if (status !== "ikke_valgt" && !lev) {
      toast.error("Skriv inn leverandør først.");
      return;
    }
    if ((status === "aktiv" || status === "testmodus") && !kanAktiveres) {
      toast.error(
        "Kan ikke slås på: støtte for denne leverandøren er ikke bygget ennå. Lagre som «Valgt, ikke slått på».",
      );
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("integrations").upsert(
      {
        company_id: company.id,
        domene: info.id,
        leverandor: lev || null,
        status,
        miljo,
        notat: notat.trim() || null,
      },
      { onConflict: "company_id,domene" },
    );
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lagret");
    qc.invalidateQueries({ queryKey: ["integrations"] });
  }

  return (
    <Panel>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl">{info.navn}</h2>
            <StatusPill tone={s.tone}>{s.tekst}</StatusPill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{info.kort}</p>
          {rad?.leverandor && (
            <p className="mt-1 text-xs text-muted-foreground">
              Leverandør: <span className="text-foreground">{rad.leverandor}</span> ·{" "}
              {rad.miljo === "produksjon" ? "produksjon" : "test"}
            </p>
          )}
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="grid gap-8 border-t p-5 lg:grid-cols-2">
          <div className="space-y-5 text-sm">
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Dette kreves før dere kan gå live
              </h3>
              <ul className="list-disc space-y-1.5 pl-5">
                {info.krav.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Myndighet: {info.myndighet}</p>
            </section>
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Allerede klart i Fjordbok
              </h3>
              <ul className="list-disc space-y-1.5 pl-5">
                {info.klartIFjordbok.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </section>
            {info.kilder.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Kilder
                </h3>
                <ul className="space-y-1">
                  {info.kilder.map((k) => (
                    <li key={k.url}>
                      <a
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                        href={k.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {k.tittel} <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`lev-${info.id}`}>Leverandør</Label>
              <Input
                id={`lev-${info.id}`}
                list={`kand-${info.id}`}
                value={leverandor}
                onChange={(e) => setLeverandor(e.target.value)}
                disabled={!isAdmin}
                placeholder="Skriv eller velg fra forslag"
              />
              <datalist id={`kand-${info.id}`}>
                {info.kandidater.map((k) => (
                  <option key={k.navn} value={k.navn} />
                ))}
              </datalist>
              <ul className="space-y-0.5 pt-1 text-xs text-muted-foreground">
                {info.kandidater.map((k) => (
                  <li key={k.navn}>
                    <button
                      type="button"
                      className="hover:text-foreground hover:underline disabled:no-underline"
                      disabled={!isAdmin}
                      onClick={() => setLeverandor(k.navn)}
                    >
                      {k.navn}
                    </button>
                    {k.merknad ? ` – ${k.merknad}` : ""}{" "}
                    <span className="opacity-60">(uverifisert forslag)</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  className={`${selectCls} w-full`}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={!isAdmin}
                >
                  <option value="ikke_valgt">Ikke valgt</option>
                  <option value="konfigurert">Valgt, ikke slått på</option>
                  <option value="testmodus" disabled={!kanAktiveres}>
                    Testmodus
                  </option>
                  <option value="aktiv" disabled={!kanAktiveres}>
                    Aktiv
                  </option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Miljø</Label>
                <select
                  className={`${selectCls} w-full`}
                  value={miljo}
                  onChange={(e) => setMiljo(e.target.value)}
                  disabled={!isAdmin}
                >
                  <option value="test">Test</option>
                  <option value="produksjon">Produksjon</option>
                </select>
              </div>
            </div>
            {!kanAktiveres && (
              <p className="text-xs text-muted-foreground">
                «Testmodus» og «Aktiv» blir tilgjengelig når støtte for den valgte leverandøren er
                bygget.
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Notat</Label>
              <Input
                value={notat}
                onChange={(e) => setNotat(e.target.value)}
                disabled={!isAdmin}
                placeholder="F.eks. avtalenr., kontaktperson, status på søknad"
              />
            </div>
            {isAdmin ? (
              <Button onClick={lagre} disabled={busy}>
                Lagre
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Kun eier og administrator kan endre integrasjoner.
              </p>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
