import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MALER, bruk, malerFor } from "./bokforingsmaler";

// Leser kontomalen direkte fra migrasjonen, slik at en mal aldri kan peke på en konto som ikke finnes.
const sql = readFileSync("drizzle/migrations/0000_norsk_regnskap_kjerne.sql", "utf8");
const kontoer = new Map<string, "as" | "enk" | null>();
for (const m of sql.matchAll(/^\('(\d{4})','[^']*',(?:NULL|'[^']*'),(NULL|'as'|'enk')\)/gm)) {
  const kun = m[2] === "NULL" ? null : (m[2]!.replace(/'/g, "") as "as" | "enk");
  // Samme kontonummer kan finnes både for as og enk; behold "tilgjengelig for begge" hvis det finnes én uten begrensning.
  const eksisterende = kontoer.get(m[1]!);
  kontoer.set(m[1]!, eksisterende === undefined || kun === null ? kun : eksisterende);
}
const tilgjengelig = (konto: string, type: "as" | "enk") => {
  const rader = [
    ...sql.matchAll(
      new RegExp(`^\\('${konto}','[^']*',(?:NULL|'[^']*'),(NULL|'as'|'enk')\\)`, "gm"),
    ),
  ].map((r) => r[1]!.replace(/'/g, ""));
  return rader.some((k) => k === "NULL" || k === type);
};

describe("konteringsmaler", () => {
  it("kontomalen ble lest", () => {
    expect(kontoer.size).toBeGreaterThan(70);
  });

  it("unike id-er og minst to linjer", () => {
    expect(new Set(MALER.map((m) => m.id)).size).toBe(MALER.length);
    for (const m of MALER) expect(m.linjer.length).toBeGreaterThanOrEqual(2);
  });

  it("alle kontoer finnes i NS 4102-malen for firmatypene malen gjelder", () => {
    for (const m of MALER) {
      const typer: ("as" | "enk")[] = m.gjelder === "alle" ? ["as", "enk"] : [m.gjelder];
      for (const t of typer)
        for (const l of m.linjer)
          expect(tilgjengelig(l.konto, t), `${m.id}: konto ${l.konto} for ${t}`).toBe(true);
    }
  });

  it("alle maler har både debet og kredit", () => {
    for (const m of MALER) {
      expect(m.linjer.some((l) => l.side === "debet")).toBe(true);
      expect(m.linjer.some((l) => l.side === "kredit")).toBe(true);
    }
  });

  it("filtrerer på firmatype", () => {
    expect(malerFor("as").some((m) => m.id === "utbytte-utbetaling")).toBe(true);
    expect(malerFor("as").some((m) => m.id === "privatuttak")).toBe(false);
    expect(malerFor("enk").some((m) => m.id === "privatuttak")).toBe(true);
    expect(malerFor("enk").some((m) => m.id === "utbytte-utbetaling")).toBe(false);
  });

  it("bruk() balanserer og runder til øre", () => {
    for (const m of MALER) {
      const p = bruk(m, 1234.567);
      expect(p.reduce((s, l) => s + l.debet, 0)).toBeCloseTo(
        p.reduce((s, l) => s + l.kredit, 0),
        6,
      );
      expect(p[0]!.debet + p[0]!.kredit).toBe(1234.57);
    }
    expect(bruk(MALER[0]!, -50)[0]!.debet).toBe(50);
  });
});
