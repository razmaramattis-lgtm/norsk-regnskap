import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { kr, dato } from "@/lib/format";
import {
  PageHeader,
  Panel,
  Empty,
  usePostedLines,
  usePostedVoucherLines,
  useAccounts,
  type BokfortVoucherLinje,
} from "@/components/app/ui";
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
  { navn: "Andre resultatposter", fra: 8400, til: 8799, fortegn: 1 },
];

type Saldo = [string, number][];

function Rapporter() {
  const aar = new Date().getFullYear();
  const [y, setY] = useState(aar);
  const { data: år = [], isLoading } = usePostedLines(`${y}-01-01`, `${y}-12-31`);
  const { data: hist = [] } = usePostedLines(`1900-01-01`, `${y}-12-31`);
  const { data: bilagslinjer = [] } = usePostedVoucherLines(`1900-01-01`, `${y}-12-31`);
  const { data: kontoer = [] } = useAccounts();
  const navn = (k: string) => kontoer.find((a) => a.number === k)?.name ?? "";

  const saldo = (linjer: typeof år): Saldo => {
    const m = new Map<string, number>();
    for (const l of linjer) m.set(l.konto, (m.get(l.konto) ?? 0) + l.debet - l.kredit);
    return [...m.entries()].filter(([, v]) => Math.abs(v) > 0.004).sort(([a], [b]) => a.localeCompare(b));
  };
  // 88xx (årsresultat/disponering) holdes utenfor årets resultat – ellers blir årsresultatet 0 etter årsavslutning
  const resSaldo = saldo(år.filter((l) => Number(l.konto) >= 3000 && Number(l.konto) < 8800));
  const balSaldo = saldo(hist.filter((l) => Number(l.konto) < 3000));
  // I balansen skal disponert resultat (8800) være med, slik at avsluttede år ikke dobbelttelles
  const resultatHittil = -saldo(hist.filter((l) => Number(l.konto) >= 3000)).reduce((s, [, v]) => s + v, 0);
  const aarsresultat = -resSaldo.reduce((s, [, v]) => s + v, 0);
  // Saldobalanse viser utestående saldo per konto – alltid akkumulert, ikke bare årets bevegelser
  const saldobalanse = saldo(hist);

  const perKonto = useMemo(() => {
    const m = new Map<string, BokfortVoucherLinje[]>();
    for (const l of bilagslinjer) {
      const arr = m.get(l.konto) ?? [];
      arr.push(l);
      m.set(l.konto, arr);
    }
    return m;
  }, [bilagslinjer]);

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
                    {rows.map(([k, v]) => (
                      <KontoRad key={k} konto={k} belop={v * g.fortegn} navn={navn(k)} linjer={perKonto.get(k) ?? []} fra={`${y}-01-01`} til={`${y}-12-31`} fortegn={g.fortegn} />
                    ))}
                  </div>
                );
              })}
              <div className="mt-6 flex justify-between border-t-2 border-foreground pt-3 text-lg font-semibold"><span>Årsresultat</span><span className="num">{kr(aarsresultat)}</span></div>
            </Panel>
          </TabsContent>
          <TabsContent value="bal">
            <Panel className="grid gap-8 p-6 md:grid-cols-2">
              <Side tittel="Eiendeler" rows={balSaldo.filter(([k]) => k < "2000")} fortegn={1} navn={navn} perKonto={perKonto} til={`${y}-12-31`} />
              <Side tittel="Egenkapital og gjeld" rows={balSaldo.filter(([k]) => k >= "2000")} fortegn={-1} navn={navn} perKonto={perKonto} til={`${y}-12-31`} ekstra={["Udisponert resultat", resultatHittil]} />
            </Panel>
          </TabsContent>
          <TabsContent value="saldo">
            <Panel>
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Konto</th><th className="px-4 py-3">Navn</th><th className="px-4 py-3 text-right">Saldo</th></tr></thead>
                <tbody>
                  {saldobalanse.map(([k, v]) => (
                    <KontoRad key={k} asTableRow konto={k} belop={v} navn={navn(k)} linjer={perKonto.get(k) ?? []} til={`${y}-12-31`} fortegn={1} />
                  ))}
                </tbody>
              </table>
            </Panel>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

