import { dagerTil, kommendeFrister, type Frist, type FristValg } from "./frister";

/** Én rad fra `byraa_oversikt()`. */
export type OversiktRad = {
  company_id: string;
  ubehandlede_banktransaksjoner: number;
  bilagsutkast: number;
  ventende_forslag: number;
  forfalte_kundefakturaer: number;
  forfalt_kundebelop: number | string;
  forfalte_leverandorfakturaer: number;
  forfalt_leverandorbelop: number | string;
  har_ansatte: boolean;
  siste_bilagsdato: string | null;
  siste_bokforte_bilagsdato: string | null;
};

export type KlientFirma = {
  company_type: string;
  mva_registrert: boolean;
  mva_termin: string;
  laast_til?: string | null;
};

export type Nivaa = "haster" | "folg_opp" | "ok";
export type Punkt = { tekst: string; vekt: number };

export type KlientVurdering = {
  nivaa: Nivaa;
  poeng: number;
  punkter: Punkt[];
  nesteFrist: Frist | null;
  dagerTilFrist: number | null;
  dagerSidenBokfort: number | null;
};

/** Dager uten bokføring før en klient flagges. */
export const DAGER_UTEN_BOKFORING = 45;

const flertall = (n: number, ett: string, flere: string) => `${n} ${n === 1 ? ett : flere}`;

export function fristValgFor(f: KlientFirma, harAnsatte: boolean): FristValg {
  return {
    selskapstype: f.company_type === "as" ? "as" : "enk",
    mvaRegistrert: f.mva_registrert,
    mvaTermin: f.mva_termin,
    harAnsatte,
  };
}

/**
 * Vurderer hvor mye en klient trenger oppmerksomhet nå. Poengene er enkle og forklarbare, slik at et
 * menneske kan se hvorfor en klient står øverst; de er ikke en risikovurdering.
 */
export function vurderKlient(firma: KlientFirma, r: OversiktRad, idag: string): KlientVurdering {
  const punkter: Punkt[] = [];
  const legg = (tekst: string, vekt: number) => punkter.push({ tekst, vekt });

  const neste = kommendeFrister(idag, fristValgFor(firma, r.har_ansatte), 1)[0] ?? null;
  const dager = neste ? dagerTil(idag, neste.dato) : null;
  if (neste && dager !== null) {
    if (dager <= 7)
      legg(
        `${neste.tittel} om ${dager === 0 ? "0 dager (i dag)" : flertall(dager, "dag", "dager")}`,
        3,
      );
    else if (dager <= 14) legg(`${neste.tittel} om ${dager} dager`, 2);
    else if (dager <= 30) legg(`${neste.tittel} om ${dager} dager`, 1);
  }

  if (r.ubehandlede_banktransaksjoner > 0)
    legg(
      `${flertall(r.ubehandlede_banktransaksjoner, "uavstemt banktransaksjon", "uavstemte banktransaksjoner")}`,
      r.ubehandlede_banktransaksjoner > 20 ? 2 : 1,
    );
  if (r.bilagsutkast > 0) legg(flertall(r.bilagsutkast, "bilagsutkast", "bilagsutkast"), 1);
  if (r.ventende_forslag > 0)
    legg(`${flertall(r.ventende_forslag, "forslag", "forslag")} venter på godkjenning`, 1);
  if (r.forfalte_kundefakturaer > 0)
    legg(
      `${flertall(r.forfalte_kundefakturaer, "forfalt kundefaktura", "forfalte kundefakturaer")}`,
      1,
    );
  if (r.forfalte_leverandorfakturaer > 0)
    legg(
      `${flertall(r.forfalte_leverandorfakturaer, "forfalt leverandørfaktura", "forfalte leverandørfakturaer")}`,
      2,
    );

  let sidenBokfort: number | null = null;
  if (r.siste_bokforte_bilagsdato) {
    sidenBokfort = dagerTil(r.siste_bokforte_bilagsdato, idag);
    if (sidenBokfort > DAGER_UTEN_BOKFORING) legg(`Ikke bokført på ${sidenBokfort} dager`, 1);
  }

  const poeng = punkter.reduce((s, p) => s + p.vekt, 0);
  const nivaa: Nivaa = poeng >= 5 ? "haster" : poeng >= 2 ? "folg_opp" : "ok";
  return {
    nivaa,
    poeng,
    punkter,
    nesteFrist: neste,
    dagerTilFrist: dager,
    dagerSidenBokfort: sidenBokfort,
  };
}

