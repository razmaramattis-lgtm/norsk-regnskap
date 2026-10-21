/**
 * Oppstilling av årsregnskap (resultat og balanse) fra saldobalansen, etter
 * NS 4102-kontogrupper og regnskapslovens oppstillingsplan i forenklet form.
 *
 * Saldo = debet − kredit per konto. Resultatkonti (3000–8399) leveres for året,
 * balansekonti (1000–2999) leveres akkumulert per balansedato.
 */

export type Saldo = Record<string, number>;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type Linje = {
  id: string;
  navn: string;
  belop: number;
  kontoer: { konto: string; belop: number }[];
};

type Gruppe = { id: string; navn: string; fra: number; til: number; fortegn: 1 | -1 };

const sum = (s: Saldo, fra: number, til: number) =>
  Object.entries(s)
    .filter(([k]) => Number(k) >= fra && Number(k) <= til)
    .reduce((a, [, v]) => a + v, 0);

function byggLinje(s: Saldo, g: Gruppe): Linje {
  const kontoer = Object.entries(s)
    .filter(([k, v]) => Number(k) >= g.fra && Number(k) <= g.til && Math.abs(v) > 0.004)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([konto, v]) => ({ konto, belop: r2(v * g.fortegn) }));
  return { id: g.id, navn: g.navn, belop: r2(kontoer.reduce((a, k) => a + k.belop, 0)), kontoer };
}

const RES: Gruppe[] = [
  { id: "salgsinntekt", navn: "Salgsinntekt", fra: 3000, til: 3299, fortegn: -1 },
  { id: "annen-driftsinntekt", navn: "Annen driftsinntekt", fra: 3300, til: 3999, fortegn: -1 },
  { id: "varekostnad", navn: "Varekostnad", fra: 4000, til: 4999, fortegn: 1 },
  { id: "lonnskostnad", navn: "Lønnskostnad", fra: 5000, til: 5999, fortegn: 1 },
  {
    id: "avskrivning",
    navn: "Avskrivning på driftsmidler og immaterielle eiendeler",
    fra: 6000,
    til: 6099,
    fortegn: 1,
  },
  { id: "annen-driftskostnad", navn: "Annen driftskostnad", fra: 6100, til: 7999, fortegn: 1 },
  { id: "finansinntekt", navn: "Finansinntekter", fra: 8000, til: 8099, fortegn: -1 },
  { id: "finanskostnad", navn: "Finanskostnader", fra: 8100, til: 8299, fortegn: 1 },
  { id: "skattekostnad", navn: "Skattekostnad", fra: 8300, til: 8399, fortegn: 1 },
];

export type Resultatregnskap = {
  linjer: Linje[];
  driftsinntekter: number;
  driftskostnader: number;
  driftsresultat: number;
  finansresultat: number;
  resultatForSkatt: number;
  skattekostnad: number;
  aarsresultat: number;
};

export function byggResultat(aar: Saldo): Resultatregnskap {
  const linjer = RES.map((g) => byggLinje(aar, g));
  const v = (id: string) => linjer.find((l) => l.id === id)!.belop;
  const driftsinntekter = r2(v("salgsinntekt") + v("annen-driftsinntekt"));
  const driftskostnader = r2(
    v("varekostnad") + v("lonnskostnad") + v("avskrivning") + v("annen-driftskostnad"),
  );
  const driftsresultat = r2(driftsinntekter - driftskostnader);
  const finansresultat = r2(v("finansinntekt") - v("finanskostnad"));
  const resultatForSkatt = r2(driftsresultat + finansresultat);
  const skattekostnad = v("skattekostnad");
  return {
    linjer,
    driftsinntekter,
    driftskostnader,
    driftsresultat,
    finansresultat,
    resultatForSkatt,
    skattekostnad,
    aarsresultat: r2(resultatForSkatt - skattekostnad),
  };
}

const EIENDEL: Gruppe[] = [
  { id: "immaterielle", navn: "Immaterielle eiendeler", fra: 1000, til: 1099, fortegn: 1 },
  { id: "varige", navn: "Varige driftsmidler", fra: 1100, til: 1299, fortegn: 1 },
  { id: "finansielle-anlegg", navn: "Finansielle anleggsmidler", fra: 1300, til: 1399, fortegn: 1 },
  { id: "varer", navn: "Varer", fra: 1400, til: 1499, fortegn: 1 },
  { id: "fordringer", navn: "Fordringer", fra: 1500, til: 1899, fortegn: 1 },
  { id: "bank", navn: "Bankinnskudd, kontanter og lignende", fra: 1900, til: 1999, fortegn: 1 },
];

