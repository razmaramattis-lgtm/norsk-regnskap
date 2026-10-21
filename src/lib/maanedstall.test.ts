import { describe, expect, it } from "vitest";
import { maanedstall } from "./maanedstall";

describe("maanedstall", () => {
  it("summerer inntekter og kostnader per måned og hopper over andre år og 8xxx", () => {
    const m = maanedstall(
      [
        { konto: "3000", debet: 0, kredit: 10000, dato: "2026-03-05" },
        { konto: "3000", debet: 1000, kredit: 0, dato: "2026-03-20" },
        { konto: "6300", debet: 4000, kredit: 0, dato: "2026-03-01" },
        { konto: "8150", debet: 500, kredit: 0, dato: "2026-03-01" },
        { konto: "3000", debet: 0, kredit: 99, dato: "2025-03-01" },
      ],
      2026,
    );
    expect(m).toHaveLength(12);
    expect(m[2]).toEqual({ maaned: "mar", inntekt: 9000, kostnad: 4000, resultat: 5000 });
    expect(m[0]).toEqual({ maaned: "jan", inntekt: 0, kostnad: 0, resultat: 0 });
  });
});
