/**
 * Norske konteringsmaler (motstykket til Accounteds «konteringspaket»). Hver mal er data: en liste
 * av kontoer og side. Beløpet oppgis når malen brukes. Alle kontoer må finnes i NS 4102-malen
 * (se testen), ellers nekter databasen å bokføre.
 */

export type MalKategori = "egenkapital" | "skatt" | "mva" | "lonn" | "bank" | "annet";

export type MalLinje = { konto: string; tekst: string; side: "debet" | "kredit" };

export type Bokforingsmal = {
  id: string;
  navn: string;
  kategori: MalKategori;
  gjelder: "alle" | "as" | "enk";
  beskrivelse: string;
  linjer: MalLinje[];
};

export const MALER: Bokforingsmal[] = [
  {
    id: "utbytte-vedtak",
    navn: "Vedtatt utbytte",
    kategori: "egenkapital",
    gjelder: "as",
    beskrivelse:
      "Generalforsamlingen har vedtatt utbytte av tidligere års overskudd. Husk at utbytte forutsetter fri egenkapital (aksjeloven § 8-1).",
    linjer: [
      { konto: "2050", tekst: "Utbytte vedtatt", side: "debet" },
      { konto: "2800", tekst: "Avsatt utbytte", side: "kredit" },
    ],
  },
  {
    id: "utbytte-utbetaling",
    navn: "Utbetaling av utbytte",
    kategori: "egenkapital",
    gjelder: "as",
    beskrivelse: "Utbetaling av tidligere vedtatt utbytte til aksjonærene.",
    linjer: [
      { konto: "2800", tekst: "Utbytte utbetalt", side: "debet" },
      { konto: "1920", tekst: "Utbetaling fra bank", side: "kredit" },
    ],
  },
  {
    id: "aksjekapital-innbetaling",
    navn: "Innbetalt aksjekapital",
    kategori: "egenkapital",
    gjelder: "as",
    beskrivelse: "Aksjekapital innbetalt til selskapets bankkonto.",
    linjer: [
      { konto: "1920", tekst: "Innbetaling aksjekapital", side: "debet" },
      { konto: "2000", tekst: "Aksjekapital", side: "kredit" },
    ],
  },
  {
    id: "aksjonaerlaan-inn",
    navn: "Lån fra eier til selskapet",
    kategori: "egenkapital",
    gjelder: "as",
    beskrivelse: "Eier låner penger til selskapet. Dokumenter lånet skriftlig.",
    linjer: [
      { konto: "1920", tekst: "Lån mottatt fra eier", side: "debet" },
      { konto: "2910", tekst: "Gjeld til eier", side: "kredit" },
    ],
  },
  {
    id: "aksjonaerlaan-ned",
    navn: "Tilbakebetaling av lån til eier",
    kategori: "egenkapital",
    gjelder: "as",
    beskrivelse: "Selskapet betaler tilbake lån fra eier.",
    linjer: [
      { konto: "2910", tekst: "Nedbetaling gjeld til eier", side: "debet" },
      { konto: "1920", tekst: "Utbetaling fra bank", side: "kredit" },
    ],
  },
  {
    id: "privatuttak",
    navn: "Privatuttak",
    kategori: "egenkapital",
    gjelder: "enk",
    beskrivelse: "Eieren tar penger ut av enkeltpersonforetaket til privat bruk.",
    linjer: [
      { konto: "2010", tekst: "Privatuttak", side: "debet" },
      { konto: "1920", tekst: "Utbetaling fra bank", side: "kredit" },
    ],
  },
  {
    id: "privat-innskudd",
    navn: "Privat innskudd",
    kategori: "egenkapital",
    gjelder: "enk",
    beskrivelse: "Eieren setter privat kapital inn i foretaket. Føres mot privatuttak-kontoen.",
    linjer: [
      { konto: "1920", tekst: "Innskudd fra eier", side: "debet" },
      { konto: "2010", tekst: "Privat innskudd", side: "kredit" },
    ],
  },
  {
    id: "betaling-mva",
    navn: "Betaling av MVA",
    kategori: "mva",
    gjelder: "alle",
    beskrivelse: "Betaling av skyldig MVA etter at MVA-oppgjøret er bokført (oppgjørskonto 2740).",
    linjer: [
      { konto: "2740", tekst: "Betalt MVA", side: "debet" },
      { konto: "1920", tekst: "Utbetaling fra bank", side: "kredit" },
    ],
  },
  {
    id: "refusjon-mva",
    navn: "Mottatt tilgodebeløp MVA",
    kategori: "mva",
    gjelder: "alle",
    beskrivelse: "Utbetaling fra staten når MVA-oppgjøret ga et tilgodebeløp.",
    linjer: [
      { konto: "1920", tekst: "Innbetaling fra bank", side: "debet" },
      { konto: "2740", tekst: "Mottatt MVA-tilgode", side: "kredit" },
    ],
  },
  {
    id: "betaling-forskuddstrekk",
    navn: "Betaling av forskuddstrekk",
    kategori: "lonn",
    gjelder: "alle",
    beskrivelse: "Betaling av skattetrekk til skattekontoen for ansatte.",
    linjer: [
      { konto: "2600", tekst: "Betalt forskuddstrekk", side: "debet" },
      { konto: "1920", tekst: "Utbetaling fra bank", side: "kredit" },
    ],
  },
  {
    id: "betaling-aga",
    navn: "Betaling av arbeidsgiveravgift",
    kategori: "lonn",
    gjelder: "alle",
    beskrivelse: "Betaling av skyldig arbeidsgiveravgift til skattekontoen.",
    linjer: [
      { konto: "2770", tekst: "Betalt arbeidsgiveravgift", side: "debet" },
      { konto: "1920", tekst: "Utbetaling fra bank", side: "kredit" },
    ],
  },
  {
    id: "betaling-skatt",
    navn: "Betaling av skatt (forskudd/restskatt)",
    kategori: "skatt",
    gjelder: "as",
    beskrivelse: "Betaling av forskuddsskatt eller restskatt for selskapet.",
    linjer: [
      { konto: "2500", tekst: "Betalt skatt", side: "debet" },
      { konto: "1920", tekst: "Utbetaling fra bank", side: "kredit" },
    ],
  },
  {
    id: "bankgebyr",
    navn: "Bankgebyr",
    kategori: "bank",
    gjelder: "alle",
    beskrivelse:
      "Gebyrer fra banken. Finansielle tjenester er unntatt MVA, så ingen mva-behandling.",
    linjer: [
      { konto: "7770", tekst: "Bankgebyr", side: "debet" },
      { konto: "1920", tekst: "Trukket fra bank", side: "kredit" },
    ],
  },
  {
    id: "renteinntekt",
    navn: "Renteinntekt",
    kategori: "bank",
    gjelder: "alle",
    beskrivelse: "Renter på bankinnskudd.",
    linjer: [
      { konto: "1920", tekst: "Renter mottatt", side: "debet" },
      { konto: "8040", tekst: "Renteinntekt", side: "kredit" },
    ],
  },
  {
    id: "rentekostnad",
    navn: "Rentekostnad",
    kategori: "bank",
    gjelder: "alle",
    beskrivelse: "Renter på lån og kreditt.",
    linjer: [
      { konto: "8140", tekst: "Rentekostnad", side: "debet" },
      { konto: "1920", tekst: "Trukket fra bank", side: "kredit" },
    ],
  },
];

export const KATEGORI_NAVN: Record<MalKategori, string> = {
  egenkapital: "Egenkapital og eier",
  skatt: "Skatt",
  mva: "MVA",
  lonn: "Lønn og avgifter",
  bank: "Bank og renter",
  annet: "Annet",
};

export function malerFor(selskapstype: "as" | "enk"): Bokforingsmal[] {
  return MALER.filter((m) => m.gjelder === "alle" || m.gjelder === selskapstype);
}

export type MalPostering = { konto: string; tekst: string; debet: number; kredit: number };

/** Bygger posteringer for et beløp. Alle maler har to linjer, så debet = kredit er garantert. */
export function bruk(mal: Bokforingsmal, belop: number): MalPostering[] {
  const b = Math.round((Math.abs(belop) + Number.EPSILON) * 100) / 100;
  return mal.linjer.map((l) => ({
    konto: l.konto,
    tekst: l.tekst,
    debet: l.side === "debet" ? b : 0,
    kredit: l.side === "kredit" ? b : 0,
  }));
}