const GJELD: Gruppe[] = [
  { id: "innskutt-ek", navn: "Innskutt egenkapital", fra: 2000, til: 2049, fortegn: -1 },
  { id: "opptjent-ek", navn: "Opptjent egenkapital", fra: 2050, til: 2099, fortegn: -1 },
  { id: "langsiktig", navn: "Langsiktig gjeld", fra: 2100, til: 2299, fortegn: -1 },
  { id: "leverandorgjeld", navn: "Leverandørgjeld", fra: 2300, til: 2499, fortegn: -1 },
  { id: "skyldig-skatt", navn: "Betalbar skatt", fra: 2500, til: 2599, fortegn: -1 },
  {
    id: "offentlige",
    navn: "Skyldige offentlige avgifter og trekk",
    fra: 2600,
    til: 2799,
    fortegn: -1,
  },
  { id: "utbytte", navn: "Avsatt utbytte", fra: 2800, til: 2899, fortegn: -1 },
  { id: "annen-kortsiktig", navn: "Annen kortsiktig gjeld", fra: 2900, til: 2999, fortegn: -1 },
];

export type Balanse = {
  eiendeler: Linje[];
  egenkapitalOgGjeld: Linje[];
  sumEiendeler: number;
  sumAnleggsmidler: number;
  sumOmlopsmidler: number;
  sumEgenkapital: number;
  sumGjeld: number;
  sumEgenkapitalOgGjeld: number;
  /** Resultat som ikke er overført til egenkapital ved årsavslutning. */
  udisponertResultat: number;
  avvik: number;
  gaarIOpp: boolean;
};

/**
 * @param kumulativ  Saldo for balansekonti (1000–2999) per balansedato.
 * @param udisponert Akkumulert resultat (konto 3000 og høyere, inkludert 8800-føringer) som ikke er overført til egenkapital.
 */
export function byggBalanse(kumulativ: Saldo, udisponertResultat = 0): Balanse {
  const eiendeler = EIENDEL.map((g) => byggLinje(kumulativ, g));
  const egenkapitalOgGjeld = GJELD.map((g) => byggLinje(kumulativ, g));
  const udisp = r2(udisponertResultat);
  const v = (ls: Linje[], id: string) => ls.find((l) => l.id === id)!.belop;
  const sumEiendeler = r2(eiendeler.reduce((a, l) => a + l.belop, 0));
  const sumEgenkapital = r2(
    v(egenkapitalOgGjeld, "innskutt-ek") + v(egenkapitalOgGjeld, "opptjent-ek") + udisp,
  );
  const sumGjeld = r2(
    egenkapitalOgGjeld
      .filter((l) => !["innskutt-ek", "opptjent-ek"].includes(l.id))
      .reduce((a, l) => a + l.belop, 0),
  );
  const sumEgenkapitalOgGjeld = r2(sumEgenkapital + sumGjeld);
  const avvik = r2(sumEiendeler - sumEgenkapitalOgGjeld);
  return {
    eiendeler,
    egenkapitalOgGjeld,
    sumEiendeler,
    sumAnleggsmidler: r2(eiendeler.slice(0, 3).reduce((a, l) => a + l.belop, 0)),
    sumOmlopsmidler: r2(eiendeler.slice(3).reduce((a, l) => a + l.belop, 0)),
    sumEgenkapital,
    sumGjeld,
    sumEgenkapitalOgGjeld,
    udisponertResultat: udisp,
    avvik,
    gaarIOpp: Math.abs(avvik) < 0.01,
  };
}

/** Saldo for alle konti fra rader med (konto, debet, kredit). */
export function saldoFraLinjer(linjer: { konto: string; debet: number; kredit: number }[]): Saldo {
  const s: Saldo = {};
  for (const l of linjer) s[l.konto] = r2((s[l.konto] ?? 0) + l.debet - l.kredit);
  return s;
}

export const sumKonti = sum;

/**
 * Størrelsesgrenser for «små foretak» (regnskapsloven § 1-6): to av tre vilkår må være oppfylt.
 * Grensene bør verifiseres mot gjeldende lovtekst hvert år før de legges til grunn.
 */
