import { dato, formatOrgNr, kr } from "./format";

/** E-post med faktura og purring. Sendes fra brukerens eget e-postprogram til en e-postleverandør er koblet på. */

type Firma = { name: string; org_nr: string | null; kontonummer: string | null; epost?: string | null };
type Kunde = { navn: string; epost: string | null };
type Faktura = { fakturanr: number | null; kid: string | null; total: number | string; forfallsdato: string; er_kreditnota?: boolean };

export type Epost = { til: string; emne: string; tekst: string };

const betaling = (f: Faktura, firma: Firma, frist: string) =>
  [
    `Beløp: ${kr(f.total)} kr`,
    `Forfall: ${dato(frist)}`,
    `Kontonummer: ${firma.kontonummer ?? "–"}`,
    f.kid ? `KID: ${f.kid}` : null,
  ]
    .filter(Boolean)
    .join("\n");

const signatur = (firma: Firma) =>
  `Med vennlig hilsen\n${firma.name}${firma.org_nr ? `\nOrg.nr ${formatOrgNr(firma.org_nr)}` : ""}`;

export function fakturaEpost(f: Faktura, firma: Firma, kunde: Kunde): Epost {
  const type = f.er_kreditnota ? "Kreditnota" : "Faktura";
  return {
    til: kunde.epost ?? "",
    emne: `${type} ${f.fakturanr} fra ${firma.name}`,
    tekst: f.er_kreditnota
      ? `Hei ${kunde.navn},\n\nVedlagt er kreditnota ${f.fakturanr} på ${kr(f.total)} kr.\n\n${signatur(firma)}`
      : `Hei ${kunde.navn},\n\nVedlagt er faktura ${f.fakturanr}.\n\n${betaling(f, firma, f.forfallsdato)}\n\nBruk KID ved betaling, så blir innbetalingen registrert automatisk.\n\n${signatur(firma)}`,
  };
}

/** Ny frist for purring: 14 dager, som er minstefristen før et eventuelt purregebyr etter inkassoloven. */
export function nyFrist(idag: string, dager = 14): string {
  const d = new Date(`${idag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dager);
  return d.toISOString().slice(0, 10);
}

export function purreEpost(f: Faktura, firma: Firma, kunde: Kunde, idag: string): Epost {
  return {
    til: kunde.epost ?? "",
    emne: `Påminnelse: faktura ${f.fakturanr} fra ${firma.name}`,
    tekst: `Hei ${kunde.navn},\n\nVi kan ikke se å ha mottatt betaling for faktura ${f.fakturanr}, som forfalt ${dato(f.forfallsdato)}. Har du allerede betalt, kan du se bort fra denne påminnelsen.\n\n${betaling(f, firma, nyFrist(idag))}\n\n${signatur(firma)}`,
  };
}

export function mailto(e: Epost): string {
  return `mailto:${encodeURIComponent(e.til)}?subject=${encodeURIComponent(e.emne)}&body=${encodeURIComponent(e.tekst)}`;
}
