import { describe, expect, it } from "vitest";
import { foreslaaForBanktransaksjon, foreslaaForListe, finnRegel } from "./kontoforslag";

const sum = (ls: { debet: number; kredit: number }[]): [number, number] => [
  ls.reduce((a, l) => a + l.debet, 0),
  ls.reduce((a, l) => a + l.kredit, 0),
];

describe("kontoforslag", () => {
  it("splitter brutto med MVA og balanserer", () => {
    const f = foreslaaForBanktransaksjon(
      { dato: "2026-10-20", tekst: "Kontorlandia Oslo", belop: -125 },
      true,
    )!;
    expect(f.payload.linjer).toEqual([
      { konto: "6800", debet: 100, kredit: 0, mva_kode: "1", tekst: "Kontorlandia Oslo" },
      { konto: "2710", debet: 25, kredit: 0, mva_kode: "1", tekst: "Inngående MVA 25 %" },
      { konto: "1920", debet: 0, kredit: 125, tekst: "Kontorlandia Oslo" },
    ]);
    const [d, k] = sum(f.payload.linjer);
    expect(d).toBe(k);
  });

  it("bokfører uten MVA når firmaet ikke er MVA-registrert", () => {
    const f = foreslaaForBanktransaksjon(
      { dato: "2026-10-20", tekst: "Kontorlandia", belop: -125 },
      false,
    )!;
    expect(f.payload.linjer).toHaveLength(2);
    expect(f.payload.linjer[0]).toMatchObject({ konto: "6800", debet: 125 });
  });

  it("håndterer avrunding slik at debet = kredit", () => {
    for (const b of [99.99, 1.01, 333.33, 12345.67]) {
      const f = foreslaaForBanktransaksjon(
        { dato: "2026-10-20", tekst: "Telenor mobil", belop: -b },
        true,
      )!;
      const [d, k] = sum(f.payload.linjer);
      expect(Math.round(d * 100)).toBe(Math.round(k * 100));
    }
  });

  it("gjetter ikke når ingen regel treffer", () => {
    expect(
      foreslaaForBanktransaksjon(
        { dato: "2026-10-20", tekst: "Betaling til Ola Nordmann", belop: -500 },
        true,
      ),
    ).toBeNull();
    expect(
      foreslaaForBanktransaksjon({ dato: "2026-10-20", tekst: "Kontorlandia", belop: 0 }, true),
    ).toBeNull();
  });

  it("skiller inn- og utbetalinger", () => {
    expect(finnRegel("Rente innskudd", "inn")?.konto).toBe("8040");
    expect(finnRegel("Rente innskudd", "ut")).toBeNull();
    const inn = foreslaaForBanktransaksjon(
      { dato: "2026-10-31", tekst: "Rente innskudd", belop: 12.5 },
      true,
    )!;
    expect(inn.payload.linjer).toEqual([
      { konto: "1920", debet: 12.5, kredit: 0, tekst: "Rente innskudd" },
      { konto: "8040", debet: 0, kredit: 12.5, tekst: "Rente innskudd" },
    ]);
  });

  it("MVA-pliktige regler får lavere sikkerhet enn bankgebyr", () => {
    const g = foreslaaForBanktransaksjon(
      { dato: "2026-10-20", tekst: "Kortgebyr oktober", belop: -49 },
      true,
    )!;
    const p = foreslaaForBanktransaksjon(
      { dato: "2026-10-20", tekst: "Microsoft 365", belop: -249 },
      true,
    )!;
    expect(g.sikkerhet).toBeGreaterThan(p.sikkerhet);
    expect(g.payload.linjer.some((l) => l.konto.startsWith("27"))).toBe(false);
  });

  it("liste: teller transaksjoner uten treff", () => {
    const r = foreslaaForListe(
      [
        { id: "1", dato: "2026-10-20", tekst: "Telenor", belop: -299 },
        { id: "2", dato: "2026-10-20", tekst: "Ukjent", belop: -10 },
      ],
      true,
    );
    expect(r.forslag).toHaveLength(1);
    expect(r.forslag[0]!.txId).toBe("1");
    expect(r.utenTreff).toBe(1);
  });
});
