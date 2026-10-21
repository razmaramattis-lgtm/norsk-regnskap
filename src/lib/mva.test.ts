import { describe, expect, it } from "vitest";
import { beregnMvaMelding, byggMvaOppgjor, byggOmvendtAvgift, MVA_KODER, splittBrutto, terminer } from "./mva";
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

describe("omvendt avgiftsplikt", () => {
  const sum = (ls: { debet: number; kredit: number }[]) => [ls.reduce((a, l) => a + l.debet, 0), ls.reduce((a, l) => a + l.kredit, 0)] as const;

  it("kode 86 med fradrag: avgiften går i null og grunnlaget rapporteres", () => {
    const ls = byggOmvendtAvgift(1000, "86", "6800", "2400");
    const [d, k] = sum(ls);
    expect(d).toBe(k);
    const m = beregnMvaMelding(ls);
    const rad = m.rader.find((r) => r.kode === "86")!;
    expect(rad.grunnlag).toBe(1000);
    expect(rad.avgift).toBe(250);
    expect(rad.fradrag).toBe(250);
    expect(m.utgaende).toBe(250);
    expect(m.inngaende).toBe(250);
    expect(m.aBetale).toBe(0);
  });

  it("kode 87 uten fradrag: avgiften skal betales og kostnadsføres", () => {
    const ls = byggOmvendtAvgift(1000, "87", "6800", "2400");
    const [d, k] = sum(ls);
    expect(d).toBe(k);
    const m = beregnMvaMelding(ls);
    const rad = m.rader.find((r) => r.kode === "87")!;
    expect(rad.grunnlag).toBe(1000); // den ikke-fradragsberettigede avgiften teller ikke som grunnlag
    expect(rad.avgift).toBe(250);
    expect(m.inngaende).toBe(0);
    expect(m.aBetale).toBe(250);
    expect(ls.find((l) => l.tekst === "Ikke fradragsberettiget mva")?.debet).toBe(250);
  });

  it("lav sats (88) bruker 2702 og 2712", () => {
    const ls = byggOmvendtAvgift(500, "88", "7140", "2400");
    expect(ls.map((l) => l.konto)).toEqual(["7140", "2712", "2702", "2400"]);
    expect(ls[2]?.kredit).toBe(60);
  });

  it("vanlige koder påvirkes ikke og summeres sammen med omvendt", () => {
    const m = beregnMvaMelding([
      { konto: "3000", debet: 0, kredit: 1000, mva_kode: "3" },
      { konto: "2700", debet: 0, kredit: 250, mva_kode: "3" },
      ...byggOmvendtAvgift(400, "86", "6800", "2400"),
    ]);
    expect(m.utgaende).toBe(350);
    expect(m.inngaende).toBe(100);
    expect(m.aBetale).toBe(250);
  });

  it("MVA-oppgjør nuller ut beregnet avgift sammen med øvrig mva", () => {
    const o = byggMvaOppgjor(byggOmvendtAvgift(1000, "86", "6800", "2400"));
    expect(o.map((l) => l.konto)).toEqual(["2700", "2710"]); // begge nulles, ingen 2740-linje siden netto er 0
    expect(sum(o)[0]).toBe(sum(o)[1]);
  });

  it("nekter koder uten omvendt avgiftsplikt og ugyldig beløp", () => {
    expect(() => byggOmvendtAvgift(100, "1", "6800", "2400")).toThrow();
    expect(() => byggOmvendtAvgift(0, "86", "6800", "2400")).toThrow();
  });

  it("alle koder er unike", () => {
    const k = MVA_KODER.map((x) => x.kode);
    expect(new Set(k).size).toBe(k.length);
  });
});
