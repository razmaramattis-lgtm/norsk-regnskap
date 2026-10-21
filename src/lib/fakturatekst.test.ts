import { describe, expect, it } from "vitest";
import { fakturaEpost, mailto, nyFrist, purreEpost } from "./fakturatekst";

const firma = { name: "Fjord AS", org_nr: "923609016", kontonummer: "1503.12.34562" };
const kunde = { navn: "Kunde AS", epost: "post@kunde.no" };
const f = { fakturanr: 10001, kid: "100013", total: 1250, forfallsdato: "2026-10-01" };

describe("fakturatekst", () => {
  it("faktura-e-post har beløp, forfall, konto og KID", () => {
    const e = fakturaEpost(f, firma, kunde);
    expect(e.til).toBe("post@kunde.no");
    expect(e.emne).toBe("Faktura 10001 fra Fjord AS");
    expect(e.tekst).toContain("Forfall: 01.10.2026");
    expect(e.tekst).toContain("KID: 100013");
    expect(e.tekst).toContain("Org.nr 923 609 016");
  });

  it("purring gir 14 dagers ny frist", () => {
    expect(nyFrist("2026-10-21")).toBe("2026-11-04");
    const e = purreEpost(f, firma, kunde, "2026-10-21");
    expect(e.emne).toMatch(/^Påminnelse/);
    expect(e.tekst).toContain("forfalt 01.10.2026");
    expect(e.tekst).toContain("Forfall: 04.11.2026");
  });

  it("mailto koder emne og tekst", () => {
    expect(mailto({ til: "a@b.no", emne: "Hei på deg", tekst: "linje\nto" })).toBe(
      "mailto:a%40b.no?subject=Hei%20p%C3%A5%20deg&body=linje%0Ato",
    );
  });
});
