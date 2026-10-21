import { describe, expect, it } from "vitest";
import { beregnMvaMelding, splittBrutto, terminer } from "./mva";
import { gyldigOrgNr, kidMod10 } from "./format";

describe("MVA", () => {
  it("splitter 1250 kr inkl. 25 % mva i 1000 + 250", () => {
    expect(splittBrutto(1250, 25)).toEqual({ netto: 1000, mva: 250 });
  });
  it("splitter 115 kr inkl. 15 % mva i 100 + 15", () => {
    expect(splittBrutto(115, 15)).toEqual({ netto: 100, mva: 15 });
  });
  it("beregner mva å betale = utgående − inngående", () => {
    const m = beregnMvaMelding([
      { konto: "3000", debet: 0, kredit: 1000, mva_kode: "3" },
      { konto: "2700", debet: 0, kredit: 250, mva_kode: "3" },
      { konto: "6800", debet: 400, kredit: 0, mva_kode: "1" },
      { konto: "2710", debet: 100, kredit: 0, mva_kode: "1" },
    ]);
    expect(m.utgaende).toBe(250);
    expect(m.inngaende).toBe(100);
    expect(m.aBetale).toBe(150);
    expect(m.rader.find((r) => r.kode === "3")!.grunnlag).toBe(1000);
  });
  it("har seks tomånedlige terminer", () => {
    const t = terminer(2026, "tomaaned");
    expect(t).toHaveLength(6);
    expect(t[0].til).toBe("2026-02-28");
  });
});

describe("Norske nummer", () => {
  it("godtar gyldig org.nr 974760673 (Brønnøysundregistrene)", () => {
    expect(gyldigOrgNr("974760673")).toBe(true);
  });
  it("avviser ugyldig org.nr", () => {
    expect(gyldigOrgNr("974760674")).toBe(false);
  });
  it("lager KID med mod10", () => {
    expect(kidMod10("00010001")).toBe("000100016");
  });
});
