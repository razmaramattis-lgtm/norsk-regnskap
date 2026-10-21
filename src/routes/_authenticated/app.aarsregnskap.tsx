import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, AlertTriangle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { kr } from "@/lib/format";
import {
  byggBalanse,
  byggResultat,
  saldoFraLinjer,
  sjekklisteAarsregnskap,
  type Linje,
  type Sjekk,
} from "@/lib/aarsregnskap";
import { beregnSelskapsskatt, SELSKAPSSKATT_SATS } from "@/lib/skatt";
import { useIntegrasjoner } from "@/lib/integrasjoner/hooks";
import { PageHeader, Panel, Stat, StatusPill, usePostedLines } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/app/aarsregnskap")({
  head: () => ({ meta: [{ title: "Årsregnskap – Fjordbok" }] }),
  component: Aarsregnskap,
});

function Aarsregnskap() {
  const { company, canWrite } = useCompany();
  const qc = useQueryClient();
  const aar = new Date().getFullYear();
  const [y, setY] = useState(aar - 1);
  const erAs = company.company_type === "as";

  const { data: aarLinjer = [], isLoading } = usePostedLines(`${y}-01-01`, `${y}-12-31`);
  const { data: hist = [] } = usePostedLines("1900-01-01", `${y}-12-31`);
  const { data: integ = [] } = useIntegrasjoner();
  const { data: status } = useQuery({
    queryKey: ["aarsstatus", company.id, y],
    queryFn: async () => {
      const [utkast, avsl] = await Promise.all([
        supabase
          .from("vouchers")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id)
          .eq("status", "utkast")
          .gte("dato", `${y}-01-01`)
          .lte("dato", `${y}-12-31`),
        supabase
          .from("vouchers")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id)
          .eq("kilde", "aarsavslutning")
          .eq("status", "bokfort")
          .gte("dato", `${y}-01-01`)
          .lte("dato", `${y}-12-31`),
      ]);
      return { utkast: utkast.count ?? 0, avsluttet: (avsl.count ?? 0) > 0 };
    },
  });

  const resultat = byggResultat(
    saldoFraLinjer(aarLinjer.filter((l) => Number(l.konto) >= 3000 && Number(l.konto) < 8800)),
  );
  const balSaldo = saldoFraLinjer(hist.filter((l) => Number(l.konto) < 3000));
  const udisponert = -Object.values(
    saldoFraLinjer(hist.filter((l) => Number(l.konto) >= 3000)),
  ).reduce((a, b) => a + b, 0);
  const balanse = byggBalanse(balSaldo, udisponert);

  const sjekker = sjekklisteAarsregnskap({
    selskapstype: erAs ? "as" : "enk",
    balanse,
    aarAvsluttet: status?.avsluttet ?? false,
    antallUtkastBilag: status?.utkast ?? 0,
    periodeLaastTilAarsslutt: !!company.laast_til && company.laast_til >= `${y}-12-31`,
    mvaAvstemt: null,
    bankAvstemt: null,
  });
  const feil = sjekker.filter((s) => s.status === "feil").length;
  const advarsler = sjekker.filter((s) => s.status === "advarsel").length;
  const manuelle = sjekker.filter((s) => s.status === "manuell").length;

  const skatt = erAs ? beregnSelskapsskatt({ resultatForSkatt: resultat.resultatForSkatt }) : null;
  const harLeverandor = (d: string) => integ.some((i) => i.domene === d && i.leverandor);

  async function lagreGrunnlag(type: "aarsregnskap" | "skattemelding") {
    const payload = {
      aar: y,
      selskap: { navn: company.name, orgNr: company.org_nr, type: company.company_type },
      resultat: {
        driftsinntekter: resultat.driftsinntekter,
        driftskostnader: resultat.driftskostnader,
        driftsresultat: resultat.driftsresultat,
        finansresultat: resultat.finansresultat,
        resultatForSkatt: resultat.resultatForSkatt,
        skattekostnad: resultat.skattekostnad,
        aarsresultat: resultat.aarsresultat,
      },
      balanse: {
        sumEiendeler: balanse.sumEiendeler,
        sumEgenkapitalOgGjeld: balanse.sumEgenkapitalOgGjeld,
        avvik: balanse.avvik,
      },
      ...(type === "skattemelding"
        ? { skattegrunnlag: skatt ?? { naeringsresultat: resultat.resultatForSkatt } }
        : {}),
      beregnet: new Date().toISOString(),
    };
    const { error } = await supabase.from("innsendinger").insert({
      company_id: company.id,
      domene: type,
      type,
      periode: String(y),
      status: "klar",
      payload,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Grunnlaget er lagret som klart. Det sendes ikke før en leverandør er valgt.");
    qc.invalidateQueries({ queryKey: ["innsendinger"] });
  }

  return (
    <>
      <PageHeader
        title="Årsregnskap"
        sub={`${erAs ? "Aksjeselskap" : "Enkeltpersonforetak"} · oppstilling fra bokførte bilag, sjekkliste og grunnlag for skattemelding`}
        actions={
          <select
            className="h-9 rounded-md border border-input bg-card px-2 text-sm"
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
            aria-label="Regnskapsår"
          >
            {[aar - 2, aar - 1, aar].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        }
      />

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <Stat label="Driftsinntekter" value={kr(resultat.driftsinntekter)} />
        <Stat label="Driftsresultat" value={kr(resultat.driftsresultat)} />
        <Stat label="Årsresultat" value={kr(resultat.aarsresultat)} />
        <Stat
          label="Sum eiendeler"
          value={kr(balanse.sumEiendeler)}
          sub={balanse.gaarIOpp ? "Balansen går i null" : `Avvik ${kr(balanse.avvik)}`}
          tone={balanse.gaarIOpp ? "ok" : "bad"}
        />
      </div>

      {isLoading ? null : (
        <Tabs defaultValue="sjekk">
          <TabsList>
            <TabsTrigger value="sjekk">
              Sjekkliste{" "}
              {feil + advarsler > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive/15 px-1.5 text-xs text-destructive">
                  {feil + advarsler}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="res">Resultat</TabsTrigger>
            <TabsTrigger value="bal">Balanse</TabsTrigger>
            <TabsTrigger value="skatt">Skatt og innsending</TabsTrigger>
          </TabsList>

          <TabsContent value="sjekk">
            <Panel>
              <ul className="divide-y">
                {sjekker.map((s) => (
                  <SjekkRad key={s.id} s={s} />
                ))}
              </ul>
              <div className="border-t bg-muted/40 px-5 py-3 text-sm text-muted-foreground">
                {feil} feil · {advarsler} advarsler · {manuelle} punkter du må bekrefte selv.{" "}
                {!status?.avsluttet && canWrite && (
                  <Link to="/app/aarsavslutning" className="text-primary hover:underline">
                    Gå til årsavslutning
                  </Link>
                )}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="res">
            <Panel className="p-6">
              <Seksjon linjer={resultat.linjer.slice(0, 2)} />
              <Sum tekst="Sum driftsinntekter" belop={resultat.driftsinntekter} />
              <Seksjon linjer={resultat.linjer.slice(2, 6)} />
              <Sum tekst="Sum driftskostnader" belop={resultat.driftskostnader} />
              <Sum tekst="Driftsresultat" belop={resultat.driftsresultat} sterk />
              <Seksjon linjer={resultat.linjer.slice(6, 8)} />
              <Sum tekst="Resultat før skattekostnad" belop={resultat.resultatForSkatt} sterk />
              <Seksjon linjer={resultat.linjer.slice(8)} />
              <Sum tekst="Årsresultat" belop={resultat.aarsresultat} sterk stor />
            </Panel>
          </TabsContent>

          <TabsContent value="bal">
            <Panel className="grid gap-10 p-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg">Eiendeler</h3>
                <Seksjon linjer={balanse.eiendeler} />
                <Sum tekst="Sum eiendeler" belop={balanse.sumEiendeler} sterk />
              </div>
              <div>
                <h3 className="mb-3 text-lg">Egenkapital og gjeld</h3>
                <Seksjon linjer={balanse.egenkapitalOgGjeld} />
                {Math.abs(balanse.udisponertResultat) > 0.004 && (
                  <div className="mb-4 flex justify-between border-b py-2 font-medium">
                    <span>Udisponert resultat</span>
                    <span className="num">{kr(balanse.udisponertResultat)}</span>
                  </div>
                )}
                <Sum tekst="Sum egenkapital og gjeld" belop={balanse.sumEgenkapitalOgGjeld} sterk />
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="skatt">
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel className="p-6">
                <h3 className="mb-1 text-lg">
                  {erAs ? "Skatteberegning (forenklet)" : "Næringsresultat"}
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Utgangspunkt for skattemelding. Ikke et skatteoppgjør.
                </p>
                <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
                  <dt>Resultat før skattekostnad</dt>
                  <dd className="num">{kr(resultat.resultatForSkatt)}</dd>
                  {skatt && (
                    <>
                      <dt className="text-muted-foreground">
                        Skattepliktig inntekt (uten korrigeringer)
                      </dt>
                      <dd className="num">{kr(skatt.skattepliktigInntekt)}</dd>
                      <dt className="text-muted-foreground">
                        Betalbar skatt ({SELSKAPSSKATT_SATS} %)
                      </dt>
                      <dd className="num">{kr(skatt.betalbarSkatt)}</dd>
                      <dt className="text-muted-foreground">Bokført skattekostnad</dt>
                      <dd className="num">{kr(resultat.skattekostnad)}</dd>
                    </>
                  )}
                </dl>
                {skatt && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Beregningen tar ikke hensyn til permanente og midlertidige forskjeller, fremført
                    underskudd eller utbytte. Gjør disse korrigeringene før skattemeldingen leveres.
                    Skattesatsen må kontrolleres mot gjeldende år.
                  </p>
                )}
              </Panel>
              <Panel className="p-6">
                <h3 className="mb-4 text-lg">Innsending</h3>
                <div className="space-y-5 text-sm">
                  {(
                    [
                      {
                        type: "aarsregnskap",
                        navn: "Årsregnskap til Regnskapsregisteret",
                        vis: erAs,
                      },
                      {
                        type: "skattemelding",
                        navn: erAs
                          ? "Skattemelding for aksjeselskap"
                          : "Skattemelding med næringsspesifikasjon",
                        vis: true,
                      },
                    ] as const
                  )
                    .filter((x) => x.vis)
                    .map((x) => (
                      <div
                        key={x.type}
                        className="flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-medium">{x.navn}</div>
                          <div className="text-xs text-muted-foreground">
                            {harLeverandor(x.type) ? (
                              "Leverandør valgt"
                            ) : (
                              <>
                                Ingen leverandør valgt.{" "}
                                <Link
                                  to="/app/integrasjoner"
                                  className="text-primary hover:underline"
                                >
                                  Velg under Integrasjoner
                                </Link>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {canWrite && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => lagreGrunnlag(x.type)}
                            >
                              Lagre grunnlag
                            </Button>
                          )}
                          <Button size="sm" disabled title="Krever leverandør og støtte i Fjordbok">
                            Send
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </Panel>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

function SjekkRad({ s }: { s: Sjekk }) {
  const ikon = {
    ok: <CheckCircle2 className="h-5 w-5 text-success" />,
    advarsel: <AlertTriangle className="h-5 w-5 text-warning" />,
    feil: <XCircle className="h-5 w-5 text-destructive" />,
    manuell: <CircleDashed className="h-5 w-5 text-muted-foreground" />,
  }[s.status];
  return (
    <li className="flex items-start gap-4 px-5 py-4">
      <span className="mt-0.5">{ikon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{s.tekst}</div>
        {s.detalj && <div className="text-sm text-muted-foreground">{s.detalj}</div>}
      </div>
      {s.status === "manuell" && <StatusPill tone="muted">Bekreft selv</StatusPill>}
    </li>
  );
}

function Seksjon({ linjer }: { linjer: Linje[] }) {
  return (
    <>
      {linjer
        .filter((l) => Math.abs(l.belop) > 0.004)
        .map((l) => (
          <div key={l.id} className="mb-3">
            <div className="flex justify-between py-1.5 font-medium">
              <span>{l.navn}</span>
              <span className="num">{kr(l.belop)}</span>
            </div>
            {l.kontoer.map((k) => (
              <div
                key={k.konto}
                className="flex justify-between py-0.5 pl-4 text-sm text-muted-foreground"
              >
                <span className="font-mono">{k.konto}</span>
                <span className="num">{kr(k.belop)}</span>
              </div>
            ))}
          </div>
        ))}
    </>
  );
}

function Sum({
  tekst,
  belop,
  sterk,
  stor,
}: {
  tekst: string;
  belop: number;
  sterk?: boolean;
  stor?: boolean;
}) {
  return (
    <div
      className={`mb-4 flex justify-between border-t py-2 ${sterk ? "font-semibold" : ""} ${stor ? "border-t-2 border-foreground text-lg" : ""}`}
    >
      <span>{tekst}</span>
      <span className="num">{kr(belop)}</span>
    </div>
  );
}
