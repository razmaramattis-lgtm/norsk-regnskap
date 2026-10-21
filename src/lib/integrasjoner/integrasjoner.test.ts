import { describe, expect, it } from "vitest";
import { gyldigKontonummer } from "../format";
import {
  LeverandorMangler,
  hentAdapter,
  harAdapter,
  manglendeAdapter,
  registrerAdapter,
} from "./adapter";
import { DOMENER, DOMENE_INFO } from "./domener";
import { beregnEhfSummer, byggEhfFaktura, validerEhf, xmlEsc, type EhfInput } from "./ehf";
import { byggPain001, validerBetalingsfil, type Betalingsfil } from "./pain001";

const SELGER = {
  navn: "Avargo Regnskap AS",
  orgNr: "923609016",
  adresse: "Linjevegen 16B",
  postnr: "2005",
  poststed: "Rælingen",
  mvaRegistrert: true,
};
const KJOPER = {
  navn: "Kunde & Co <test>",
  orgNr: "998877660",
  adresse: "Storgata 1",
  postnr: "0155",
  poststed: "Oslo",
};

const faktura = (over: Partial<EhfInput> = {}): EhfInput => ({
  fakturanr: 10001,
  fakturadato: "2026-10-21",
  forfallsdato: "2026-11-04",
  selger: SELGER,
  kjoper: KJOPER,
  linjer: [
    { beskrivelse: "Regnskapstjenester", antall: 2, enhetspris: 850, mvaSats: 25, enhet: "HUR" },
    { beskrivelse: "Bøker", antall: 1, enhetspris: 100, mvaSats: 0 },
  ],
  kid: "1000112",
  kontonummer: "15031234562",
  kjopersReferanse: "PO-77",
  ...over,
});

const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");

describe("kontonummer", () => {
  it("validerer mod11", () => {
    expect(gyldigKontonummer("15031234562")).toBe(true);
    expect(gyldigKontonummer("1503.12.34562")).toBe(true);
    expect(gyldigKontonummer("15031234563")).toBe(false);
    expect(gyldigKontonummer("123")).toBe(false);
  });
});

describe("EHF / Peppol BIS Billing 3.0", () => {
  it("beregner summer per MVA-sats", () => {
    const s = beregnEhfSummer(faktura().linjer);
    expect(s.netto).toBe(1800);
    expect(s.mva).toBe(425);
    expect(s.total).toBe(2225);
    expect(s.perSats.map((x) => [x.sats, x.grunnlag, x.mva, x.kategori])).toEqual([
      [25, 1700, 425, "S"],
      [0, 100, 0, "Z"],
    ]);
  });

  it("bygger velformet XML med Peppol-identifikatorer", () => {
    const xml = byggEhfFaktura(faktura());
    const doc = parse(xml);
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(xml).toContain("urn:fdc:peppol.eu:2017:poacc:billing:3.0");
    expect(xml).toContain("urn:fdc:peppol.eu:2017:poacc:billing:01:1.0");
    expect(xml).toContain('schemeID="0192">923609016<');
    expect(xml).toContain("NO923609016MVA");
    expect(xml).toContain("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>");
    expect(xml).toContain('<cbc:PayableAmount currencyID="NOK">2225.00</cbc:PayableAmount>');
    expect(xml).toContain("<cbc:PaymentID>1000112</cbc:PaymentID>");
    expect(xml).toContain("<cbc:BuyerReference>PO-77</cbc:BuyerReference>");
    expect(doc.getElementsByTagName("cac:InvoiceLine")).toHaveLength(2);
  });

  it("escaper spesialtegn i navn", () => {
    const xml = byggEhfFaktura(faktura());
    expect(xml).toContain("Kunde &amp; Co &lt;test&gt;");
    expect(xmlEsc(`a"b'c`)).toBe("a&quot;b&apos;c");
  });

  it("utelater MVA-id for selger uten MVA-registrering", () => {
    const xml = byggEhfFaktura(faktura({ selger: { ...SELGER, mvaRegistrert: false } }));
    expect(xml).not.toContain("MVA</cbc:CompanyID>");
  });

  it("godtar en korrekt faktura", () => {
    expect(validerEhf(faktura()).filter((f) => f.alvor === "feil")).toEqual([]);
  });

  it("fanger vanlige feil", () => {
    const f = validerEhf(
      faktura({
        kjoper: { ...KJOPER, orgNr: "123" },
        kontonummer: "11111111111",
        linjer: [{ beskrivelse: "", antall: 1, enhetspris: 1, mvaSats: 20 }],
        forfallsdato: "2026-10-01",
        kjopersReferanse: "",
        kid: null,
      }),
    );
    const felt = f.map((x) => x.felt);
    expect(felt).toContain("kjoper.orgNr");
    expect(felt).toContain("kontonummer");
    expect(felt).toContain("forfallsdato");
    expect(felt).toContain("linjer[0]");
    expect(f.find((x) => x.felt === "kjopersReferanse")?.alvor).toBe("advarsel");
    expect(f.find((x) => x.felt === "kid")?.alvor).toBe("advarsel");
  });

  it("avviser MVA fra selger uten MVA-registrering", () => {
    const f = validerEhf(faktura({ selger: { ...SELGER, mvaRegistrert: false } }));
    expect(f.some((x) => x.alvor === "feil" && /ikke MVA-registrert/.test(x.melding))).toBe(true);
  });

  it("advarer når lagret total avviker", () => {
    const f = validerEhf(faktura({ lagretTotal: { netto: 1800, mva: 424, total: 2224 } }));
    expect(f.some((x) => x.felt === "total")).toBe(true);
    expect(
      validerEhf(faktura({ lagretTotal: { netto: 1800, mva: 425, total: 2225 } })).some(
        (x) => x.felt === "total",
      ),
    ).toBe(false);
  });
});

