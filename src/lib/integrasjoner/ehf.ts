import { gyldigKontonummer, gyldigOrgNr } from "../format";
import type { Valideringsfeil } from "./adapter";

/**
 * Bygger en utgående faktura som Peppol BIS Billing 3.0 (EHF 3.0, UBL 2.1).
 *
 * VIKTIG: Dokumentet er bygget etter Peppol BIS Billing 3.0 sine regler, men er
 * ennå ikke kjørt mot offisielle Schematron-regler. Det må gjøres sammen med
 * aksesspunkt-leverandøren (de fleste validerer ved mottak) før produksjon.
 */

export const EHF_CUSTOMIZATION_ID =
  "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0";
export const EHF_PROFILE_ID = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";
/** ICD 0192 = norsk organisasjonsnummer (Enhetsregisteret). */
export const ORGNR_SCHEME = "0192";

export type EhfPart = {
  navn: string;
  orgNr: string;
  adresse?: string | null;
  postnr?: string | null;
  poststed?: string | null;
  land?: string | null;
  /** Kun selger: MVA-registrert → «NO{orgnr}MVA». */
  mvaRegistrert?: boolean;
};

export type EhfLinje = {
  beskrivelse: string;
  antall: number;
  enhetspris: number;
  mvaSats: number;
  /** UN/ECE rec. 20, f.eks. C62 (stk), HUR (time), DAY (dag). */
  enhet?: string;
};

