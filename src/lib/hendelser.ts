import { INNGAENDE_KONTO, splittBrutto } from "./mva";

/**
 * «Hva har skjedd?»: registrering i hverdagsspråk. Brukeren velger hendelse og beløp, og vi lager posteringene.
 * Alle kontoer finnes i NS 4102-malen (testen sjekker det).
 */

export type HendelseType = "kjop" | "salg" | "overforing" | "eier_inn" | "eier_ut";

export const HENDELSER: { id: HendelseType; navn: string; tekst: string }[] = [
  { id: "kjop", navn: "Jeg har kjøpt noe", tekst: "Kvittering, abonnement, reise, utstyr" },
  { id: "salg", navn: "Jeg har solgt noe", tekst: "Kontant, kort eller Vipps, uten faktura" },
  { id: "overforing", navn: "Flyttet penger", tekst: "Mellom egne bankkontoer" },
  { id: "eier_inn", navn: "Eier har satt inn penger", tekst: "Fra privat konto til firmaet" },
  { id: "eier_ut", navn: "Eier har tatt ut penger", tekst: "Fra firmaet til privat" },
];

export type Kjopstype = { id: string; navn: string; konto: string; sats: number };

/** Vanlige kjøp med standard MVA-sats. 0 betyr ingen fradragsberettiget inngående MVA. */
export const KJOPSTYPER: Kjopstype[] = [
  { id: "kontor", navn: "Kontorrekvisita", konto: "6800", sats: 25 },
  { id: "programvare", navn: "Programvare og abonnement", konto: "6552", sats: 25 },
  { id: "data", navn: "PC, mobil og datautstyr", konto: "6551", sats: 25 },
  { id: "telefon", navn: "Telefon og internett", konto: "6900", sats: 25 },
  { id: "inventar", navn: "Møbler og inventar", konto: "6540", sats: 25 },
  { id: "varer", navn: "Varer for videresalg", konto: "4300", sats: 25 },
  { id: "underleverandor", navn: "Underleverandør", konto: "4500", sats: 25 },
  { id: "radgivning", navn: "Regnskap, revisjon og rådgivning", konto: "6700", sats: 25 },
  { id: "kurs", navn: "Møte og kurs", konto: "6860", sats: 25 },
  { id: "reklame", navn: "Reklame og markedsføring", konto: "7320", sats: 25 },
  { id: "drivstoff", navn: "Drivstoff", konto: "7000", sats: 25 },
  { id: "reise", navn: "Reise (fly, tog, taxi)", konto: "7140", sats: 12 },
  { id: "husleie", navn: "Husleie", konto: "6300", sats: 0 },
  { id: "strom", navn: "Strøm og varme", konto: "6340", sats: 25 },
  { id: "forsikring", navn: "Forsikring", konto: "7500", sats: 0 },
  { id: "representasjon", navn: "Kundemiddag og representasjon", konto: "7350", sats: 0 },
  { id: "gebyr", navn: "Bankgebyr", konto: "7770", sats: 0 },
  { id: "annet", navn: "Annet", konto: "7790", sats: 25 },
];

export const BETALT_FRA = [
  { konto: "1920", navn: "Firmaets bankkonto" },
  { konto: "2910", navn: "Privat (utlegg som firmaet skylder)" },
] as const;

const SALG: Record<number, { konto: string; mvaKonto: string; kode: string }> = {
  25: { konto: "3000", mvaKonto: "2700", kode: "3" },
  15: { konto: "3010", mvaKonto: "2701", kode: "31" },
  12: { konto: "3020", mvaKonto: "2702", kode: "33" },
};

export type HLinje = {
  konto: string;
  tekst: string;
  debet: number;
  kredit: number;
  mva_kode: string;
};

export type HendelseInput = {
  type: HendelseType;
  belop: number;
  tekst: string;
  firmatype: "as" | "enk";
  mvaRegistrert: boolean;
  kjopstype?: string;
  sats?: number;
  betaltFra?: string;
  tilKonto?: string;
  /** Overstyrer kostnads-/inntektskontoen, f.eks. fra et KI-forslag. */
  konto?: string;
};

const l = (konto: string, tekst: string, debet: number, kredit: number, mva_kode = ""): HLinje => ({
  konto,
  tekst,
  debet,
  kredit,
  mva_kode,
});

export function byggHendelse(i: HendelseInput): HLinje[] {
  const b = Math.round(Math.abs(i.belop) * 100) / 100;
  if (!b) return [];
  const t = i.tekst;
  switch (i.type) {
    case "kjop": {
      const k = KJOPSTYPER.find((x) => x.id === i.kjopstype) ?? KJOPSTYPER.at(-1)!;
      const sats = i.mvaRegistrert ? (i.sats ?? k.sats) : 0;
      const ink = INNGAENDE_KONTO[sats];
      const fra = i.betaltFra ?? "1920";
      const kk = i.konto ?? k.konto;
      if (!ink) return [l(kk, t, b, 0), l(fra, t, 0, b)];
      const { netto, mva } = splittBrutto(b, sats);
      return [
        l(kk, t, netto, 0, ink.kode),
        l(ink.konto, `Inngående mva ${sats} %`, mva, 0, ink.kode),
        l(fra, t, 0, b),
      ];
    }
    case "salg": {
      const s = i.mvaRegistrert ? SALG[i.sats ?? 25] : undefined;
      if (!s)
        return [
          l("1920", t, b, 0),
          l(i.mvaRegistrert ? "3100" : "3000", t, 0, b, i.mvaRegistrert ? "5" : ""),
        ];
      const { netto, mva } = splittBrutto(b, i.sats ?? 25);
      return [
        l("1920", t, b, 0),
        l(i.konto ?? s.konto, t, 0, netto, s.kode),
        l(s.mvaKonto, `Utgående mva ${i.sats ?? 25} %`, 0, mva, s.kode),
      ];
    }
    case "overforing":
      return [l(i.tilKonto ?? "1950", t, b, 0), l(i.betaltFra ?? "1920", t, 0, b)];
    case "eier_inn":
      // ENK: innskudd øker egenkapitalen. AS: penger fra eier er lån til selskapet med mindre det er kapitalforhøyelse.
      return [l("1920", t, b, 0), l(i.firmatype === "enk" ? "2050" : "2910", t, 0, b)];
    case "eier_ut":
      // ENK: privatuttak. AS: kan bare være tilbakebetaling av lån fra eier (utbytte og lønn har egne maler).
      return [l(i.firmatype === "enk" ? "2010" : "2910", t, b, 0), l("1920", t, 0, b)];
  }
}