describe("EHF kreditnota (Peppol Credit Note)", () => {
  const kn = (over: Partial<EhfInput> = {}) =>
    faktura({ type: "kreditnota", opprinneligFakturanr: 1001, fakturanr: 1002, ...over });

  it("bygger CreditNote-2 med type 381, referanse til opprinnelig faktura og positive beløp", () => {
    const doc = parse(byggEhfFaktura(kn()));
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(doc.documentElement.localName).toBe("CreditNote");
    expect(doc.documentElement.namespaceURI).toBe("urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2");
    const tekst = (navn: string) => doc.getElementsByTagNameNS("*", navn)[0]?.textContent;
    expect(tekst("CreditNoteTypeCode")).toBe("381");
    expect(doc.getElementsByTagNameNS("*", "InvoiceTypeCode")).toHaveLength(0);
    expect(doc.getElementsByTagNameNS("*", "DueDate")).toHaveLength(0);
    expect(doc.getElementsByTagNameNS("*", "InvoiceDocumentReference")[0]?.textContent?.trim()).toBe("1001");
    expect(doc.getElementsByTagNameNS("*", "CreditNoteLine").length).toBeGreaterThan(0);
    expect(doc.getElementsByTagNameNS("*", "InvoiceLine")).toHaveLength(0);
    expect(byggEhfFaktura(kn())).not.toMatch(/>-\d/);
  });

  it("krever referanse til opprinnelig faktura, men ikke forfall eller bankkonto", () => {
    const uten = validerEhf(kn({ opprinneligFakturanr: null, forfallsdato: "", kontonummer: null, kid: null }));
    const felt = uten.filter((f) => f.alvor === "feil").map((f) => f.felt);
    expect(felt).toContain("opprinneligFakturanr");
    expect(felt).not.toContain("forfallsdato");
    expect(felt).not.toContain("kontonummer");
    expect(validerEhf(kn({ forfallsdato: "", kontonummer: null, kid: null })).filter((f) => f.alvor === "feil")).toHaveLength(0);
  });

  it("avviser negative beløp (kreditnota skal ha positive tall)", () => {
    const f = validerEhf(kn({ linjer: [{ beskrivelse: "Tjeneste", antall: -1, enhetspris: 1000, mvaSats: 25 }] }));
    expect(f.some((x) => x.alvor === "feil" && x.felt === "linjer[0]")).toBe(true);
  });
});

