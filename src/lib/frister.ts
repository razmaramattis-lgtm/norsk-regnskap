/**
 * Norske frister for regnskap, MVA, lønn og skatt.
 *
 * Fristen flyttes til neste virkedag når den faller på lørdag, søndag eller
 * en offentlig helligdag (se `nesteVirkedag`).
 *
 * Datoer lagres som ISO-strenger (YYYY-MM-DD) for å unngå tidssoneproblemer.
 */

export type FristKategori = "mva" | "lonn" | "skatt" | "regnskap" | "selskap";

export type Frist = {
  id: string;
  tittel: string;
  beskrivelse: string;
  kategori: FristKategori;
  /** Lovfestet dato før flytting til virkedag. */
  opprinnelig: string;
  /** Faktisk frist etter flytting til virkedag. */
  dato: string;
};

const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

const utc = (aar: number, maaned: number, dag: number) => new Date(Date.UTC(aar, maaned - 1, dag));

/** Påskedag (gregoriansk) via Meeus/Jones/Butcher-algoritmen. */
export function paaskedag(aar: number): Date {
  const a = aar % 19;
  const b = Math.floor(aar / 100);
  const c = aar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maaned = Math.floor((h + l - 7 * m + 114) / 31);
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(aar, maaned, dag);
}

const leggTilDager = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Offentlige fridager i Norge (helligdager) som ISO-datoer. */
export function helligdager(aar: number): Set<string> {
  const p = paaskedag(aar);
  return new Set(
    [
      utc(aar, 1, 1), // 1. nyttårsdag
      leggTilDager(p, -3), // skjærtorsdag
      leggTilDager(p, -2), // langfredag
      p, // 1. påskedag
      leggTilDager(p, 1), // 2. påskedag
      utc(aar, 5, 1), // arbeidernes dag
      utc(aar, 5, 17), // grunnlovsdagen
      leggTilDager(p, 39), // Kristi himmelfartsdag
      leggTilDager(p, 49), // 1. pinsedag
      leggTilDager(p, 50), // 2. pinsedag
      utc(aar, 12, 25), // 1. juledag
      utc(aar, 12, 26), // 2. juledag
    ].map(iso),
  );
}

export function erVirkedag(isoDato: string): boolean {
  const [y, m, d] = isoDato.split("-").map(Number) as [number, number, number];
  const dt = utc(y, m, d);
  const ukedag = dt.getUTCDay(); // 0 = søndag, 6 = lørdag
  if (ukedag === 0 || ukedag === 6) return false;
  return !helligdager(y).has(isoDato);
}

/** Flytter datoen frem til første virkedag (samme dag hvis den allerede er en). */
export function nesteVirkedag(isoDato: string): string {
  const [y, m, d] = isoDato.split("-").map(Number) as [number, number, number];
  let dt = utc(y, m, d);
  while (!erVirkedag(iso(dt))) dt = leggTilDager(dt, 1);
  return iso(dt);
}

function lag(
  id: string,
  tittel: string,
  beskrivelse: string,
  kategori: FristKategori,
  aar: number,
  maaned: number,
  dag: number,
): Frist {
  const opprinnelig = iso(utc(aar, maaned, dag));
  return { id, tittel, beskrivelse, kategori, opprinnelig, dato: nesteVirkedag(opprinnelig) };
}

/**
 * MVA-meldingens frister for én termin (1–6) eller hele året.
 * 1. termin 10. april, 2. 10. juni, 3. 31. august, 4. 10. oktober,
 * 5. 10. desember, 6. 10. februar året etter. Årsterminen: 10. mars året etter.
 */
export function mvaFrist(aar: number, termin: number | "aarlig"): Frist {
  if (termin === "aarlig") {
    return lag(
      `mva-${aar}-aar`,
      `MVA-melding ${aar}`,
      "Årlig termin, frist 10. mars året etter.",
      "mva",
      aar + 1,
      3,
      10,
    );
  }
  const tabell: Record<number, [number, number, number]> = {
    1: [aar, 4, 10],
    2: [aar, 6, 10],
    3: [aar, 8, 31],
    4: [aar, 10, 10],
    5: [aar, 12, 10],
    6: [aar + 1, 2, 10],
  };
  const [y, m, d] = tabell[termin]!;
  return lag(
    `mva-${aar}-t${termin}`,
    `MVA-melding ${termin}. termin ${aar}`,
    "Innsending og betaling av merverdiavgift.",
    "mva",
    y,
    m,
    d,
  );
}

