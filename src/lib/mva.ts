/**
 * Norske MVA-koder (SAF-T standard) og beregning av MVA-melding (RF-0002).
 */
export const MVA_SATSER = [25, 15, 12, 0] as const;

export type MvaKode = {
  kode: string;
  navn: string;
  type: "utgaende" | "inngaende" | "grunnlag";
  sats: number;
};

export const MVA_KODER: MvaKode[] = [
  { kode: "3", navn: "Utgående mva, høy sats (25 %)", type: "utgaende", sats: 25 },
  { kode: "31", navn: "Utgående mva, middels sats (15 %)", type: "utgaende", sats: 15 },
  { kode: "33", navn: "Utgående mva, lav sats (12 %)", type: "utgaende", sats: 12 },
  { kode: "5", navn: "Innenlands omsetning, fritatt (0 %)", type: "grunnlag", sats: 0 },
  { kode: "6", navn: "Omsetning utenfor mva-loven", type: "grunnlag", sats: 0 },
  { kode: "52", navn: "Utførsel av varer og tjenester (0 %)", type: "grunnlag", sats: 0 },
  { kode: "1", navn: "Fradrag inngående mva, høy sats (25 %)", type: "inngaende", sats: 25 },
  { kode: "11", navn: "Fradrag inngående mva, middels sats (15 %)", type: "inngaende", sats: 15 },
  { kode: "13", navn: "Fradrag inngående mva, lav sats (12 %)", type: "inngaende", sats: 12 },
];

export const INNGAENDE_KONTO: Record<number, { konto: string; kode: string }> = {
  25: { konto: "2710", kode: "1" },
  15: { konto: "2711", kode: "11" },
  12: { konto: "2712", kode: "13" },
};

export type Linje = { konto: string; debet: number | string; kredit: number | string; mva_kode: string | null };

export type MeldingRad = { kode: string; navn: string; grunnlag: number; avgift: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** MVA-konti (27xx) holder avgift; øvrige holder grunnlag. */
const erMvaKonto = (k: string) => /^27[01]\d$/.test(k);

export function beregnMvaMelding(linjer: Linje[]) {
  const rader: MeldingRad[] = MVA_KODER.map((k) => ({ kode: k.kode, navn: k.navn, grunnlag: 0, avgift: 0 }));
  for (const l of linjer) {
    if (!l.mva_kode) continue;
    const def = MVA_KODER.find((k) => k.kode === l.mva_kode);
    const rad = rader.find((r) => r.kode === l.mva_kode);
    if (!def || !rad) continue;
    const d = Number(l.debet);
    const k = Number(l.kredit);
    // Utgående: kredit-saldo positiv. Inngående: debet-saldo positiv.
    const belop = def.type === "inngaende" ? d - k : k - d;
    if (erMvaKonto(l.konto)) rad.avgift += belop;
    else rad.grunnlag += belop;
  }
  rader.forEach((r) => {
    r.grunnlag = r2(r.grunnlag);
    r.avgift = r2(r.avgift);
  });
  const utgaende = r2(rader.filter((r) => MVA_KODER.find((k) => k.kode === r.kode)!.type === "utgaende").reduce((s, r) => s + r.avgift, 0));
  const inngaende = r2(rader.filter((r) => MVA_KODER.find((k) => k.kode === r.kode)!.type === "inngaende").reduce((s, r) => s + r.avgift, 0));
  return { rader, utgaende, inngaende, aBetale: r2(utgaende - inngaende) };
}

/** Splitter et bruttobeløp (inkl. mva) i netto og mva. */
export function splittBrutto(brutto: number, sats: number) {
  const mva = r2((brutto * sats) / (100 + sats));
  return { netto: r2(brutto - mva), mva };
}

/** MVA-terminer: tomånedlige (1–6) eller årlig. */
export function terminer(aar: number, type: string) {
  if (type === "aarlig") return [{ navn: `År ${aar}`, fra: `${aar}-01-01`, til: `${aar}-12-31` }];
  const navn = ["jan–feb", "mar–apr", "mai–jun", "jul–aug", "sep–okt", "nov–des"];
  return navn.map((n, i) => {
    const m1 = i * 2 + 1;
    const m2 = m1 + 1;
    const last = new Date(aar, m2, 0).getDate();
    return {
      navn: `${i + 1}. termin (${n})`,
      fra: `${aar}-${String(m1).padStart(2, "0")}-01`,
      til: `${aar}-${String(m2).padStart(2, "0")}-${last}`,
    };
  });
}
