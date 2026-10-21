/**
 * Norske MVA-koder (SAF-T standard) og beregning av MVA-melding (RF-0002).
 */
export const MVA_SATSER = [25, 15, 12, 0] as const;

export type MvaKode = {
  kode: string;
  navn: string;
  /**
   * utgaende/inngaende: vanlig innenlands mva. grunnlag: kun grunnlag.
   * omvendt: beregnet avgift (omvendt avgiftsplikt/import) som føres både som utgående (270x)
   * og, når `fradrag` er true, som inngående (271x) i samme bilag.
   */
  type: "utgaende" | "inngaende" | "grunnlag" | "omvendt";
  sats: number;
  /** Kun for type "omvendt": har kjøperen fradragsrett for den beregnede avgiften? */
  fradrag?: boolean;
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
  {
    kode: "51",
    navn: "Innenlands omsetning med omvendt avgiftsplikt (0 %)",
    type: "grunnlag",
    sats: 0,
  },
  // Innførsel av varer og tjenestekjøp fra utlandet. Kodene følger Skatteetatens standard MVA-koder
  // (SAF-T); kontroller mot gjeldende kodeliste før første innsending.
  {
    kode: "14",
    navn: "Fradrag inngående mva ved innførsel, høy sats (25 %), betalt ved import",
    type: "inngaende",
    sats: 25,
  },
  {
    kode: "15",
    navn: "Fradrag inngående mva ved innførsel, middels sats (15 %), betalt ved import",
    type: "inngaende",
    sats: 15,
  },
  {
    kode: "81",
    navn: "Innførsel av varer, høy sats (25 %), med fradragsrett",
    type: "omvendt",
    sats: 25,
    fradrag: true,
  },
  {
    kode: "82",
    navn: "Innførsel av varer, høy sats (25 %), uten fradragsrett",
    type: "omvendt",
    sats: 25,
    fradrag: false,
  },
  {
    kode: "83",
    navn: "Innførsel av varer, middels sats (15 %), med fradragsrett",
    type: "omvendt",
    sats: 15,
    fradrag: true,
  },
  {
    kode: "84",
    navn: "Innførsel av varer, middels sats (15 %), uten fradragsrett",
    type: "omvendt",
    sats: 15,
    fradrag: false,
  },
  { kode: "85", navn: "Innførsel av varer uten mva (0 %)", type: "grunnlag", sats: 0 },
  {
    kode: "86",
    navn: "Kjøp av tjenester fra utlandet, høy sats (25 %), med fradragsrett",
    type: "omvendt",
    sats: 25,
    fradrag: true,
  },
  {
    kode: "87",
    navn: "Kjøp av tjenester fra utlandet, høy sats (25 %), uten fradragsrett",
    type: "omvendt",
    sats: 25,
    fradrag: false,
  },
  {
    kode: "88",
    navn: "Kjøp av tjenester fra utlandet, lav sats (12 %), med fradragsrett",
    type: "omvendt",
    sats: 12,
    fradrag: true,
  },
  {
    kode: "89",
    navn: "Kjøp av tjenester fra utlandet, lav sats (12 %), uten fradragsrett",
    type: "omvendt",
    sats: 12,
    fradrag: false,
  },
];

/** Koder der kjøper selv beregner avgiften (omvendt avgiftsplikt). */
export const OMVENDT_KODER = MVA_KODER.filter((k) => k.type === "omvendt");

export const INNGAENDE_KONTO: Record<number, { konto: string; kode: string }> = {
  25: { konto: "2710", kode: "1" },
  15: { konto: "2711", kode: "11" },
  12: { konto: "2712", kode: "13" },
};

export type Linje = {
  konto: string;
  debet: number | string;
  kredit: number | string;
  mva_kode: string | null;
};

/**
 * `avgift` er utgående/beregnet avgift for raden; `fradrag` er inngående avgift som trekkes fra
 * (for vanlige inngående koder ligger beløpet i `avgift`, for omvendt avgiftsplikt i `fradrag`).
 */
