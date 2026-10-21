import { describe, expect, it } from "vitest";
import {
  beregnSaldo,
  byggAvskrivningsbilag,
  byggMaanedsplan,
  kanKostnadsfores,
  sumSkattemessig,
  SALDOGRUPPER,
  type Anleggsmiddel,
} from "./anleggsmidler";

const m = (over: Partial<Anleggsmiddel> & { id: string }): Anleggsmiddel => ({
  navn: "Ting",
  saldogruppe: "d",
  anskaffet: "2025-03-10",
  anskaffelseskost: 100_000,
  ...over,
});

describe("saldoavskrivning", () => {
  it("avskriver hele første år uansett anskaffelsesdato", () => {
    const r = beregnSaldo([m({ id: "1", anskaffet: "2025-12-28" })], 2025);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      ib: 0,
      tilgang: 100_000,
      saldoFoer: 100_000,
      avskrivning: 20_000,
      ub: 80_000,
    });
  });

  it("ruller saldo år for år", () => {
    const r = beregnSaldo([m({ id: "1" })], 2027);
    expect(r[0]).toMatchObject({ ib: 64_000, tilgang: 0, avskrivning: 12_800, ub: 51_200 });
  });

  it("slår sammen driftsmidler i felles saldogruppe", () => {
    const r = beregnSaldo(
      [m({ id: "1" }), m({ id: "2", anskaffelseskost: 50_000, anskaffet: "2026-01-05" })],
      2026,
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      ib: 80_000,
      tilgang: 50_000,
      saldoFoer: 130_000,
      avskrivning: 26_000,
    });
  });

  it("gir egen saldo per bygg i gruppe i", () => {
    const r = beregnSaldo(
      [
        m({ id: "b1", navn: "Kontorbygg", saldogruppe: "i", anskaffelseskost: 5_000_000 }),
        m({ id: "b2", navn: "Lager", saldogruppe: "i", anskaffelseskost: 2_000_000 }),
      ],
      2025,
    );
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.avskrivning).sort((a, b) => a - b)).toEqual([40_000, 100_000]);
  });

  it("salg gir avgang og negativ saldo inntektsføres med 20 %", () => {
    const r = beregnSaldo([m({ id: "1", solgt: "2026-06-01", salgssum: 100_000 })], 2026);
    // IB 80 000, avgang 100 000 → saldo −20 000
    expect(r[0]).toMatchObject({
      ib: 80_000,
      avgang: 100_000,
      saldoFoer: -20_000,
      avskrivning: 0,
      inntektsforing: 4_000,
      ub: -16_000,
    });
  });

  it("negativ saldo kan inntektsføres raskere, men ikke under 20 %", () => {
    const med = (p: number) =>
      beregnSaldo([m({ id: "1", solgt: "2026-06-01", salgssum: 100_000 })], 2026, p)[0]!;
    expect(med(100).inntektsforing).toBe(20_000);
    expect(() => beregnSaldo([m({ id: "1" })], 2025, 10)).toThrow();
  });

  it("ignorerer driftsmidler anskaffet etter valgt år og tomt register", () => {
    expect(beregnSaldo([m({ id: "1", anskaffet: "2027-01-01" })], 2026)).toEqual([]);
    expect(beregnSaldo([], 2026)).toEqual([]);
  });

  it("restsaldo under grensen kan kostnadsføres", () => {
    const r = beregnSaldo([m({ id: "1", anskaffelseskost: 35_000 })], 2025);
    expect(r[0]!.ub).toBe(28_000);
    expect(r[0]!.kanKostnadsforeRest).toBe(true);
  });

  it("grense for direkte kostnadsføring", () => {
    expect(kanKostnadsfores(29_999)).toBe(true);
    expect(kanKostnadsfores(30_000)).toBe(false);
    expect(kanKostnadsfores(80_000, 2)).toBe(true);
  });

  it("alle saldogrupper har sats og konto", () => {
    expect(Object.keys(SALDOGRUPPER)).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
    expect(SALDOGRUPPER.a.sats).toBe(30);
  });
});

describe("avskrivningsbilag", () => {
  it("balanserer og bruker 6010 for maskiner og 6000 for bygg", () => {
    const rader = beregnSaldo(
      [
        m({ id: "1" }),
        m({ id: "b1", saldogruppe: "i", navn: "Bygg", anskaffelseskost: 1_000_000 }),
      ],
      2025,
    );
    const ls = byggAvskrivningsbilag(rader);
    expect(ls.reduce((s, l) => s + l.debet, 0)).toBe(ls.reduce((s, l) => s + l.kredit, 0));
    expect(ls.find((l) => l.konto === "6010")?.debet).toBe(20_000);
    expect(ls.find((l) => l.konto === "6000")?.debet).toBe(20_000);
    expect(ls.find((l) => l.konto === "1250")?.kredit).toBe(20_000);
  });

  it("lager ingen linjer når det ikke er noe å avskrive, og fører ikke inntektsføring", () => {
    const rader = beregnSaldo([m({ id: "1", solgt: "2026-06-01", salgssum: 100_000 })], 2026);
    expect(byggAvskrivningsbilag(rader)).toEqual([]);
    expect(sumSkattemessig(rader).inntektsforing).toBe(4_000);
  });
});

describe("månedsplan", () => {
  it("fordeler årsavskrivningen på 12 balanserte bilag som summerer eksakt", () => {
    const rader = beregnSaldo([m({ id: "1", anskaffelseskost: 100_001 })], 2025);
    const aar = sumSkattemessig(rader).avskrivning; // 20 000,20
    const plan = byggMaanedsplan(rader, 2025);
    expect(plan).toHaveLength(12);
    for (const md of plan) {
      const debet = md.linjer.reduce((s, l) => s + l.debet, 0);
      const kredit = md.linjer.reduce((s, l) => s + l.kredit, 0);
      expect(debet).toBe(kredit);
      expect(md.sum).toBe(debet);
      expect(md.dato.slice(0, 7)).toBe(`2025-${String(md.maaned).padStart(2, "0")}`);
    }
    const total = plan.reduce((s, md) => s + md.sum, 0);
    expect(Math.round(total * 100)).toBe(Math.round(aar * 100));
    // Januar–november er like, desember tar avrundingsresten.
    expect(plan[0].sum).toBe(plan[10].sum);
    expect(plan[11].sum).not.toBe(plan[0].sum);
  });
});