describe("pain.001.001.03", () => {
  const fil = (over: Partial<Betalingsfil> = {}): Betalingsfil => ({
    meldingsId: "FB-20261021-1",
    opprettet: new Date("2026-10-21T08:30:00.123Z"),
    utforelsesdato: "2026-10-23",
    betalerNavn: "Avargo Regnskap AS",
    betalerOrgNr: "923 609 016",
    betalerKonto: "1503.12.34562",
    betalinger: [
      {
        id: "LF-1",
        mottakerNavn: "Leverandør AS",
        mottakerKonto: "86011111116",
        belop: 1250.5,
        kid: "123456789",
      },
      {
        id: "LF-2",
        mottakerNavn: "Verksted & Sønn",
        mottakerKonto: "12345678903",
        belop: 99.5,
        melding: "Faktura 55",
      },
    ],
    ...over,
  });

  it("bygger velformet fil med riktig kontrollsum og antall", () => {
    const xml = byggPain001(fil());
    const doc = parse(xml);
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(xml).toContain("<NbOfTxs>2</NbOfTxs>");
    expect(xml).toContain("<CtrlSum>1350.00</CtrlSum>");
    expect(xml).toContain("<CreDtTm>2026-10-21T08:30:00</CreDtTm>");
    expect(xml).toContain('<InstdAmt Ccy="NOK">1250.50</InstdAmt>');
    expect(xml).toContain("<Issr>KID</Issr></Tp><Ref>123456789</Ref>");
    expect(xml).toContain("<Ustrd>Faktura 55</Ustrd>");
    expect(xml).toContain("<Id>15031234562</Id>");
    expect(xml).toContain("Verksted &amp; Sønn");
  });

  it("er deterministisk (samme input gir identisk fil)", () => {
    expect(byggPain001(fil())).toBe(byggPain001(fil()));
  });

  it("validerer konto, beløp, KID og duplikater", () => {
    expect(validerBetalingsfil(fil())).toEqual([]);
    const f = validerBetalingsfil(
      fil({
        betalinger: [
          { id: "X", mottakerNavn: "A", mottakerKonto: "123", belop: 0, kid: "12ab" },
          { id: "X", mottakerNavn: "B", mottakerKonto: "86011111116", belop: 5 },
        ],
      }),
    );
    expect(f.length).toBeGreaterThanOrEqual(4);
    expect(f.some((x) => /Duplikat/.test(x.melding))).toBe(true);
  });
});

describe("adapter-register", () => {
  it("alle domener har informasjon og krav", () => {
    for (const d of DOMENER) {
      expect(DOMENE_INFO[d].id).toBe(d);
      expect(DOMENE_INFO[d].krav.length).toBeGreaterThan(0);
      expect(DOMENE_INFO[d].kandidater.every((k) => k.verifisert === false)).toBe(true);
    }
  });

  it("gir tydelig feil uten leverandør", async () => {
    const a = hentAdapter("peppol", { leverandor: null });
    await expect(a.kanMotta({ orgNr: "923609016" })).rejects.toBeInstanceOf(LeverandorMangler);
    await expect(manglendeAdapter("mva_innsending").send({} as never)).rejects.toThrow(
      /Ingen leverandør/,
    );
  });

  it("bruker registrert adapter når leverandør er valgt", async () => {
    registrerAdapter("peppol", "testlev", () => ({
      kanMotta: async () => true,
      sendFaktura: async () => ({ status: "mottatt", referanse: "R1" }),
      hentInnkommende: async () => [],
    }));
    expect(harAdapter("peppol", "testlev")).toBe(true);
    expect(harAdapter("peppol", "annen")).toBe(false);
    const a = hentAdapter("peppol", { leverandor: "testlev" });
    await expect(a.sendFaktura("<x/>", { orgNr: "1" })).resolves.toEqual({
      status: "mottatt",
      referanse: "R1",
    });
  });
});
