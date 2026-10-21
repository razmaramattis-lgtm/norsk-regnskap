import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { idag, kr } from "@/lib/format";
import { beregnMvaMelding, terminer } from "@/lib/mva";
import { PageHeader, Panel, usePostedLines } from "@/components/app/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Oversikt – Fjordbok" }] }),
  component: Oversikt,
});

function Oversikt() {
  const { company, canWrite } = useCompany();
  const y = new Date().getFullYear();
  const { data: år = [] } = usePostedLines(`${y}-01-01`, `${y}-12-31`);
  const { data: alt = [] } = usePostedLines(`1900-01-01`, idag());
  const t = terminer(y, company.mva_termin);
  const termin = t[company.mva_termin === "aarlig" ? 0 : Math.floor(new Date().getMonth() / 2)];
  const { data: tl = [] } = usePostedLines(termin.fra, termin.til);
  const { data: åpne = [] } = useQuery({
    queryKey: ["open-invoices", company.id],
    queryFn: async () => (await supabase.from("invoices").select("total, forfallsdato").eq("company_id", company.id).eq("status", "sendt")).data ?? [],
  });

  const sum = (ls: typeof år, f: (k: number) => boolean) => ls.filter((l) => f(Number(l.konto))).reduce((s, l) => s + l.debet - l.kredit, 0);
  const inntekt = -sum(år, (k) => k >= 3000 && k < 4000);
  const resultat = -sum(år, (k) => k >= 3000);
  const bank = sum(alt, (k) => k >= 1900 && k < 2000);
  const mva = beregnMvaMelding(tl).aBetale;
  const utestående = åpne.reduce((s, f) => s + Number(f.total), 0);
  const forfalt = åpne.filter((f) => f.forfallsdato < idag()).length;

  const kort = [
    { t: `Driftsinntekter ${y}`, v: kr(inntekt) },
    { t: `Resultat ${y}`, v: kr(resultat) },
    { t: "Bank og kontanter", v: kr(bank) },
    { t: `MVA ${termin.navn}`, v: kr(mva) },
    { t: "Utestående kundefordringer", v: kr(utestående), s: forfalt ? `${forfalt} forfalt` : undefined },
  ];

  return (
    <>
      <PageHeader
        title={company.name}
        sub="Oversikt fra bokførte bilag"
        actions={canWrite && (
          <>
            <Button asChild variant="outline"><Link to="/app/fakturaer">Ny faktura</Link></Button>
            <Button asChild><Link to="/app/bilag/ny">Registrer bilag</Link></Button>
          </>
        )}
      />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kort.map((k) => (
          <Panel key={k.t} className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.t}</div>
            <div className="num mt-3 text-left font-serif text-2xl">{k.v}</div>
            {k.s && <div className="mt-1 text-xs text-destructive">{k.s}</div>}
          </Panel>
        ))}
      </div>
      <Panel className="mt-8 p-6">
        <h2 className="mb-3 text-xl">Frister</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {company.mva_registrert && <li>MVA-melding for {termin.navn}: 10. i andre måned etter terminslutt (unntak 10. april for 6. termin og 31. august for 3. termin).</li>}
          <li>A-melding: 5. hver måned (hvis lønn er utbetalt).</li>
          {company.company_type === "as" ? (
            <li>Skattemelding for AS: 31. mai. Årsregnskap til Regnskapsregisteret: 31. juli.</li>
          ) : (
            <li>Skattemelding med næringsspesifikasjon for ENK: 31. mai.</li>
          )}
        </ul>
      </Panel>
    </>
  );
}
