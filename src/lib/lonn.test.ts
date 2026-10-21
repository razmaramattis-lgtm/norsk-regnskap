import { describe, expect, it } from "vitest";
import {
  G,
  ameldingSummer,
  beregnAnsatt,
  over60IFerieaaret,
  postBelop,
  type AnsattInput,
} from "./lonn";

const basis: AnsattInput = {
  poster: [],
  trekkmetode: "prosent",
  skattetrekkProsent: 30,
  tabelltrekk: 0,
  halvtTrekk: false,
  feriepengesats: 10.2,
  over60: false,
  otpProsent: 2,
  agaSats: 14.1,
};
const post = (lonnsart: string, belop: number) => ({ lonnsart, antall: 0, sats: 0, belop });

describe("beregnAnsatt", () => {
  it("fastlønn: trekk, feriepenger, OTP mellom 1 G og 12 G og AGA", () => {
    const r = beregnAnsatt({ ...basis, poster: [post("fastlonn", 50000)] });
    expect(r.skattetrekk).toBe(15000);
    expect(r.feriepenger).toBe(5100);
    expect(r.otp).toBe(Math.round((50000 - G / 12) * 2) / 100);
    expect(r.aga).toBe(Math.round((50000 + 5100 + r.otp) * 14.1) / 100);
    expect(r.netto).toBe(35000);
  });

  it("OTP stopper ved 12 G", () => {
    const r = beregnAnsatt({ ...basis, poster: [post("fastlonn", 500000)] });
    expect(r.otp).toBe(Math.round((G - G / 12) * 2) / 100);
  });

  it("naturalytelse gir trekk og AGA, men ikke utbetaling eller feriepenger", () => {
    const r = beregnAnsatt({ ...basis, poster: [post("fastlonn", 40000), post("telefon", 433)] });
    expect(r.skattetrekk).toBe(Math.floor(40433 * 0.3));
    expect(r.feriepenger).toBe(4080);
    expect(r.netto).toBe(40000 - r.skattetrekk);
    expect(r.agaGrunnlag).toBe(r2(40433 + 4080 + r.otp));
  });

  it("trekkfrie godtgjørelser utbetales uten trekk, trekk i lønn går av netto", () => {
    const r = beregnAnsatt({
      ...basis,
      poster: [post("fastlonn", 40000), post("km", 1250), post("fagforening", 450)],
    });
    expect(r.skattetrekk).toBe(12000);
    expect(r.netto).toBe(40000 - 12000 - 450 + 1250);
    expect(r.agaGrunnlag).toBe(r2(40000 + 4080 + r.otp));
  });

  it("tabelltrekk og halvt trekk", () => {
    expect(
      beregnAnsatt({
        ...basis,
        trekkmetode: "tabell",
        tabelltrekk: 9871,
        poster: [post("fastlonn", 40000)],
      }).skattetrekk,
    ).toBe(9871);
    expect(
      beregnAnsatt({
        ...basis,
        trekkmetode: "tabell",
        tabelltrekk: 9871,
        halvtTrekk: true,
        poster: [post("fastlonn", 40000)],
      }).skattetrekk,
    ).toBe(4935);
  });

  it("60+ får 2,3 prosentpoeng ekstra feriepenger", () => {
    expect(
      beregnAnsatt({ ...basis, over60: true, poster: [post("fastlonn", 40000)] }).feriepenger,
    ).toBe(4080 + 920);
  });
});

const r2 = (n: number) => Math.round(n * 100) / 100;

describe("hjelpere", () => {
  it("overtid regnes av timelønn", () => {
    expect(postBelop({ lonnsart: "overtid50", antall: 4, belop: 0 }, 300)).toBe(1800);
    expect(postBelop({ lonnsart: "bonus", antall: 0, belop: 5000 }, 300)).toBe(5000);
  });

  it("60 år før 1. september i ferieåret", () => {
    expect(over60IFerieaaret("1967-08-31", 2026)).toBe(true);
    expect(over60IFerieaaret("1967-09-01", 2026)).toBe(false);
    expect(over60IFerieaaret(null, 2026)).toBe(false);
  });

  it("a-meldingssummer per beskrivelse", () => {
    expect(
      ameldingSummer([post("overtid50", 100), post("overtid100", 200), post("kantine", 50)]),
    ).toEqual([{ beskrivelse: "overtidsgodtgjoerelse", navn: "Overtid 50 %", belop: 300 }]);
  });
});
