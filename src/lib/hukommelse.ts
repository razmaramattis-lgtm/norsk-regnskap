import { motpart } from "./laering";

/**
 * Husker tidligere føringer: når du skriver «Telenor», foreslås samme kontering som sist du førte Telenor.
 * Beløpene skaleres til det nye beløpet, så forholdet mellom kostnad og mva blir det samme.
 */

export type HLinje = { konto: string; tekst: string | null; debet: number; kredit: number; mva_kode: string | null };
export type TidligereBilag = { id: string; dato: string; beskrivelse: string; linjer: HLinje[] };
export type Forslag = { bilag: TidligereBilag; antall: number; belop: number };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = (ls: HLinje[]) => r2(ls.reduce((s, l) => s + l.debet, 0));
/** Konteringen uten beløp, så to føringer med samme kontoer regnes som like. */
const mønster = (b: TidligereBilag) => b.linjer.map((l) => `${l.konto}:${l.debet ? "D" : "K"}:${l.mva_kode ?? ""}`).sort().join("|");

/** Inntil `maks` forslag, nyeste først, ett per kontering. `historikk` må være sortert nyest først. */
export function forslagFraHistorikk(tekst: string, historikk: TidligereBilag[], maks = 3): Forslag[] {
  const q = norm(tekst);
  if (q.length < 3) return [];
  const ord = motpart(tekst) ?? [];
  const treff = historikk.filter((b) => {
    const d = norm(b.beskrivelse);
    if (d.startsWith(q) || d.includes(q)) return true;
    const m = motpart(b.beskrivelse);
    return !!m && ord.length > 0 && ord.every((o) => m.includes(o));
  });
  const per = new Map<string, Forslag>();
  for (const b of treff) {
    const k = mønster(b);
    const f = per.get(k);
    if (f) f.antall++;
    else per.set(k, { bilag: b, antall: 1, belop: sum(b.linjer) });
  }
  return [...per.values()].slice(0, maks);
}

/** Skalerer linjene til nytt totalbeløp. Avrundingsdifferansen legges på den største linjen, så bilaget balanserer. */
export function skalerLinjer(linjer: HLinje[], nyttBelop: number): HLinje[] {
  const gammel = sum(linjer);
  if (!gammel || !nyttBelop) return linjer.map((l) => ({ ...l }));
  const f = nyttBelop / gammel;
  const ut = linjer.map((l) => ({ ...l, debet: r2(l.debet * f), kredit: r2(l.kredit * f) }));
  const juster = (side: "debet" | "kredit") => {
    const diff = r2(nyttBelop - ut.reduce((s, l) => s + l[side], 0));
    if (!diff) return;
    const størst = ut.reduce((a, b) => (b[side] > a[side] ? b : a));
    størst[side] = r2(størst[side] + diff);
  };
  juster("debet");
  juster("kredit");
  return ut;
}
