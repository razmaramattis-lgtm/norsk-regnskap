import { describe, expect, it } from "vitest";
import { differanse, kontrollerBilag } from "./bilagskontroll";

const kontoer = [
  { number: "1920", mva_kode: null },
  { number: "6800", mva_kode: "1" },
  { number: "2710", mva_kode: "1" },
];
const basis = { dato: "2026-10-20", idag: "2026-10-21", beskrivelse: "Kontor", kontoer, mvaRegistrert: true };

describe("kontrollerBilag", () => {
  it("godtar et riktig kjøp med mva", () => {
    expect(
      kontrollerBilag({
        ...basis,
        linjer: [
          { konto: "6800", debet: 100, kredit: 0, mva_kode: "1" },
          { konto: "2710", debet: 25, kredit: 0, mva_kode: "1" },
          { konto: "1920", debet: 0, kredit: 125, mva_kode: "" },
        ],
      }),
    ).toEqual([]);
  });

  it("finner ubalanse, ukjent konto, låst periode og debet+kredit på samme linje", () => {
    const f = kontrollerBilag({
      ...basis,
      laastTil: "2026-10-31",
      linjer: [
        { konto: "9999", debet: 100, kredit: 10, mva_kode: "" },
        { konto: "1920", debet: 0, kredit: 80, mva_kode: "" },
      ],
    });
    const tekst = f.filter((x) => x.alvor === "feil").map((x) => x.tekst).join(" | ");
    expect(tekst).toMatch(/balanserer ikke.*10\.00/);
    expect(tekst).toMatch(/9999 finnes ikke/);
    expect(tekst).toMatch(/låst/);
    expect(tekst).toMatch(/både debet og kredit/);
  });

  it("advarer når et kjøp mangler inngående mva", () => {
    const f = kontrollerBilag({
      ...basis,
      linjer: [
        { konto: "6800", debet: 125, kredit: 0, mva_kode: "" },
        { konto: "1920", debet: 0, kredit: 125, mva_kode: "" },
      ],
    });
    expect(f).toEqual([{ alvor: "advarsel", tekst: expect.stringMatching(/inngående mva/) }]);
  });

  it("differanse", () => {
    expect(differanse([{ konto: "1", debet: 0.1, kredit: 0, mva_kode: "" }, { konto: "2", debet: 0.2, kredit: 0.3, mva_kode: "" }])).toBe(0);
  });
});
