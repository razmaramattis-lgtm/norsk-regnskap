import { describe, expect, it } from "vitest";
import { aapningsdato, byggAapningsbalanse, lesSaft, rensOrgNr } from "./saftimport";

const fil = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:StandardAuditFile-Taxation-Financial:NO">
  <Header>
    <Company><RegistrationNumber>923609016</RegistrationNumber><Name>Gammelt AS</Name></Company>
    <SelectionCriteria><PeriodStart>1</PeriodStart><PeriodStartYear>2025</PeriodStartYear><PeriodEnd>12</PeriodEnd><PeriodEndYear>2025</PeriodEndYear></SelectionCriteria>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts>
      <Account><AccountID>1920</AccountID><AccountDescription>Bankinnskudd</AccountDescription><ClosingDebitBalance>150000.50</ClosingDebitBalance></Account>
      <Account><AccountID>2000</AccountID><AccountDescription>Aksjekapital</AccountDescription><ClosingCreditBalance>30000</ClosingCreditBalance></Account>
      <Account><AccountID>3000</AccountID><AccountDescription>Salg</AccountDescription><ClosingCreditBalance>120000.50</ClosingCreditBalance></Account>
      <Account><AccountID>6540</AccountID><AccountDescription>Inventar</AccountDescription><ClosingDebitBalance>0</ClosingDebitBalance></Account>
    </GeneralLedgerAccounts>
    <Customers>
      <Customer>
        <RegistrationNumber>NO 974 760 673 MVA</RegistrationNumber><Name>Kunde AS</Name>
        <Address><StreetName>Storgata</StreetName><Number>1</Number><City>Oslo</City><PostalCode>0150</PostalCode><Country>NO</Country></Address>
        <Contact><Email>post@kunde.no</Email></Contact>
        <CustomerID>K1</CustomerID>
      </Customer>
    </Customers>
    <Suppliers>
      <Supplier><Name>Leverandør AS</Name><Address><City>-</City><Country>SE</Country></Address><SupplierID>L9</SupplierID></Supplier>
    </Suppliers>
  </MasterFiles>
</AuditFile>`;

describe("lesSaft", () => {
  it("leser firma, periode, kontoer, kunder og leverandører", () => {
    const s = lesSaft(fil);
    expect(s.firma).toEqual({ navn: "Gammelt AS", orgNr: "923609016" });
    expect(s.periodeSlutt).toBe("2025-12-31");
    expect(s.kontoer.map((k) => [k.nummer, k.saldo])).toEqual([
      ["1920", 150000.5],
      ["2000", -30000],
      ["3000", -120000.5],
      ["6540", 0],
    ]);
    expect(s.kunder[0]).toEqual({
      eksternId: "K1",
      navn: "Kunde AS",
      orgNr: "974760673",
      adresse: "Storgata 1",
      postnr: "0150",
      poststed: "Oslo",
      land: "NO",
      epost: "post@kunde.no",
    });
    expect(s.leverandorer[0]).toMatchObject({
      navn: "Leverandør AS",
      orgNr: null,
      poststed: null,
      land: "SE",
    });
  });

  it("avviser filer som ikke er SAF-T", () => {
    expect(() => lesSaft("<Faktura/>")).toThrow(/SAF-T/);
    expect(() => lesSaft("ikke xml")).toThrow(/XML/);
  });
});

describe("åpningsbalanse", () => {
  it("tar bare balansekontoer og fører udisponert resultat mot 2050", () => {
    const l = byggAapningsbalanse(lesSaft(fil).kontoer);
    expect(l.map((x) => [x.konto, x.debet, x.kredit])).toEqual([
      ["1920", 150000.5, 0],
      ["2000", 0, 30000],
      ["2050", 0, 120000.5],
    ]);
    expect(l.reduce((s, x) => s + x.debet - x.kredit, 0)).toBeCloseTo(0, 2);
  });

  it("dato er dagen etter perioden", () => {
    expect(aapningsdato("2025-12-31", "2026-10-21")).toBe("2026-01-01");
    expect(aapningsdato(null, "2026-10-21")).toBe("2026-01-01");
  });

  it("renser org.nr", () => {
    expect(rensOrgNr("NO923609016MVA")).toBe("923609016");
    expect(rensOrgNr("SE5560000000")).toBeNull();
  });
});