export const SMAA_FORETAK = {
  salgsinntekt: 70_000_000,
  balansesum: 35_000_000,
  arsverk: 50,
} as const;

export function erSmaaForetak(i: { salgsinntekt: number; balansesum: number; arsverk: number }) {
  const oppfylt = [
    i.salgsinntekt <= SMAA_FORETAK.salgsinntekt,
    i.balansesum <= SMAA_FORETAK.balansesum,
    i.arsverk <= SMAA_FORETAK.arsverk,
  ].filter(Boolean).length;
  return oppfylt >= 2;
}

export type Sjekk = {
  id: string;
  tekst: string;
  status: "ok" | "advarsel" | "feil" | "manuell";
  detalj?: string;
};

export type SjekkInput = {
  selskapstype: "as" | "enk";
  balanse: Balanse;
  aarAvsluttet: boolean;
  antallUtkastBilag: number;
  periodeLaastTilAarsslutt: boolean;
  mvaAvstemt: boolean | null;
  bankAvstemt: boolean | null;
};

/** Sjekkliste før årsregnskapet godkjennes. Punkter systemet ikke kan avgjøre står som «manuell». */
export function sjekklisteAarsregnskap(i: SjekkInput): Sjekk[] {
  const s: Sjekk[] = [];
  s.push(
    i.balanse.gaarIOpp
      ? { id: "balanse", tekst: "Balansen går i null", status: "ok" }
      : {
          id: "balanse",
          tekst: "Balansen går ikke i null",
          status: "feil",
          detalj: `Avvik ${i.balanse.avvik.toFixed(2)} kr mellom eiendeler og egenkapital/gjeld.`,
        },
  );
  s.push(
    i.antallUtkastBilag === 0
      ? { id: "utkast", tekst: "Ingen bilag står som utkast", status: "ok" }
      : {
          id: "utkast",
          tekst: "Det finnes bilag i utkast",
          status: "advarsel",
          detalj: `${i.antallUtkastBilag} utkast må bokføres eller slettes.`,
        },
  );
  s.push(
    i.aarAvsluttet
      ? {
          id: "avsluttet",
          tekst: "Årsavslutning er bokført (resultat overført til egenkapital)",
          status: "ok",
        }
      : {
          id: "avsluttet",
          tekst: "Årsavslutning er ikke bokført",
          status: "advarsel",
          detalj: "Gjør årsavslutning under «Perioder og årsoppgjør» når alle bilag er på plass.",
        },
  );
  s.push(
    i.periodeLaastTilAarsslutt
      ? { id: "las", tekst: "Perioden er låst til årsskiftet", status: "ok" }
      : { id: "las", tekst: "Perioden er ikke låst", status: "advarsel" },
  );
  s.push(
    i.mvaAvstemt === null
      ? { id: "mva", tekst: "MVA er avstemt mot oppgjørskonto (2740)", status: "manuell" }
      : i.mvaAvstemt
        ? { id: "mva", tekst: "MVA er avstemt", status: "ok" }
        : { id: "mva", tekst: "MVA er ikke avstemt", status: "advarsel" },
  );
  s.push(
    i.bankAvstemt === null
      ? { id: "bank", tekst: "Bank er avstemt per 31.12.", status: "manuell" }
      : i.bankAvstemt
        ? { id: "bank", tekst: "Bank er avstemt", status: "ok" }
        : { id: "bank", tekst: "Bank er ikke avstemt", status: "advarsel" },
  );
  s.push({
    id: "varelager",
    tekst: "Varelager er telt og bokført per 31.12. (om relevant)",
    status: "manuell",
  });
  s.push({ id: "anleggsmidler", tekst: "Avskrivninger er beregnet og bokført", status: "manuell" });
  if (i.selskapstype === "as") {
    s.push({
      id: "noter",
      tekst: "Noter er utarbeidet (regnskapsprinsipper, ansatte, egenkapital, skatt m.m.)",
      status: "manuell",
    });
    s.push({
      id: "beretning",
      tekst: "Årsberetning er skrevet og styret har signert",
      status: "manuell",
    });
    s.push({
      id: "revisjon",
      tekst: "Revisjonsplikt er avklart, og revisjonsberetning foreligger om kravet gjelder",
      status: "manuell",
    });
    s.push({
      id: "generalforsamling",
      tekst: "Generalforsamling har godkjent årsregnskapet",
      status: "manuell",
    });
  }
  return s;
}
