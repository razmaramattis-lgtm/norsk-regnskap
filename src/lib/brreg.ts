import { gyldigOrgNr } from "./format";

/**
 * Oppslag i Enhetsregisteret (Brønnøysundregistrene), motstykket til Accounteds Bolagsverket-utvidelse.
 * Åpent API uten innlogging: https://data.brreg.no/enhetsregisteret/api/enheter/{orgnr}
 *
 * MERK: Feltnavnene er skrevet etter dokumentert respons, men er ikke kontrollert mot live-API fra denne
 * utviklingsmiljøet. Tolkningen er derfor defensiv: manglende felt gir tomme verdier, aldri krasj.
 */

export type Enhet = {
  orgNr: string;
  navn: string;
  adresse: string;
  postnr: string;
  poststed: string;
  land: string;
  organisasjonsform: string;
  mvaRegistrert: boolean | null;
  slettet: boolean;
  konkurs: boolean;
  underAvvikling: boolean;
};

const tekst = (v: unknown): string => (typeof v === "string" ? v : "");

export function tolkEnhet(json: unknown): Enhet | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const orgNr = tekst(o["organisasjonsnummer"]);
  if (!orgNr) return null;
  const adr = (o["forretningsadresse"] ?? o["postadresse"]) as Record<string, unknown> | undefined;
  const adresselinjer = Array.isArray(adr?.["adresse"])
    ? (adr!["adresse"] as unknown[]).map(tekst).filter(Boolean)
    : [];
  const form = o["organisasjonsform"] as Record<string, unknown> | undefined;
  return {
    orgNr,
    navn: tekst(o["navn"]),
    adresse: adresselinjer.join(", "),
    postnr: tekst(adr?.["postnummer"]),
    poststed: tekst(adr?.["poststed"]),
    land: tekst(adr?.["landkode"]) || "NO",
    organisasjonsform: tekst(form?.["kode"]),
    mvaRegistrert:
      typeof o["registrertIMvaregisteret"] === "boolean"
        ? (o["registrertIMvaregisteret"] as boolean)
        : null,
    slettet: !!o["slettedato"],
    konkurs: o["konkurs"] === true,
    underAvvikling:
      o["underAvvikling"] === true || o["underTvangsavviklingEllerTvangsopplosning"] === true,
  };
}

export class BrregFeil extends Error {}

/** Henter en enhet. Returnerer null når org.nr. ikke finnes. Kaster BrregFeil ved nettverks- eller tjenestefeil. */
export async function hentEnhet(orgNr: string, hent: typeof fetch = fetch): Promise<Enhet | null> {
  const ren = orgNr.replace(/\s/g, "");
  if (!gyldigOrgNr(ren)) throw new BrregFeil("Ugyldig organisasjonsnummer.");
  let svar: Response;
  try {
    svar = await hent(`https://data.brreg.no/enhetsregisteret/api/enheter/${ren}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new BrregFeil("Kunne ikke nå Enhetsregisteret. Fyll ut manuelt.");
  }
  if (svar.status === 404 || svar.status === 410) return null;
  if (!svar.ok) throw new BrregFeil(`Enhetsregisteret svarte med feil (${svar.status}).`);
  return tolkEnhet(await svar.json());
}
