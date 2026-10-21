/**
 * Les SAF-T Financial (Norge, 1.10–1.30) fra et annet system (Fiken, Tripletex, PowerOffice m.fl.) for å flytte et firma
 * over: kontoplan, kunder, leverandører og åpningsbalanse. Bilagshistorikken blir liggende i det gamle systemet, som
 * bokføringsloven krever at dere oppbevarer.
 */

export type SaftKonto = { nummer: string; navn: string; saldo: number };
export type SaftPart = {
  eksternId: string;
  navn: string;
  orgNr: string | null;
  adresse: string | null;
  postnr: string | null;
  poststed: string | null;
  land: string;
  epost: string | null;
};
export type SaftImport = {
  firma: { navn: string; orgNr: string | null };
  periodeSlutt: string | null;
  kontoer: SaftKonto[];
  kunder: SaftPart[];
  leverandorer: SaftPart[];
};

/** Elementer med gitt lokalt navn, uavhengig av navnerom (filene bruker ulike urn-er per versjon). */
const alle = (el: Element | Document, navn: string) =>
  Array.from(el.getElementsByTagNameNS("*", navn));
const barn = (el: Element, navn: string) =>
  Array.from(el.children).find((c) => c.localName === navn) ?? null;
const tekst = (el: Element | null, ...sti: string[]) => {
  let e: Element | null = el;
  for (const s of sti) e = e && barn(e, s);
  const t = e?.textContent?.trim();
  return t ? t : null;
};
const tall = (el: Element, navn: string) => Number(tekst(el, navn) ?? 0) || 0;

/** Org.nr uten «MVA», mellomrom og landkode; null hvis det ikke er norsk format. */
export function rensOrgNr(s: string | null): string | null {
  const t = (s ?? "").replace(/^NO/i, "").replace(/MVA$/i, "").replace(/\s/g, "");
  return /^\d{9}$/.test(t) ? t : null;
}

function part(el: Element, idTag: string): SaftPart | null {
  const navn = tekst(el, "Name");
  if (!navn) return null;
  const adr = barn(el, "Address");
  const gate = adr && [tekst(adr, "StreetName"), tekst(adr, "Number")].filter(Boolean).join(" ");
  const by = adr && tekst(adr, "City");
  return {
    eksternId: tekst(el, idTag) ?? navn,
    navn,
    orgNr: rensOrgNr(tekst(el, "RegistrationNumber")),
    adresse: gate || (adr && tekst(adr, "AdditionalAddressDetail")) || null,
    postnr: adr && tekst(adr, "PostalCode"),
    poststed: by && by !== "-" ? by : null,
    land: (adr && tekst(adr, "Country")) || "NO",
    epost: tekst(el, "Contact", "Email") ?? tekst(el, "Email"),
  };
}

export function lesSaft(xml: string): SaftImport {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Filen er ikke gyldig XML.");
  const rot = doc.documentElement;
  if (rot.localName !== "AuditFile")
    throw new Error("Filen ser ikke ut som en SAF-T-fil (mangler AuditFile).");

  const header = alle(doc, "Header")[0] ?? null;
  const firmaEl = header && barn(header, "Company");
  const utvalg = header && barn(header, "SelectionCriteria");
  const slutt =
    utvalg &&
    (tekst(utvalg, "SelectionEndDate") ??
      periodeslutt(tekst(utvalg, "PeriodEndYear"), tekst(utvalg, "PeriodEnd")));

  const kontoer = alle(doc, "Account")
    .filter((a) => barn(a, "AccountID"))
    .map((a) => ({
      nummer: tekst(a, "AccountID")!,
      navn: tekst(a, "AccountDescription") ?? tekst(a, "AccountID")!,
      saldo: round2(tall(a, "ClosingDebitBalance") - tall(a, "ClosingCreditBalance")),
    }));

  const parter = (navn: string, idTag: string) =>
    alle(doc, navn)
      .map((e) => part(e, idTag))
      .filter((p): p is SaftPart => !!p);

  return {
    firma: {
      navn: tekst(firmaEl, "Name") ?? "",
      orgNr: rensOrgNr(tekst(firmaEl, "RegistrationNumber")),
    },
    periodeSlutt: slutt,
    kontoer,
    kunder: parter("Customer", "CustomerID"),
    leverandorer: parter("Supplier", "SupplierID"),
  };
}

function periodeslutt(aar: string | null, periode: string | null): string | null {
  if (!aar || !periode) return null;
  const sisteDag = new Date(Date.UTC(Number(aar), Number(periode), 0));
  return sisteDag.toISOString().slice(0, 10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Dagen etter siste dag i den importerte perioden, eller 1. januar i år. */
export function aapningsdato(periodeSlutt: string | null, idag: string): string {
  if (!periodeSlutt) return `${idag.slice(0, 4)}-01-01`;
  const d = new Date(`${periodeSlutt}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type Aapningslinje = { konto: string; tekst: string; debet: number; kredit: number };

/**
 * Åpningsbalanse fra utgående saldo på balansekontoene (1xxx–2xxx). Er året ikke avsluttet i det gamle systemet, går
 * ikke balansen opp; differansen er årets resultat og føres mot annen egenkapital (2050).
 */
export function byggAapningsbalanse(kontoer: SaftKonto[]): Aapningslinje[] {
  const linjer: Aapningslinje[] = kontoer
    .filter((k) => Number(k.nummer) < 3000 && k.saldo !== 0)
    .map((k) => ({
      konto: k.nummer,
      tekst: `Åpningsbalanse ${k.navn}`,
      debet: k.saldo > 0 ? k.saldo : 0,
      kredit: k.saldo < 0 ? -k.saldo : 0,
    }));
  const diff = round2(linjer.reduce((s, l) => s + l.debet - l.kredit, 0));
  if (diff !== 0)
    linjer.push({
      konto: "2050",
      tekst: "Resultat i importert periode (ikke årsavsluttet)",
      debet: diff < 0 ? -diff : 0,
      kredit: diff > 0 ? diff : 0,
    });
  return linjer;
}
