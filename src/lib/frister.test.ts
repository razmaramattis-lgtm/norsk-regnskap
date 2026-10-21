import { describe, expect, it } from "vitest";
import {
  dagerTil,
  erVirkedag,
  fristerForAar,
  helligdager,
  kommendeFrister,
  mvaFrist,
  nesteVirkedag,
  paaskedag,
} from "./frister";

describe("påske og helligdager", () => {
  it("beregner påskedag riktig", () => {
    expect(paaskedag(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
    expect(paaskedag(2027).toISOString().slice(0, 10)).toBe("2027-03-28");
    expect(paaskedag(2024).toISOString().slice(0, 10)).toBe("2024-03-31");
  });

  it("inneholder bevegelige og faste helligdager for 2026", () => {
    const h = helligdager(2026);
    for (const d of [
      "2026-01-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-05",
      "2026-04-06",
      "2026-05-01",
      "2026-05-17",
      "2026-05-14",
      "2026-05-24",
      "2026-05-25",
      "2026-12-25",
      "2026-12-26",
    ]) {
      expect(h.has(d), d).toBe(true);
    }
    expect(h.size).toBe(12);
  });

  it("flytter helg og helligdag til neste virkedag", () => {
    expect(erVirkedag("2026-10-12")).toBe(true);
    expect(erVirkedag("2026-10-10")).toBe(false); // lørdag
    expect(nesteVirkedag("2026-10-10")).toBe("2026-10-12");
    expect(nesteVirkedag("2026-04-03")).toBe("2026-04-07"); // langfredag → fredag, lørdag, søndag, 2. påskedag → tirsdag
    expect(nesteVirkedag("2026-04-10")).toBe("2026-04-10");
  });
});

describe("MVA-frister", () => {
  it("følger terminene 10.4 / 10.6 / 31.8 / 10.10 / 10.12 / 10.2", () => {
    expect(mvaFrist(2026, 1).opprinnelig).toBe("2026-04-10");
    expect(mvaFrist(2026, 2).opprinnelig).toBe("2026-06-10");
    expect(mvaFrist(2026, 3).opprinnelig).toBe("2026-08-31");
    expect(mvaFrist(2026, 4).opprinnelig).toBe("2026-10-10");
    expect(mvaFrist(2026, 5).opprinnelig).toBe("2026-12-10");
    expect(mvaFrist(2026, 6).opprinnelig).toBe("2027-02-10");
  });

  it("flytter 4. termin 2026 fra lørdag til mandag", () => {
    expect(mvaFrist(2026, 4).dato).toBe("2026-10-12");
  });

  it("årstermin forfaller 10. mars året etter", () => {
    expect(mvaFrist(2026, "aarlig").opprinnelig).toBe("2027-03-10");
  });
});

describe("fristerForAar", () => {
  const as = {
    selskapstype: "as",
    mvaRegistrert: true,
    mvaTermin: "tomaaned",
    harAnsatte: true,
  } as const;

  it("gir riktig antall og sorterer på dato", () => {
    const f = fristerForAar(2026, as);
    const datoer = f.map((x) => x.dato);
    expect([...datoer].sort()).toEqual(datoer);
    expect(f.filter((x) => x.kategori === "mva")).toHaveLength(6);
    expect(f.filter((x) => x.id.startsWith("a-melding"))).toHaveLength(12);
    expect(f.filter((x) => x.id.startsWith("trekk-aga"))).toHaveLength(6);
  });

  it("legger skattemelding på mandag 1. juni 2026 (31. mai er søndag)", () => {
    const s = fristerForAar(2026, as).find((x) => x.id === "skattemelding-2026")!;
    expect(s.opprinnelig).toBe("2026-05-31");
    expect(s.dato).toBe("2026-06-01");
  });

  it("ENK får ikke aksjonærregister, generalforsamling eller årsregnskap", () => {
    const f = fristerForAar(2026, { ...as, selskapstype: "enk" });
    expect(f.some((x) => x.id.startsWith("aksjonaer"))).toBe(false);
    expect(f.some((x) => x.id.startsWith("aarsregnskap"))).toBe(false);
    expect(f.find((x) => x.id.startsWith("skattemelding"))?.tittel).toMatch(/næringsspesifikasjon/);
  });

  it("utelater MVA og lønn når de ikke gjelder", () => {
    const f = fristerForAar(2026, {
      selskapstype: "as",
      mvaRegistrert: false,
      mvaTermin: "tomaaned",
      harAnsatte: false,
    });
    expect(f.some((x) => x.kategori === "mva" || x.kategori === "lonn")).toBe(false);
  });
});

describe("kommendeFrister", () => {
  it("krysser årsskiftet uten duplikater", () => {
    const v = {
      selskapstype: "as",
      mvaRegistrert: true,
      mvaTermin: "tomaaned",
      harAnsatte: true,
    } as const;
    const k = kommendeFrister("2026-12-20", v, 8);
    expect(k[0]!.dato >= "2026-12-20").toBe(true);
    expect(new Set(k.map((x) => x.id)).size).toBe(k.length);
    expect(k.some((x) => x.dato.startsWith("2027"))).toBe(true);
  });

  it("dagerTil teller kalenderdager", () => {
    expect(dagerTil("2026-10-21", "2026-10-31")).toBe(10);
    expect(dagerTil("2026-10-21", "2026-10-20")).toBe(-1);
  });
});
