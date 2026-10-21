import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { kr } from "@/lib/format";
import { PageHeader, Panel, Empty, usePostedLines, useAccounts, selectCls } from "@/components/app/ui";
import { KontoSheet, type KontoUtvalg } from "@/components/app/BilagVisning";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/app/rapporter")({
  head: () => ({ meta: [{ title: "Rapporter – Fjordbok" }] }),
  component: Rapporter,
});

const RES_GRUPPER = [
  { navn: "Driftsinntekter", fra: 3000, til: 3999, fortegn: -1 },
  { navn: "Varekostnad", fra: 4000, til: 4999, fortegn: 1 },
  { navn: "Lønnskostnad", fra: 5000, til: 5999, fortegn: 1 },
  { navn: "Avskrivninger", fra: 6000, til: 6099, fortegn: 1 },
  { navn: "Andre driftskostnader", fra: 6100, til: 7999, fortegn: 1 },
  { navn: "Finansinntekter", fra: 8000, til: 8099, fortegn: -1 },
  { navn: "Finanskostnader", fra: 8100, til: 8199, fortegn: 1 },
  { navn: "Skattekostnad", fra: 8300, til: 8399, fortegn: 1 },
];

const MAANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

type Linje = { konto: string; debet: number; kredit: number; dato: string };

function saldo(linjer: Linje[]) {
  const m = new Map<string, number>();
  for (const l of linjer) m.set(l.konto, (m.get(l.konto) ?? 0) + l.debet - l.kredit);
  return m;
}