export type MeldingRad = {
  kode: string;
  navn: string;
  grunnlag: number;
  avgift: number;
  fradrag: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** MVA-konti (27xx) holder avgift; øvrige holder grunnlag. */
const erMvaKonto = (k: string) => /^27[01]\d$/.test(k);
/** 270x = utgående, 271x = inngående. */
const erUtgaendeKonto = (k: string) => /^270\d$/.test(k);

export function beregnMvaMelding(linjer: Linje[]) {
  const rader: MeldingRad[] = MVA_KODER.map((k) => ({
    kode: k.kode,
    navn: k.navn,
    grunnlag: 0,
    avgift: 0,
    fradrag: 0,
  }));
  for (const l of linjer) {
    if (!l.mva_kode) continue;
    const def = MVA_KODER.find((k) => k.kode === l.mva_kode);
    const rad = rader.find((r) => r.kode === l.mva_kode);
    if (!def || !rad) continue;
    const d = Number(l.debet);
    const k = Number(l.kredit);
    if (def.type === "omvendt") {
      // Grunnlaget er kostnaden (debet). Beregnet avgift står som kredit på 270x (utgående)
      // og, med fradragsrett, som debet på 271x (inngående) i samme bilag.
      if (!erMvaKonto(l.konto)) rad.grunnlag += d - k;
      else if (erUtgaendeKonto(l.konto)) rad.avgift += k - d;
      else rad.fradrag += d - k;
      continue;
    }
    // Utgående: kredit-saldo positiv. Inngående: debet-saldo positiv.
    const belop = def.type === "inngaende" ? d - k : k - d;
    if (erMvaKonto(l.konto)) rad.avgift += belop;
    else rad.grunnlag += belop;
  }
  rader.forEach((r) => {
    r.grunnlag = r2(r.grunnlag);
    r.avgift = r2(r.avgift);
    r.fradrag = r2(r.fradrag);
  });
  const typeFor = (kode: string) => MVA_KODER.find((k) => k.kode === kode)!.type;
  const utgaende = r2(
    rader
      .filter((r) => ["utgaende", "omvendt"].includes(typeFor(r.kode)))
      .reduce((s, r) => s + r.avgift, 0),
  );
  const inngaende = r2(
    rader.reduce((s, r) => {
      const t = typeFor(r.kode);
      return s + (t === "inngaende" ? r.avgift : t === "omvendt" ? r.fradrag : 0);
    }, 0),
  );
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

export type OppgjorLinje = { konto: string; tekst: string; debet: number; kredit: number };

const UTGAENDE_KONTI = ["2700", "2701", "2702"] as const;
const INNGAENDE_KONTI = ["2710", "2711", "2712"] as const;

/**
 * MVA-oppgjør: nuller ut utgående (2700–2702) og inngående (2710–2712) MVA-konti for terminen
 * og fører differansen på oppgjørskonto 2740 (skyldig = kredit, tilgode = debet).
 *
 * Linjene får bevisst ingen MVA-kode, så oppgjøret ikke telles på nytt i MVA-meldingen.
 * Returnerer tom liste når det ikke er noe å gjøre opp.
 */
export function byggMvaOppgjor(
  linjer: Pick<Linje, "konto" | "debet" | "kredit">[],
): OppgjorLinje[] {
  const saldo = new Map<string, number>();
  for (const l of linjer)
    saldo.set(l.konto, r2((saldo.get(l.konto) ?? 0) + Number(l.debet) - Number(l.kredit)));

  const ut: OppgjorLinje[] = [];
  let skyldig = 0;
  for (const k of UTGAENDE_KONTI) {
    const s = saldo.get(k) ?? 0; // kredit-saldo er negativ
    if (Math.abs(s) < 0.005) continue;
    ut.push(
      s < 0
        ? { konto: k, tekst: "MVA-oppgjør utgående", debet: r2(-s), kredit: 0 }
        : { konto: k, tekst: "MVA-oppgjør utgående", debet: 0, kredit: r2(s) },
    );
    skyldig = r2(skyldig - s);
  }
  for (const k of INNGAENDE_KONTI) {
    const s = saldo.get(k) ?? 0; // debet-saldo er positiv
    if (Math.abs(s) < 0.005) continue;
    ut.push(
      s > 0
        ? { konto: k, tekst: "MVA-oppgjør inngående", debet: 0, kredit: r2(s) }
        : { konto: k, tekst: "MVA-oppgjør inngående", debet: r2(-s), kredit: 0 },
    );
    skyldig = r2(skyldig - s);
  }
  if (!ut.length) return [];
  if (skyldig > 0.004)
    ut.push({ konto: "2740", tekst: "Skyldig MVA til oppgjør", debet: 0, kredit: skyldig });
  else if (skyldig < -0.004)
    ut.push({ konto: "2740", tekst: "MVA til gode", debet: r2(-skyldig), kredit: 0 });
  return ut;
}

const UTGAENDE_KONTO: Record<number, string> = { 25: "2700", 15: "2701", 12: "2702" };

export type OmvendtLinje = {
  konto: string;
  tekst: string;
  debet: number;
  kredit: number;
  mva_kode: string | null;
};

/**
 * Posteringer for kjøp med omvendt avgiftsplikt (tjenester fra utlandet, innførsel): kjøperen
 * beregner avgiften selv. `netto` er fakturabeløpet uten norsk mva.
 *
 * Med fradragsrett: kostnad + inngående avgift (debet) og utgående avgift (kredit); avgiften går i null.
 * Uten fradragsrett: avgiften blir en del av kostnaden (egen linje uten mva-kode, så grunnlaget ikke
 * telles dobbelt) og føres bare som utgående avgift.
 */
export function byggOmvendtAvgift(
  netto: number,
  kode: string,
  kostnadskonto: string,
  motkonto: string,
): OmvendtLinje[] {
  const def = MVA_KODER.find((k) => k.kode === kode);
  if (!def || def.type !== "omvendt")
    throw new Error(`MVA-kode ${kode} har ikke omvendt avgiftsplikt`);
  if (!(netto > 0)) throw new Error("Beløpet må være større enn null");
  const avgift = r2((netto * def.sats) / 100);
  const ut = UTGAENDE_KONTO[def.sats];
  const inn = INNGAENDE_KONTO[def.sats];
  if (!ut || !inn) throw new Error(`Mangler MVA-konto for ${def.sats} %`);
  const ls: OmvendtLinje[] = [
    {
      konto: kostnadskonto,
      tekst: "Kjøp, omvendt avgiftsplikt",
      debet: r2(netto),
      kredit: 0,
      mva_kode: kode,
    },
  ];
  if (def.fradrag) {
    ls.push({
      konto: inn.konto,
      tekst: `Inngående mva ${def.sats} % (beregnet)`,
      debet: avgift,
      kredit: 0,
      mva_kode: kode,
    });
  } else {
    ls.push({
      konto: kostnadskonto,
      tekst: "Ikke fradragsberettiget mva",
      debet: avgift,
      kredit: 0,
      mva_kode: null,
    });
  }
  ls.push({
    konto: ut,
    tekst: `Utgående mva ${def.sats} % (beregnet)`,
    debet: 0,
    kredit: avgift,
    mva_kode: kode,
  });
  ls.push({
    konto: motkonto,
    tekst: "Leverandør/betaling",
    debet: 0,
    kredit: r2(netto),
    mva_kode: null,
  });
  return ls;
}