/** Mest hastende først; likt poeng sorteres på nærmeste frist og deretter navn. */
export function sorterKlienter<T extends { navn: string; vurdering: KlientVurdering }>(
  rader: T[],
): T[] {
  return [...rader].sort(
    (a, b) =>
      b.vurdering.poeng - a.vurdering.poeng ||
      (a.vurdering.dagerTilFrist ?? 9999) - (b.vurdering.dagerTilFrist ?? 9999) ||
      a.navn.localeCompare(b.navn, "nb"),
  );
}

export type SjekkStatus = "ok" | "advarsel" | "manuell";
export type Sjekkpunkt = {
  id: string;
  tittel: string;
  detalj: string;
  status: SjekkStatus;
  lenke?: string;
};

/**
 * Sjekkliste for månedsavslutning. Automatiske punkter bygger på tallene i `byraa_oversikt()`; de manuelle
 * er ting databasen ikke kan vite og må krysses av av et menneske.
 */
export function maanedsavslutning(
  firma: KlientFirma,
  r: OversiktRad,
  periodeSlutt: string,
): Sjekkpunkt[] {
  const p: Sjekkpunkt[] = [];
  const auto = (
    id: string,
    tittel: string,
    ok: boolean,
    detaljOk: string,
    detaljFeil: string,
    lenke?: string,
  ) =>
    p.push({
      id,
      tittel,
      detalj: ok ? detaljOk : detaljFeil,
      status: ok ? "ok" : "advarsel",
      ...(lenke ? { lenke } : {}),
    });

  auto(
    "bank",
    "Alle banktransaksjoner er avstemt",
    r.ubehandlede_banktransaksjoner === 0,
    "Ingen uavstemte transaksjoner.",
    `${flertall(r.ubehandlede_banktransaksjoner, "transaksjon", "transaksjoner")} mangler avstemming.`,
    "/app/bank",
  );
  auto(
    "utkast",
    "Ingen bilag står som utkast",
    r.bilagsutkast === 0,
    "Alle bilag er bokført.",
    `${flertall(r.bilagsutkast, "utkast", "utkast")} må bokføres eller slettes.`,
    "/app/bilag",
  );
  auto(
    "forslag",
    "Alle forslag fra AI og regler er avgjort",
    r.ventende_forslag === 0,
    "Ingen forslag venter.",
    `${flertall(r.ventende_forslag, "forslag", "forslag")} venter på godkjenning.`,
    "/app/forslag",
  );
  auto(
    "levfakt",
    "Forfalte leverandørfakturaer er håndtert",
    r.forfalte_leverandorfakturaer === 0,
    "Ingen forfalte leverandørfakturaer.",
    `${flertall(r.forfalte_leverandorfakturaer, "faktura", "fakturaer")} er forfalt.`,
    "/app/leverandorfakturaer",
  );
  auto(
    "kundefakt",
    "Forfalte kundefakturaer er fulgt opp",
    r.forfalte_kundefakturaer === 0,
    "Ingen forfalte kundefakturaer.",
    `${flertall(r.forfalte_kundefakturaer, "faktura", "fakturaer")} er forfalt.`,
    "/app/reskontro",
  );

  const manuelle: [string, string, string][] = [
    [
      "kontoutskrift",
      "Banksaldo i Fjordbok stemmer med kontoutskriften",
      "Sammenlign saldo på bankkontoen per siste dag i måneden.",
    ],
    [
      "kontantkasse",
      "Kasse og andre balansekontoer er kontrollert",
      "Gå gjennom saldobalansen for uventede saldoer.",
    ],
  ];
  if (r.har_ansatte)
    manuelle.push([
      "lonn",
      "Lønn er kjørt og bokført for måneden",
      "A-melding leveres innen den 5. i neste måned.",
    ]);
  if (firma.mva_registrert) {
    const [aar, maaned] = periodeSlutt.split("-").map(Number) as [number, number];
    const terminSlutt = firma.mva_termin === "aarlig" ? maaned === 12 : maaned % 2 === 0;
    if (terminSlutt)
      manuelle.push([
        "mva",
        `MVA-meldingen for terminen som slutter ${aar}-${String(maaned).padStart(2, "0")} er kontrollert`,
        "Se MVA-melding og gjør opp mot oppgjørskonto.",
      ]);
  }
  for (const [id, tittel, detalj] of manuelle) p.push({ id, tittel, detalj, status: "manuell" });

  if (firma.laast_til && firma.laast_til >= periodeSlutt) {
    p.push({
      id: "last",
      tittel: "Perioden er låst",
      detalj: `Låst til ${firma.laast_til}.`,
      status: "ok",
    });
  } else {
    p.push({
      id: "last",
      tittel: "Lås perioden når alt er kontrollert",
      detalj: "Låsing hindrer endringer bakover i tid.",
      status: "manuell",
      lenke: "/app/aarsavslutning",
    });
  }
  return p;
}
