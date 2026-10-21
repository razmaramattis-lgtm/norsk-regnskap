import { describe, expect, it } from "vitest";
import { forslagFraHistorikk, skalerLinjer, type TidligereBilag } from "./hukommelse";

const telenor = (id: string, dato: string, belop: number): TidligereBilag => ({
  id,
  dato,
  beskrivelse: "Telenor mobil september",
  linjer: [
    { konto: "6900", tekst: "Telenor", debet: belop * 0.8, kredit: 0, mva_kode: "1" },
    { konto: "2710", tekst: "Mva", debet: belop * 0.2, kredit: 0, mva_kode: "1" },
    { konto: "1920", tekst: "Telenor", debet: 0, kredit: belop, mva_kode: null },
  ],
});

describe("forslagFraHistorikk", () => {
  it("finner tidligere føring på motpart og slår sammen like konteringer", () => {
    const h = [telenor("b", "2026-10-01", 500), telenor("a", "2026-09-01", 450)];
    const f = forslagFraHistorikk("Telenor", h);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ antall: 2, belop: 500, bilag: { id: "b" } });
  });

  it("krever minst tre tegn", () => {
    expect(forslagFraHistorikk("Te", [telenor("a", "2026-09-01", 450)])).toEqual([]);
  });
});

describe("skalerLinjer", () => {
  it("skalerer til nytt beløp og balanserer etter avrunding", () => {
    const ls = skalerLinjer(telenor("a", "2026-09-01", 500).linjer, 333.33);
    const d = ls.reduce((s, l) => s + l.debet, 0);
    const k = ls.reduce((s, l) => s + l.kredit, 0);
    expect(Math.round(d * 100)).toBe(33333);
    expect(Math.round(k * 100)).toBe(33333);
    expect(ls[1]!.debet).toBeCloseTo(66.67, 1);
  });
});
