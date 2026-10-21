/** Arbeidsgiveravgift-satser per sone (2026). */
export const AGA_SONER: Record<string, { navn: string; sats: number }> = {
  "1": { navn: "Sone 1", sats: 14.1 },
  "1a": { navn: "Sone 1a", sats: 10.6 },
  "2": { navn: "Sone 2", sats: 10.6 },
  "3": { navn: "Sone 3", sats: 6.4 },
  "4": { navn: "Sone 4", sats: 5.1 },
  "4a": { navn: "Sone 4a", sats: 7.9 },
  "5": { navn: "Sone 5 (Finnmark og Nord-Troms)", sats: 0 },
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export type LonnInput = {
  brutto: number;
  tillegg: number;
  skattetrekkProsent: number;
  feriepengesats: number;
  otpProsent: number;
  agaSats: number;
};

/**
 * Beregner én lønnslinje.
 * Feriepenger avsettes av feriepengegrunnlaget (brutto + tillegg).
 * Arbeidsgiveravgift beregnes av utbetalt lønn + avsatte feriepenger + OTP-premie.
 */
export function beregnLonn(i: LonnInput) {
  const grunnlag = r2(i.brutto + i.tillegg);
  const skattetrekk = Math.floor((grunnlag * i.skattetrekkProsent) / 100);
  const feriepenger = r2((grunnlag * i.feriepengesats) / 100);
  const otp = r2((grunnlag * i.otpProsent) / 100);
  const aga = r2(((grunnlag + feriepenger + otp) * i.agaSats) / 100);
  return { grunnlag, skattetrekk, feriepenger, otp, aga, netto: r2(grunnlag - skattetrekk) };
}

/**
 * Grunnbeløpet i folketrygden (G). Endres 1. mai hvert år.
 * MÅ KONTROLLERES: 130 160 kr gjelder fra 1.5.2025; oppdater når nytt G er vedtatt.
 */
export const G = 130160;

export type Kategori = "kontant" | "natural" | "godtgjorelse" | "trekk";

export type Lonnsart = {
  id: string;
  navn: string;
  kategori: Kategori;
  /** Beskrivelse i a-meldingen (kodeliste for lønnsbeskrivelse). Kontroller mot gjeldende kodeliste. */
  amelding: string;
  /** Inngår i grunnlaget for feriepenger. */
  feriepengegrunnlag: boolean;
  /** Beløpet beregnes som antall × timelønn × faktor når faktor er satt (timer og overtid). */
  faktor?: number;
  /** Konto for kostnaden (godtgjørelser) eller gjelden (trekk). */
  konto?: string;
};

export const LONNSARTER: Lonnsart[] = [
  {
    id: "fastlonn",
    navn: "Fastlønn",
    kategori: "kontant",
    amelding: "fastloenn",
    feriepengegrunnlag: true,
  },
  {
    id: "timelonn",
    navn: "Timelønn",
    kategori: "kontant",
    amelding: "timeloenn",
    feriepengegrunnlag: true,
    faktor: 1,
  },
  {
    id: "overtid50",
    navn: "Overtid 50 %",
    kategori: "kontant",
    amelding: "overtidsgodtgjoerelse",
    feriepengegrunnlag: true,
    faktor: 1.5,
  },
  {
    id: "overtid100",
    navn: "Overtid 100 %",
    kategori: "kontant",
    amelding: "overtidsgodtgjoerelse",
    feriepengegrunnlag: true,
    faktor: 2,
  },
  {
    id: "tillegg",
    navn: "Fast tillegg",
    kategori: "kontant",
    amelding: "fastTillegg",
    feriepengegrunnlag: true,
  },
  { id: "bonus", navn: "Bonus", kategori: "kontant", amelding: "bonus", feriepengegrunnlag: true },
  {
    id: "provisjon",
    navn: "Provisjon",
    kategori: "kontant",
    amelding: "provisjon",
    feriepengegrunnlag: true,
  },
  {
    id: "feriepenger",
    navn: "Utbetalte feriepenger",
    kategori: "kontant",
    amelding: "feriepenger",
    feriepengegrunnlag: false,
  },
  {
    id: "styrehonorar",
    navn: "Styrehonorar",
    kategori: "kontant",
    amelding: "styrehonorarOgGodtgjoerelseVerv",
    feriepengegrunnlag: false,
  },
  {
    id: "telefon",
    navn: "Fri elektronisk kommunikasjon",
    kategori: "natural",
    amelding: "elektroniskKommunikasjon",
    feriepengegrunnlag: false,
  },
  { id: "bil", navn: "Fri bil", kategori: "natural", amelding: "bil", feriepengegrunnlag: false },
  {
    id: "forsikring",
    navn: "Skattepliktig forsikring",
    kategori: "natural",
    amelding: "skattepliktigDelForsikringer",
    feriepengegrunnlag: false,
  },
  {
    id: "km",
    navn: "Kilometergodtgjørelse (trekkfri)",
    kategori: "godtgjorelse",
    amelding: "kilometergodtgjoerelseBil",
    feriepengegrunnlag: false,
    konto: "7100",
  },
  {
    id: "diett",
    navn: "Diett uten overnatting (trekkfri)",
    kategori: "godtgjorelse",
    amelding: "trekkfriKostgodtgjoerelse",
    feriepengegrunnlag: false,
    konto: "7130",
  },
  {
    id: "fagforening",
    navn: "Trekk fagforeningskontingent",
    kategori: "trekk",
    amelding: "fagforeningskontingent",
    feriepengegrunnlag: false,
    konto: "2990",
  },
  {
    id: "forskudd",
    navn: "Trekk forskudd på lønn",
    kategori: "trekk",
    amelding: "",
    feriepengegrunnlag: false,
    konto: "1570",
  },
  {
    id: "kantine",
    navn: "Trekk kantine/annet",
    kategori: "trekk",
    amelding: "",
    feriepengegrunnlag: false,
    konto: "2990",
  },
];

export const lonnsart = (id: string) => LONNSARTER.find((l) => l.id === id);

export type Post = { lonnsart: string; antall: number; sats: number; belop: number };

/** Beløpet for en post: antall × timelønn × faktor for timebaserte arter, ellers oppgitt beløp. */
export function postBelop(
  p: { lonnsart: string; antall: number; belop: number },
  timelonn: number,
): number {
  const a = lonnsart(p.lonnsart);
  if (a?.faktor && p.antall) return r2(p.antall * timelonn * a.faktor);
  return r2(p.belop);
}

export type AnsattInput = {
  poster: Post[];
  /** "prosent" bruker trekkprosent; "tabell" bruker oppgitt trekkbeløp fra trekktabellen. */
  trekkmetode: "prosent" | "tabell";
  skattetrekkProsent: number;
  tabelltrekk: number;
  /** Halvt trekk (november/desember) gjelder bare tabelltrekk. */
  halvtTrekk: boolean;
  feriepengesats: number;
  /** Fyller 60 år før 1. september i ferieåret: 2,3 prosentpoeng ekstra (grunnlag inntil 6 G per år). */
  over60: boolean;
  otpProsent: number;
  agaSats: number;
};

/**
 * Lønn for én ansatt i én kjøring.
 * - Forskuddstrekk av kontantlønn + naturalytelser (trekkfrie godtgjørelser holdes utenfor).
 * - Feriepenger av kontantlønn som inngår i feriepengegrunnlaget.
 * - OTP av lønn mellom 1 G og 12 G, regnet per måned (G/12).
 * - AGA av kontantlønn + naturalytelser + feriepenger + OTP.
 */
export function beregnAnsatt(i: AnsattInput) {
  let kontant = 0,
    natural = 0,
    godtgjorelse = 0,
    trekk = 0,
    feriegrunnlag = 0;
  for (const p of i.poster) {
    const a = lonnsart(p.lonnsart);
    if (!a) continue;
    if (a.kategori === "kontant") kontant += p.belop;
    else if (a.kategori === "natural") natural += p.belop;
    else if (a.kategori === "godtgjorelse") godtgjorelse += p.belop;
    else trekk += p.belop;
    if (a.feriepengegrunnlag) feriegrunnlag += p.belop;
  }
  [kontant, natural, godtgjorelse, trekk, feriegrunnlag] = [
    kontant,
    natural,
    godtgjorelse,
    trekk,
    feriegrunnlag,
  ].map(r2) as [number, number, number, number, number];
  const trekkgrunnlag = kontant + natural;
  const skattetrekk =
    i.trekkmetode === "tabell"
      ? Math.floor(i.halvtTrekk ? i.tabelltrekk / 2 : i.tabelltrekk)
      : Math.floor((trekkgrunnlag * i.skattetrekkProsent) / 100);
  const ekstra60 = i.over60 ? r2((Math.min(feriegrunnlag, (6 * G) / 12) * 2.3) / 100) : 0;
  const feriepenger = r2((feriegrunnlag * i.feriepengesats) / 100 + ekstra60);
  const otpGrunnlag = Math.max(0, Math.min(feriegrunnlag, G) - G / 12);
  const otp = r2((otpGrunnlag * i.otpProsent) / 100);
  const agaGrunnlag = r2(kontant + natural + feriepenger + otp);
  const aga = r2((agaGrunnlag * i.agaSats) / 100);
  const netto = r2(kontant - skattetrekk - trekk + godtgjorelse);
  return {
    kontant,
    natural,
    godtgjorelse,
    trekk,
    trekkgrunnlag,
    skattetrekk,
    feriegrunnlag,
    feriepenger,
    otp,
    agaGrunnlag,
    aga,
    netto,
  };
}

/** Fyller den ansatte 60 år før 1. september i ferieåret (året etter opptjeningsåret)? */
export function over60IFerieaaret(fodselsdato: string | null, opptjeningsaar: number): boolean {
  if (!fodselsdato) return false;
  const fyller60 = `${Number(fodselsdato.slice(0, 4)) + 60}${fodselsdato.slice(4, 10)}`;
  return fyller60 < `${opptjeningsaar + 1}-09-01`;
}

export type AmeldingSum = { beskrivelse: string; navn: string; belop: number };

/** Summer per lønnsbeskrivelse for a-meldingen (trekk uten egen beskrivelse holdes utenfor). */
export function ameldingSummer(poster: Post[]): AmeldingSum[] {
  const m = new Map<string, AmeldingSum>();
  for (const p of poster) {
    const a = lonnsart(p.lonnsart);
    if (!a?.amelding) continue;
    const s = m.get(a.amelding) ?? { beskrivelse: a.amelding, navn: a.navn, belop: 0 };
    s.belop = r2(s.belop + p.belop);
    m.set(a.amelding, s);
  }
  return [...m.values()];
}