function Rapporter() {
  const naa = new Date();
  const aar = naa.getFullYear();
  const [y, setY] = useState(aar);
  const [tilMnd, setTilMnd] = useState(12);
  const [valg, setValg] = useState<KontoUtvalg>(null);
  const fra = `${y}-01-01`;
  const til = `${y}-${String(tilMnd).padStart(2, "0")}-${String(new Date(y, tilMnd, 0).getDate()).padStart(2, "0")}`;
  const { data: hist = [], isLoading } = usePostedLines(`1900-01-01`, til);
  const { data: kontoer = [] } = useAccounts();
  const navn = (k: string) => kontoer.find((a) => a.number === k)?.name ?? "";

  const iAar = hist.filter((l) => l.dato >= fra);
  const ib = saldo(hist.filter((l) => l.dato < fra && Number(l.konto) < 3000));
  const bevegelse = saldo(iAar);
  const ub = saldo(hist.filter((l) => Number(l.konto) < 3000));
  const res = [...saldo(iAar.filter((l) => Number(l.konto) >= 3000)).entries()].filter(([, v]) => Math.abs(v) > 0.004).sort(([a], [b]) => a.localeCompare(b));
  const bal = [...ub.entries()].filter(([, v]) => Math.abs(v) > 0.004).sort(([a], [b]) => a.localeCompare(b));
  const resultatHittil = -[...saldo(hist.filter((l) => Number(l.konto) >= 3000)).values()].reduce((s, v) => s + v, 0);
  const aarsresultat = -res.reduce((s, [, v]) => s + v, 0);
  const alleKontoer = [...new Set([...ib.keys(), ...bevegelse.keys()])].sort();

  const aapne = (konto: string, balanse: boolean, tittel?: string) =>
    setValg({ konto, fra: balanse ? "1900-01-01" : fra, til, tittel: tittel ?? (balanse ? "Alle posteringer til og med perioden" : `Posteringer ${y}`) });

  return (
    <>
      <PageHeader
        title="Resultat og balanse"
        sub="Klikk på en konto for å se posteringene, og på en postering for å se bilaget og vedleggene."
        actions={
          <>
            <select className={selectCls} value={tilMnd} onChange={(e) => setTilMnd(Number(e.target.value))} aria-label="Til og med måned">
              {MAANEDER.map((m, i) => <option key={m} value={i + 1}>t.o.m. {m}</option>)}
            </select>
            <select className={selectCls} value={y} onChange={(e) => setY(Number(e.target.value))} aria-label="År">
              {[aar - 2, aar - 1, aar].map((x) => <option key={x}>{x}</option>)}
            </select>
          </>
        }
      />
      {isLoading ? <Empty>Laster …</Empty> : (
        <Tabs defaultValue="res">
          <TabsList><TabsTrigger value="res">Resultatregnskap</TabsTrigger><TabsTrigger value="bal">Balanse</TabsTrigger><TabsTrigger value="saldo">Saldobalanse</TabsTrigger></TabsList>
          <TabsContent value="res">
            <Panel className="p-6">
              {res.length === 0 && <Empty>Ingen bokførte inntekter eller kostnader i perioden.</Empty>}
              {RES_GRUPPER.map((g) => {
                const rows = res.filter(([k]) => Number(k) >= g.fra && Number(k) <= g.til);
                if (!rows.length) return null;
                const sum = rows.reduce((s, [, v]) => s + v * g.fortegn, 0);
                return (
                  <div key={g.navn} className="mb-4">
                    <div className="flex justify-between border-b py-2 font-medium"><span>{g.navn}</span><span className="num">{kr(sum)}</span></div>
                    {rows.map(([k, v]) => <KontoRad key={k} konto={k} navn={navn(k)} belop={v * g.fortegn} onClick={() => aapne(k, false)} />)}
                  </div>
                );
              })}
              <div className="mt-6 flex justify-between border-t-2 border-foreground pt-3 text-lg font-semibold"><span>Resultat</span><span className="num">{kr(aarsresultat)}</span></div>
            </Panel>
          </TabsContent>
          <TabsContent value="bal">
            <Panel className="grid gap-8 p-6 md:grid-cols-2">
              <Side tittel="Eiendeler" rows={bal.filter(([k]) => k < "2000")} fortegn={1} navn={navn} onKonto={(k) => aapne(k, true)} />
              <Side tittel="Egenkapital og gjeld" rows={bal.filter(([k]) => k >= "2000")} fortegn={-1} navn={navn} onKonto={(k) => aapne(k, true)} ekstra={["Udisponert resultat", resultatHittil]} />
            </Panel>
          </TabsContent>
          <TabsContent value="saldo">
            <Panel className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="px-4 py-3">Konto</th><th className="px-4 py-3">Navn</th><th className="px-4 py-3 text-right">Inngående</th><th className="px-4 py-3 text-right">Bevegelse</th><th className="px-4 py-3 text-right">Utgående</th><th /></tr>
                </thead>
                <tbody>
                  {alleKontoer.map((k) => {
                    const i = ib.get(k) ?? 0;
                    const b = bevegelse.get(k) ?? 0;
                    if (Math.abs(i) < 0.005 && Math.abs(b) < 0.005) return null;
                    return (
                      <tr key={k} onClick={() => aapne(k, false)} className="group cursor-pointer border-b transition-colors hover:bg-primary/5">
                        <td className="px-4 py-2 font-mono">{k}</td>
                        <td className="px-4 py-2">{navn(k)}</td>
                        <td className="num px-4 py-2 text-muted-foreground">{i ? kr(i) : ""}</td>
                        <td className="num px-4 py-2">{kr(b)}</td>
                        <td className="num px-4 py-2 font-medium">{kr(i + b)}</td>
                        <td className="w-6 pr-3"><ChevronRight className="h-4 w-4 opacity-0 transition group-hover:opacity-60" /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-medium">
                    <td colSpan={2} className="px-4 py-3">Sum (skal være 0)</td>
                    <td className="num px-4 py-3">{kr([...ib.values()].reduce((s, v) => s + v, 0))}</td>
                    <td className="num px-4 py-3">{kr([...bevegelse.values()].reduce((s, v) => s + v, 0))}</td>
                    <td className="num px-4 py-3">{kr([...ib.values(), ...bevegelse.values()].reduce((s, v) => s + v, 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </Panel>
          </TabsContent>
        </Tabs>
      )}
      <KontoSheet valg={valg} onClose={() => setValg(null)} />
    </>
  );
}

function KontoRad({ konto, navn, belop, onClick }: { konto: string; navn: string; belop: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center justify-between rounded-md py-1 pl-4 pr-1 text-left text-sm text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground">
      <span><span className="font-mono">{konto}</span> {navn}</span>
      <span className="flex items-center gap-1"><span className="num">{kr(belop)}</span><ChevronRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-60" /></span>
    </button>
  );
}

function Side({ tittel, rows, fortegn, navn, ekstra, onKonto }: { tittel: string; rows: [string, number][]; fortegn: number; navn: (k: string) => string; ekstra?: [string, number]; onKonto: (k: string) => void }) {
  const sum = rows.reduce((s, [, v]) => s + v * fortegn, 0) + (ekstra?.[1] ?? 0);
  return (
    <div>
      <h3 className="mb-3 text-lg">{tittel}</h3>
      {rows.map(([k, v]) => <KontoRad key={k} konto={k} navn={navn(k)} belop={v * fortegn} onClick={() => onKonto(k)} />)}
      {ekstra && Math.abs(ekstra[1]) > 0.004 && <div className="flex justify-between py-1 pl-4 pr-6 text-sm italic"><span>{ekstra[0]}</span><span className="num">{kr(ekstra[1])}</span></div>}
      <div className="mt-2 flex justify-between border-t pt-2 font-semibold"><span>Sum</span><span className="num">{kr(sum)}</span></div>
    </div>
  );
}
