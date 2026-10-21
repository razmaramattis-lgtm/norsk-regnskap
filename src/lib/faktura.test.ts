import { describe, expect, it } from "vitest";
import { fakturaSummer, linjeNetto, nesteDato, restbelop } from "./faktura";

describe("faktura", () => {
  it("rabatt per linje og mva per sats", () => {
    expect(linjeNetto({ antall: 3, enhetspris: 333.33, rabatt_prosent: 10, mva_sats: 25 })).toBe(899.99);
    const s = fakturaSummer(
      [
        { antall: 1, enhetspris: 1000, mva_sats: 25 },
        { antall: 2, enhetspris: 99.99, rabatt_prosent: 5, mva_sats: 25 },
        { antall: 1, enhetspris: 200, mva_sats: 15 },
      ],
      true,
    );
    expect(s.netto).toBe(1389.98);
    // 1189,98 × 25 % = 297,495, som Postgres runder til 297,50
    expect(s.mva).toBe(327.5);
    expect(s.total).toBe(Math.round((s.netto + s.mva) * 100) / 100);
  });

  it("ikke mva-registrert gir ingen mva", () => {
    expect(fakturaSummer([{ antall: 1, enhetspris: 500, mva_sats: 25 }], false)).toMatchObject({ netto: 500, mva: 0, total: 500 });
  });

  it("neste dato for repeterende faktura", () => {
    expect(nesteDato("2026-01-31", "maaned")).toBe("2026-02-28");
    expect(nesteDato("2026-11-15", "kvartal")).toBe("2027-02-15");
    expect(nesteDato("2028-02-29", "aar")).toBe("2029-02-28");
  });

  it("restbeløp med øreavrunding", () => {
    expect(restbelop(1250, 1000)).toEqual({ rest: 250, betalt: false });
    expect(restbelop(1250.4, 1250)).toMatchObject({ betalt: true });
  });
});
