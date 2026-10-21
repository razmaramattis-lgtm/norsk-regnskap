import { describe, expect, it } from "vitest";
import { beregnMvaMelding, byggMvaOppgjor, splittBrutto, terminer } from "./mva";
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
    expect(m.rader.find((r) => r.kode === "3")?.grunnlag).toBe(1000);
  });
  it("har seks tomånedlige terminer", () => {
    const t = terminer(2026, "tomaaned");
    expect(t).toHaveLength(6);
    expect(t[0]?.til).toBe("2026-02-28");
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

describe("byggMvaOppgjor", () => {
  const sum = (ls: { debet: number; kredit: number }[]) => [ls.reduce((a, l) => a + l.debet, 0), ls.reduce((a, l) => a + l.kredit, 0)] as const;

  it("gjør opp skyldig MVA mot 2740", () => {
    const o = byggMvaOppgjor([
      { konto: "2700", debet: 0, kredit: 2500 },
      { konto: "2701", debet: 0, kredit: 150 },
      { konto: "2710", debet: 800, kredit: 0 },
      { konto: "2711", debet: 30, kredit: 0 },
      { konto: "1920", debet: 99999, kredit: 0 },
    ]);
    expect(o.find((l) => l.konto === "2740")).toEqual({ konto: "2740", tekst: "Skyldig MVA til oppgjør", debet: 0, kredit: 1820 });
    const [d, k] = sum(o);
    expect(d).toBeCloseTo(k, 6);
    expect(o.some((l) => l.konto === "1920")).toBe(false);
  });

  it("gir tilgode (debet 2740) når inngående overstiger utgående", () => {
    const o = byggMvaOppgjor([
      { konto: "2700", debet: 0, kredit: 100 },
      { konto: "2710", debet: 600, kredit: 0 },
    ]);
    expect(o.find((l) => l.konto === "2740")).toMatchObject({ debet: 500, kredit: 0 });
    const [d, k] = sum(o);
    expect(d).toBeCloseTo(k, 6);
  });

  it("tar hensyn til kreditnotaer og netter flere linjer per konto", () => {
    const o = byggMvaOppgjor([
      { konto: "2700", debet: 0, kredit: 1000 },
      { konto: "2700", debet: 250, kredit: 0 },
      { konto: "2710", debet: 100, kredit: 0 },
    ]);
    expect(o.find((l) => l.konto === "2700")).toMatchObject({ debet: 750, kredit: 0 });
    expect(o.find((l) => l.konto === "2740")).toMatchObject({ kredit: 650 });
  });

  it("returnerer tomt når det ikke er noe å gjøre opp", () => {
    expect(byggMvaOppgjor([])).toEqual([]);
    expect(byggMvaOppgjor([{ konto: "2700", debet: 0, kredit: 100 }, { konto: "2700", debet: 100, kredit: 0 }])).toEqual([]);
  });

  it("er balansert også med desimaler", () => {
    const o = byggMvaOppgjor([
      { konto: "2700", debet: 0, kredit: 33.33 },
      { konto: "2702", debet: 0, kredit: 12.01 },
      { konto: "2712", debet: 7.77, kredit: 0 },
    ]);
    const [d, k] = sum(o);
    expect(Math.round(d * 100)).toBe(Math.round(k * 100));
  });
});
