import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BETALT_FRA, KJOPSTYPER, byggHendelse, type HendelseInput } from "./hendelser";

const sql = readFileSync("drizzle/migrations/0000_norsk_regnskap_kjerne.sql", "utf8");
const finnes = (konto: string, type: "as" | "enk") =>
  [
    ...sql.matchAll(
      new RegExp(`^\\('${konto}','[^']*',(?:NULL|'[^']*'),(NULL|'as'|'enk')\\)`, "gm"),
    ),
  ].some((r) => r[1] === "NULL" || r[1] === `'${type}'`);
const balanserer = (ls: { debet: number; kredit: number }[]) =>
  Math.round(ls.reduce((s, x) => s + x.debet - x.kredit, 0) * 100) === 0;

const basis = { belop: 1250, tekst: "Test", mvaRegistrert: true } as const;

describe("byggHendelse", () => {
  it("kjøp splitter inngående mva", () => {
    const ls = byggHendelse({ ...basis, type: "kjop", kjopstype: "kontor", firmatype: "as" });
    expect(ls).toEqual([
      { konto: "6800", tekst: "Test", debet: 1000, kredit: 0, mva_kode: "1" },
      { konto: "2710", tekst: "Inngående mva 25 %", debet: 250, kredit: 0, mva_kode: "1" },
      { konto: "1920", tekst: "Test", debet: 0, kredit: 1250, mva_kode: "" },
    ]);
  });

  it("kjøp uten fradrag og for ikke-registrerte har ingen mva-linje", () => {
    expect(
      byggHendelse({ ...basis, type: "kjop", kjopstype: "representasjon", firmatype: "as" }),
    ).toHaveLength(2);
    expect(
      byggHendelse({
        ...basis,
        mvaRegistrert: false,
        type: "kjop",
        kjopstype: "kontor",
        firmatype: "enk",
      }),
    ).toHaveLength(2);
  });

  it("salg fører utgående mva", () => {
    const ls = byggHendelse({ ...basis, type: "salg", sats: 15, firmatype: "as" });
    expect(ls.map((x) => [x.konto, x.debet, x.kredit, x.mva_kode])).toEqual([
      ["1920", 1250, 0, ""],
      ["3010", 0, 1086.96, "31"],
      ["2701", 0, 163.04, "31"],
    ]);
  });

  it("eier inn og ut følger firmaformen", () => {
    expect(byggHendelse({ ...basis, type: "eier_ut", firmatype: "enk" })[0]!.konto).toBe("2010");
    expect(byggHendelse({ ...basis, type: "eier_inn", firmatype: "as" })[1]!.konto).toBe("2910");
  });

  it("alle varianter balanserer og bruker kontoer fra NS 4102-malen", () => {
    const varianter: HendelseInput[] = [];
    for (const firmatype of ["as", "enk"] as const)
      for (const mvaRegistrert of [true, false]) {
        for (const k of KJOPSTYPER)
          for (const f of BETALT_FRA)
            varianter.push({
              type: "kjop",
              belop: 99.99,
              tekst: "x",
              firmatype,
              mvaRegistrert,
              kjopstype: k.id,
              betaltFra: f.konto,
            });
        for (const sats of [25, 15, 12, 0])
          varianter.push({
            type: "salg",
            belop: 99.99,
            tekst: "x",
            firmatype,
            mvaRegistrert,
            sats,
          });
        for (const type of ["overforing", "eier_inn", "eier_ut"] as const)
          varianter.push({ type, belop: 99.99, tekst: "x", firmatype, mvaRegistrert });
      }
    for (const v of varianter) {
      const ls = byggHendelse(v);
      expect(balanserer(ls), JSON.stringify(v)).toBe(true);
      for (const x of ls)
        expect(finnes(x.konto, v.firmatype), `${x.konto} for ${v.firmatype}`).toBe(true);
    }
  });
});
