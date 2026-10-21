import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { kr } from "@/lib/format";
import { PageHeader, Panel, Empty, usePostedLines, useAccounts } from "@/components/app/ui";
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

function Rapporter() {
  const aar = new Date().getFullYear();
  const [y, setY] = useState(aar);
  const { data: år = [], isLoading } = usePostedLines(`${y}-01-01`, `${y}-12-31`);
  const { data: hist = [] } = usePostedLines(`1900-01-01`, `${y}-12-31`);
  const { data: kontoer = [] } = useAccounts();
  const navn = (k: string) => kontoer.find((a) => a.number === k)?.name ?? "";

  const saldo = (linjer: typeof år) => {
    const m = new Map<string, number>();
    for (const l of linjer) m.set(l.konto, (m.get(l.konto) ?? 0) + l.debet - l.kredit);
    return [...m.entries()].filter(([, v]) => Math.abs(v) > 0.004).sort(([a], [b]) => a.localeCompare(b));
  };
  const resSaldo = saldo(år.filter((l) => Number(l.konto) >= 3000));
  const balSaldo = saldo(hist.filter((l) => Number(l.konto) < 3000));
  const resultatHittil = -saldo(hist.filter((l) => Number(l.konto) >= 3000)).reduce((s, [, v]) => s + v, 0);
  const aarsresultat = -resSaldo.reduce((s, [, v]) => s + v, 0);

  return (
    <>
      <PageHeader
        title="Rapporter"
        actions={<select className="h-9 rounded-md border border-input bg-card px-2 text-sm" value={y} onChange={(e) => setY(Number(e.target.value))}>{[aar - 2, aar - 1, aar].map((x) => <option key={x}>{x}</option>)}</select>}
      />
      {isLoading ? <Empty>Laster …</Empty> : (
        <Tabs defaultValue="res">
          <TabsList><TabsTrigger value="res">Resultatregnskap</TabsTrigger><TabsTrigger value="bal">Balanse</TabsTrigger><TabsTrigger value="saldo">Saldobalanse</TabsTrigger></TabsList>
          <TabsContent value="res">
            <Panel className="p-6">
              {RES_GRUPPER.map((g) => {
                const rows = resSaldo.filter(([k]) => Number(k) >= g.fra && Number(k) <= g.til);
                if (!rows.length) return null;
                const sum = rows.reduce((s, [, v]) => s + v * g.fortegn, 0);
                return (
                  <div key={g.navn} className="mb-4">
                    <div className="flex justify-between border-b py-2 font-medium"><span>{g.navn}</span><span className="num">{kr(sum)}</span></div>
                    {rows.map(([k, v]) => <div key={k} className="flex justify-between py-1 pl-4 text-sm text-muted-foreground"><span><span className="font-mono">{k}</span> {navn(k)}</span><span className="num">{kr(v * g.fortegn)}</span></div>)}
                  </div>
                );
              })}
              <div className="mt-6 flex justify-between border-t-2 border-foreground pt-3 text-lg font-semibold"><span>Årsresultat</span><span className="num">{kr(aarsresultat)}</span></div>
            </Panel>
          </TabsContent>
          <TabsContent value="bal">
            <Panel className="grid gap-8 p-6 md:grid-cols-2">
              <Side tittel="Eiendeler" rows={balSaldo.filter(([k]) => k < "2000")} fortegn={1} navn={navn} />
              <Side tittel="Egenkapital og gjeld" rows={balSaldo.filter(([k]) => k >= "2000")} fortegn={-1} navn={navn} ekstra={["Udisponert resultat", resultatHittil]} />
            </Panel>
          </TabsContent>
          <TabsContent value="saldo">
            <Panel>
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Konto</th><th className="px-4 py-3">Navn</th><th className="px-4 py-3 text-right">Saldo</th></tr></thead>
                <tbody>{[...balSaldo, ...resSaldo].map(([k, v]) => <tr key={k} className="border-b"><td className="px-4 py-2 font-mono">{k}</td><td className="px-4 py-2">{navn(k)}</td><td className="num px-4 py-2">{kr(v)}</td></tr>)}</tbody>
              </table>
            </Panel>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

function Side({ tittel, rows, fortegn, navn, ekstra }: { tittel: string; rows: [string, number][]; fortegn: number; navn: (k: string) => string; ekstra?: [string, number] }) {
  const sum = rows.reduce((s, [, v]) => s + v * fortegn, 0) + (ekstra?.[1] ?? 0);
  return (
    <div>
      <h3 className="mb-3 text-lg">{tittel}</h3>
      {rows.map(([k, v]) => <div key={k} className="flex justify-between py-1 text-sm"><span><span className="font-mono">{k}</span> {navn(k)}</span><span className="num">{kr(v * fortegn)}</span></div>)}
      {ekstra && Math.abs(ekstra[1]) > 0.004 && <div className="flex justify-between py-1 text-sm italic"><span>{ekstra[0]}</span><span className="num">{kr(ekstra[1])}</span></div>}
      <div className="mt-2 flex justify-between border-t pt-2 font-semibold"><span>Sum</span><span className="num">{kr(sum)}</span></div>
    </div>
  );
}