export type FristValg = {
  selskapstype: "as" | "enk";
  mvaRegistrert: boolean;
  mvaTermin: "tomaaned" | "aarlig" | string;
  harAnsatte: boolean;
};

/**
 * Alle frister som treffer et kalenderår (regnskapsåret = kalenderåret), sortert på dato.
 * Inkluderer frister som følger av fjorårets regnskapsår (f.eks. MVA 6. termin i februar).
 */
export function fristerForAar(aar: number, v: FristValg): Frist[] {
  const ut: Frist[] = [];

  if (v.mvaRegistrert) {
    if (v.mvaTermin === "aarlig") {
      ut.push(mvaFrist(aar - 1, "aarlig"));
    } else {
      ut.push(mvaFrist(aar - 1, 6));
      for (let t = 1; t <= 5; t++) ut.push(mvaFrist(aar, t));
    }
  }

  if (v.harAnsatte) {
    for (let m = 1; m <= 12; m++) {
      // A-melding for forrige måned leveres innen den 5. (desember → 5. januar).
      const forrige = m === 1 ? "desember" : MAANEDER[m - 2]!;
      ut.push(
        lag(
          `a-melding-${aar}-${m}`,
          `A-melding for ${forrige}`,
          "Lønns- og arbeidsforholdsopplysninger til Skatteetaten, NAV og SSB.",
          "lonn",
          aar,
          m,
          5,
        ),
      );
    }
    // Betaling av forskuddstrekk og arbeidsgiveravgift: 15. i måneden etter terminslutt.
    const betaling: [number, number, string][] = [
      [1, 15, "6. termin i fjor (nov–des)"],
      [3, 15, "1. termin (jan–feb)"],
      [5, 15, "2. termin (mar–apr)"],
      [7, 15, "3. termin (mai–jun)"],
      [9, 15, "4. termin (jul–aug)"],
      [11, 15, "5. termin (sep–okt)"],
    ];
    for (const [m, d, navn] of betaling) {
      ut.push(
        lag(
          `trekk-aga-${aar}-${m}`,
          `Forskuddstrekk og arbeidsgiveravgift – ${navn}`,
          "Betaling til skattekontoen.",
          "lonn",
          aar,
          m,
          d,
        ),
      );
    }
  }

  if (v.selskapstype === "as") {
    ut.push(
      lag(
        `aksjonaer-${aar}`,
        "Aksjonærregisteroppgave",
        "Innleveres for fjorårets aksjonærer og utbytte.",
        "selskap",
        aar,
        1,
        31,
      ),
    );
    ut.push(
      lag(
        `generalforsamling-${aar}`,
        "Generalforsamling (siste frist)",
        "Årsregnskapet skal godkjennes innen seks måneder etter regnskapsårets slutt.",
        "selskap",
        aar,
        6,
        30,
      ),
    );
    ut.push(
      lag(
        `aarsregnskap-${aar}`,
        "Årsregnskap til Regnskapsregisteret",
        "Innen 31. juli for kalenderår, sammen med årsberetning og revisjonsberetning der det kreves.",
        "regnskap",
        aar,
        7,
        31,
      ),
    );
  }

  ut.push(
    lag(
      `skattemelding-${aar}`,
      v.selskapstype === "as"
        ? "Skattemelding for aksjeselskap"
        : "Skattemelding med næringsspesifikasjon",
      "Frist 31. mai for næringsdrivende.",
      "skatt",
      aar,
      5,
      31,
    ),
  );

  return ut.sort((a, b) => a.dato.localeCompare(b.dato) || a.id.localeCompare(b.id));
}

const MAANEDER = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

/** Neste frister fra og med en gitt dato, på tvers av årsskifte. */
export function kommendeFrister(fra: string, v: FristValg, antall = 6): Frist[] {
  const aar = Number(fra.slice(0, 4));
  const alle = [...fristerForAar(aar, v), ...fristerForAar(aar + 1, v)];
  const sett = new Set<string>();
  return alle
    .filter((f) => f.dato >= fra && !sett.has(f.id) && sett.add(f.id))
    .sort((a, b) => a.dato.localeCompare(b.dato))
    .slice(0, antall);
}

/** Antall kalenderdager fra `fra` til `til` (negativt = forfalt). */
export function dagerTil(fra: string, til: string): number {
  const a = Date.UTC(
    Number(fra.slice(0, 4)),
    Number(fra.slice(5, 7)) - 1,
    Number(fra.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(til.slice(0, 4)),
    Number(til.slice(5, 7)) - 1,
    Number(til.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}