export type EhfInput = {
  fakturanr: string | number;
  fakturadato: string;
  forfallsdato: string;
  selger: EhfPart;
  kjoper: EhfPart;
  linjer: EhfLinje[];
  kid?: string | null;
  /** Selgers bankkonto (11 siffer). */
  kontonummer?: string | null;
  /** Kjøpers referanse (påkrevd for offentlig sektor). */
  kjopersReferanse?: string | null;
  merknad?: string | null;
  valuta?: string;
  /** Totalbeløp lagret i databasen, brukes til kontroll mot beregnet sum. */
  lagretTotal?: { netto: number; mva: number; total: number };
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const f2 = (n: number) => r2(n).toFixed(2);

export function xmlEsc(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const rens = (s: string) => s.replace(/\s/g, "");

export type EhfSummer = {
  netto: number;
  mva: number;
  total: number;
  perSats: { sats: number; grunnlag: number; mva: number; kategori: "S" | "Z" }[];
  linjer: number[];
};

/** Beregner linjebeløp og MVA per sats slik Peppol forventer (avgift per kategori av grunnlaget). */
export function beregnEhfSummer(linjer: EhfLinje[]): EhfSummer {
  const linjebelop = linjer.map((l) => r2(l.antall * l.enhetspris));
  const grupper = new Map<number, number>();
  linjer.forEach((l, i) =>
    grupper.set(l.mvaSats, r2((grupper.get(l.mvaSats) ?? 0) + linjebelop[i]!)),
  );
  const perSats = [...grupper.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([sats, grunnlag]) => ({
      sats,
      grunnlag,
      mva: r2((grunnlag * sats) / 100),
      kategori: (sats > 0 ? "S" : "Z") as "S" | "Z",
    }));
  const netto = r2(linjebelop.reduce((s, x) => s + x, 0));
  const mva = r2(perSats.reduce((s, x) => s + x.mva, 0));
  return { netto, mva, total: r2(netto + mva), perSats, linjer: linjebelop };
}

export function validerEhf(i: EhfInput): Valideringsfeil[] {
  const f: Valideringsfeil[] = [];
  const feil = (felt: string, melding: string) => f.push({ felt, melding, alvor: "feil" });
  const adv = (felt: string, melding: string) => f.push({ felt, melding, alvor: "advarsel" });

  if (!gyldigOrgNr(i.selger.orgNr)) feil("selger.orgNr", "Selgers organisasjonsnummer er ugyldig.");
  if (!gyldigOrgNr(i.kjoper.orgNr))
    feil(
      "kjoper.orgNr",
      "Kjøpers organisasjonsnummer mangler eller er ugyldig. EHF krever org.nr. for norske kjøpere.",
    );
  if (!i.selger.navn.trim()) feil("selger.navn", "Selgers navn mangler.");
  if (!i.kjoper.navn.trim()) feil("kjoper.navn", "Kjøpers navn mangler.");
  if (!i.selger.adresse || !i.selger.poststed)
    feil("selger.adresse", "Selgers adresse og poststed må fylles ut.");
  if (!i.kjoper.adresse || !i.kjoper.poststed)
    adv("kjoper.adresse", "Kjøpers adresse og poststed bør fylles ut.");
  if (i.linjer.length === 0) feil("linjer", "Fakturaen har ingen linjer.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.fakturadato))
    feil("fakturadato", "Fakturadato må være YYYY-MM-DD.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.forfallsdato))
    feil("forfallsdato", "Forfallsdato må være YYYY-MM-DD.");
  if (i.forfallsdato < i.fakturadato)
    feil("forfallsdato", "Forfallsdato kan ikke være før fakturadato.");
  if (!i.kontonummer || !gyldigKontonummer(i.kontonummer))
    feil("kontonummer", "Selgers bankkontonummer mangler eller er ugyldig (11 siffer).");
  if (!i.kjopersReferanse?.trim())
    adv("kjopersReferanse", "Kjøpers referanse mangler. Offentlige kjøpere krever dette.");
  if (!i.kid) adv("kid", "KID mangler. Betalingen blir vanskeligere å avstemme.");

  i.linjer.forEach((l, n) => {
    if (!l.beskrivelse.trim()) feil(`linjer[${n}]`, "Linjen mangler beskrivelse.");
    if (![25, 15, 12, 0].includes(l.mvaSats))
      feil(`linjer[${n}]`, `MVA-sats ${l.mvaSats} % er ikke en gyldig norsk sats.`);
    if (i.selger.mvaRegistrert === false && l.mvaSats > 0)
      feil(`linjer[${n}]`, "Selger er ikke MVA-registrert og kan ikke fakturere med MVA.");
  });

  if (i.lagretTotal) {
    const s = beregnEhfSummer(i.linjer);
    const avvik = Math.max(
      Math.abs(s.netto - i.lagretTotal.netto),
      Math.abs(s.mva - i.lagretTotal.mva),
      Math.abs(s.total - i.lagretTotal.total),
    );
    if (avvik > 0.01)
      adv(
        "total",
        `Beregnet sum (${f2(s.total)}) avviker fra lagret fakturasum (${f2(i.lagretTotal.total)}). Sjekk avrunding per linje.`,
      );
  }
  return f;
}

function partXml(p: EhfPart, rolle: "selger" | "kjoper"): string {
  const org = rens(p.orgNr);
  const land = p.land || "NO";
  const mva =
    rolle === "selger" && p.mvaRegistrert
      ? `<cac:PartyTaxScheme><cbc:CompanyID>NO${xmlEsc(org)}MVA</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`
      : "";
  return `<cac:Party>
      <cbc:EndpointID schemeID="${ORGNR_SCHEME}">${xmlEsc(org)}</cbc:EndpointID>
      <cac:PartyIdentification><cbc:ID schemeID="${ORGNR_SCHEME}">${xmlEsc(org)}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${xmlEsc(p.navn)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xmlEsc(p.adresse)}</cbc:StreetName>
        <cbc:CityName>${xmlEsc(p.poststed)}</cbc:CityName>
        <cbc:PostalZone>${xmlEsc(p.postnr)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${xmlEsc(land)}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${mva}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEsc(p.navn)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="${ORGNR_SCHEME}">${xmlEsc(org)}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>`;
}

export function byggEhfFaktura(i: EhfInput): string {
  const valuta = i.valuta ?? "NOK";
  const s = beregnEhfSummer(i.linjer);
  const kontonr = i.kontonummer ? i.kontonummer.replace(/[\s.]/g, "") : null;

  const betaling = kontonr
    ? `<cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    ${i.kid ? `<cbc:PaymentID>${xmlEsc(i.kid)}</cbc:PaymentID>` : ""}
    <cac:PayeeFinancialAccount><cbc:ID>${xmlEsc(kontonr)}</cbc:ID></cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
    : "";

  const skattesubtotaler = s.perSats
    .map(
      (g) => `<cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${valuta}">${f2(g.grunnlag)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${valuta}">${f2(g.mva)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${g.kategori}</cbc:ID>
        <cbc:Percent>${g.sats.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`,
    )
    .join("\n    ");

  const linjer = i.linjer
    .map(
      (l, n) => `<cac:InvoiceLine>
    <cbc:ID>${n + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${xmlEsc(l.enhet ?? "C62")}">${l.antall}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${valuta}">${f2(s.linjer[n]!)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${xmlEsc(l.beskrivelse)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${l.mvaSats > 0 ? "S" : "Z"}</cbc:ID>
        <cbc:Percent>${l.mvaSats.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${valuta}">${f2(l.enhetspris)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`,
    )
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${EHF_CUSTOMIZATION_ID}</cbc:CustomizationID>
  <cbc:ProfileID>${EHF_PROFILE_ID}</cbc:ProfileID>
  <cbc:ID>${xmlEsc(i.fakturanr)}</cbc:ID>
  <cbc:IssueDate>${xmlEsc(i.fakturadato)}</cbc:IssueDate>
  <cbc:DueDate>${xmlEsc(i.forfallsdato)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  ${i.merknad ? `<cbc:Note>${xmlEsc(i.merknad)}</cbc:Note>` : ""}
  <cbc:DocumentCurrencyCode>${valuta}</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${xmlEsc(i.kjopersReferanse?.trim() || "ikke oppgitt")}</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    ${partXml(i.selger, "selger")}
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    ${partXml(i.kjoper, "kjoper")}
  </cac:AccountingCustomerParty>
  ${betaling}
  <cac:PaymentTerms><cbc:Note>Forfall ${xmlEsc(i.forfallsdato)}</cbc:Note></cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${valuta}">${f2(s.mva)}</cbc:TaxAmount>
    ${skattesubtotaler}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${valuta}">${f2(s.netto)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${valuta}">${f2(s.netto)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${valuta}">${f2(s.total)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${valuta}">${f2(s.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${linjer}
</Invoice>
`;
}
