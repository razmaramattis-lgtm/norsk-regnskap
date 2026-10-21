import { describe, expect, it } from "vitest";
import { beregnLonn, AGA_SONER } from "./lonn";
import { parseBankCsv } from "./bankimport";
import { byggSaft } from "./saft";

describe("Lønn", () => {
  it("bruker 14,1 % arbeidsgiveravgift i sone 1 og 0 % i sone 5", () => {
    expect(AGA_SONER["1"]?.sats).toBe(14.1);
    expect(AGA_SONER["5"]?.sats).toBe(0);
  });
  it("beregner 10,2 % feriepenger, tabelltrekk i hele kroner og AGA av lønn + feriepenger + OTP", () => {
    const r = beregnLonn({ brutto: 50000, tillegg: 0, skattetrekkProsent: 30, feriepengesats: 10.2, otpProsent: 2, agaSats: 14.1 });
    expect(r.feriepenger).toBe(5100);
    expect(r.skattetrekk).toBe(15000);
    expect(r.netto).toBe(35000);
    expect(r.otp).toBe(1000);
    expect(r.aga).toBe(7910.1);
  });
});

describe("Bankimport", () => {
  it("leser DNB-format med Ut/Inn-kolonner", () => {
    const csv = `"Dato";"Forklaring";"Rentedato";"Ut fra konto";"Inn på konto"\n"01.10.2026";"Kiwi";"01.10.2026";"115,00";""\n"02.10.2026";"Innbetaling 10001";"02.10.2026";"";"1.250,00"`;
    const r = parseBankCsv(csv);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ dato: "2026-10-01", belop: -115 });
    expect(r[1]?.belop).toBe(1250);
  });
  it("leser format med ett beløpsfelt", () => {
    const r = parseBankCsv("Dato;Beskrivelse;Beløp\n2026-10-03;Gebyr;-49,00");
    expect(r[0]?.belop).toBe(-49);
  });
});

describe("SAF-T", () => {
  it("lager SAF-T Financial 1.30 med org.nr og balanserte totaler", () => {
    const xml = byggSaft({
      company: { name: "Test AS", org_nr: "974760673", adresse: null, postnr: null, poststed: null },
      fra: "2026-01-01",
      til: "2026-12-31",
      accounts: [{ number: "1920", name: "Bank" }, { number: "3000", name: "Salg" }],
      customers: [],
      suppliers: [],
      vouchers: [{ id: "v1", bilagsnr: 1, dato: "2026-02-01", beskrivelse: "Salg", lines: [{ konto: "1920", debet: 100, kredit: 0, mva_kode: null, tekst: null }, { konto: "3000", debet: 0, kredit: 100, mva_kode: "3", tekst: null }] }],
    });
    expect(xml).toContain("<RegistrationNumber>974760673</RegistrationNumber>");
    expect(xml).toContain("<TotalDebit>100.00</TotalDebit>");
    expect(xml).toContain("<TotalCredit>100.00</TotalCredit>");
    expect(xml).toContain("urn:StandardAuditFile-Taxation-Financial:NO");
  });
});