/** Én kontorad som kan utvides til å vise bilagene bak saldoen. */
function KontoRad({
  konto,
  belop,
  navn,
  linjer,
  fortegn,
  fra = "1900-01-01",
  til,
  asTableRow = false,
}: {
  konto: string;
  belop: number;
  navn: string;
  linjer: BokfortVoucherLinje[];
  fortegn: number;
  fra?: string;
  til: string;
  asTableRow?: boolean;
}) {
  const [åpen, setÅpen] = useState(false);
  const bilag = useMemo(() => {
    const m = new Map<string, { bilagsnr: number | null; dato: string; beskrivelse: string; belop: number }>();
    for (const l of linjer) {
      if (l.dato < fra || l.dato > til) continue;
      const b = m.get(l.voucher_id) ?? { bilagsnr: l.bilagsnr, dato: l.dato, beskrivelse: l.beskrivelse, belop: 0 };
      b.belop += (l.debet - l.kredit) * fortegn;
      m.set(l.voucher_id, b);
    }
    return [...m.entries()].sort((a, b) => a[1].dato.localeCompare(b[1].dato));
  }, [linjer, fra, til, fortegn]);

  const hoved = (
    <>
      <span className="flex min-w-0 items-center gap-1">
        {åpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <span className="font-mono">{konto}</span> <span className="truncate">{navn}</span>
      </span>
      <span className="num shrink-0">{kr(belop)}</span>
    </>
  );
  const detalj = (
    <ul className="space-y-1 py-1 pl-9 text-xs">
      {bilag.map(([id, b]) => (
        <li key={id} className="flex justify-between gap-4">
          <Link to="/app/bilag/$id" params={{ id }} className="truncate text-primary hover:underline">
            {dato(b.dato)} · Bilag {b.bilagsnr} · {b.beskrivelse}
          </Link>
          <span className="num shrink-0">{kr(b.belop)}</span>
        </li>
      ))}
      {!bilag.length && <li className="text-muted-foreground">Ingen bilag i perioden.</li>}
    </ul>
  );

  if (asTableRow) {
    return (
      <>
        <tr className="cursor-pointer border-b hover:bg-muted/50" onClick={() => setÅpen(!åpen)}>
          <td className="px-4 py-2 font-mono">
            <span className="flex items-center gap-1">
              {åpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {konto}
            </span>
          </td>
          <td className="px-4 py-2">{navn}</td>
          <td className="num px-4 py-2 text-right">{kr(belop)}</td>
        </tr>
        {åpen && (
          <tr className="border-b bg-muted/30">
            <td colSpan={3} className="px-4 py-2">{detalj}</td>
          </tr>
        )}
      </>
    );
  }
  return (
    <div className="py-1 pl-4 text-sm text-muted-foreground">
      <button type="button" className="flex w-full items-center justify-between gap-4 text-left hover:text-foreground" onClick={() => setÅpen(!åpen)}>
        {hoved}
      </button>
      {åpen && detalj}
    </div>
  );
}

function Side({
  tittel,
  rows,
  fortegn,
  navn,
  ekstra,
  perKonto,
  til,
}: {
  tittel: string;
  rows: Saldo;
  fortegn: number;
  navn: (k: string) => string;
  ekstra?: [string, number];
  perKonto: Map<string, BokfortVoucherLinje[]>;
  til: string;
}) {
  const sum = rows.reduce((s, [, v]) => s + v * fortegn, 0) + (ekstra?.[1] ?? 0);
  return (
    <div>
      <h3 className="mb-3 text-lg">{tittel}</h3>
      {rows.map(([k, v]) => (
        <KontoRad key={k} konto={k} belop={v * fortegn} navn={navn(k)} linjer={perKonto.get(k) ?? []} til={til} fortegn={fortegn} />
      ))}
      {ekstra && Math.abs(ekstra[1]) > 0.004 && <div className="flex justify-between py-1 text-sm italic"><span>{ekstra[0]}</span><span className="num">{kr(ekstra[1])}</span></div>}
      <div className="mt-2 flex justify-between border-t pt-2 font-semibold"><span>Sum</span><span className="num">{kr(sum)}</span></div>
    </div>
  );
}
