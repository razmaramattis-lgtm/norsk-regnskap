import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, idag, kr } from "@/lib/format";
import { dagerTil, kommendeFrister } from "@/lib/frister";
import { useHarAnsatte } from "@/lib/integrasjoner/hooks";
import { beregnMvaMelding, terminer } from "@/lib/mva";
import { PageHeader, Panel, StatusPill, usePostedLines } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { lagGjoremaal } from "@/lib/gjoremaal";
import { maanedstall } from "@/lib/maanedstall";
import { useOversikt } from "@/lib/oversikt";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
  const termin = t[company.mva_termin === "aarlig" ? 0 : Math.floor(new Date().getMonth() / 2)] ?? t[0]!;
  const { data: tl = [] } = usePostedLines(termin.fra, termin.til);
  const { data: harAnsatte = false } = useHarAnsatte();
  const { data: åpne = [] } = useQuery({
    queryKey: ["open-invoices", company.id],
    queryFn: async () => (await supabase.from("invoices").select("total, forfallsdato").eq("company_id", company.id).eq("status", "sendt")).data ?? [],
  });

  const { data: oversikt = [] } = useOversikt();
  const rad = oversikt.find((o) => o.company_id === company.id);
  const gjoremaal = rad ? lagGjoremaal(company, rad, idag()) : [];
  const graf = maanedstall(år, y);

  const sum = (ls: typeof år, f: (k: number) => boolean) => ls.filter((l) => f(Number(l.konto))).reduce((s, l) => s + l.debet - l.kredit, 0);
  const inntekt = -sum(år, (k) => k >= 3000 && k < 4000);
  const resultat = -sum(år, (k) => k >= 3000);
  const bank = sum(alt, (k) => k >= 1900 && k < 2000);
  const mva = beregnMvaMelding(tl).aBetale;
  const utestående = åpne.reduce((s, f) => s + Number(f.total), 0);
  const forfalt = åpne.filter((f) => f.forfallsdato < idag()).length;

  const kommende = kommendeFrister(idag(), {
    selskapstype: company.company_type === "as" ? "as" : "enk",
    mvaRegistrert: company.mva_registrert,
    mvaTermin: company.mva_termin,
    harAnsatte,
  }, 6);

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
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel className="p-6">
          <h2 className="mb-3 text-xl">Til behandling</h2>
          {!rad ? (
            <div className="py-6 text-sm text-muted-foreground">Henter …</div>
          ) : gjoremaal.length === 0 ? (
            <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 text-success" /> Alt er à jour. Godt jobbet!
            </div>
          ) : (
            <ul className="divide-y text-sm">
              {gjoremaal.map((g) => (
                <li key={g.id}>
                  <Link to={g.lenke} className="group flex items-center gap-3 py-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${g.tone === "bad" ? "bg-destructive" : g.tone === "warn" ? "bg-warning" : "bg-primary"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{g.tittel}</span>
                      {g.detalj && <span className="block text-xs text-muted-foreground">{g.detalj}</span>}
                    </span>
                    <ArrowRight className="h-4 w-4 opacity-30 transition group-hover:translate-x-0.5 group-hover:opacity-80" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="p-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl">Inntekter og kostnader {y}</h2>
            <Link to="/app/rapporter" className="text-sm text-primary hover:underline">Resultat og balanse</Link>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graf} barGap={2} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="maaned" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, n: string) => [kr(v), n === "inntekt" ? "Inntekter" : "Kostnader"]}
                />
                <Bar dataKey="inntekt" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="kostnad" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel className="mt-8 p-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl">Kommende frister</h2>
          <Link to="/app/frister" className="text-sm text-primary hover:underline">Alle frister</Link>
        </div>
        <ul className="divide-y text-sm">
          {kommende.map((f) => {
            const d = dagerTil(idag(), f.dato);
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 py-2.5">
                <span className="num w-24 shrink-0 text-left font-medium">{dato(f.dato)}</span>
                <span className="min-w-0 flex-1">{f.tittel}</span>
                <StatusPill tone={d <= 7 ? "bad" : d <= 30 ? "warn" : "info"}>{d === 0 ? "I dag" : d === 1 ? "I morgen" : `Om ${d} dager`}</StatusPill>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
