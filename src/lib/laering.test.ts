import { describe, expect, it } from "vitest";
import { foreslaaForBanktransaksjon, STANDARDREGLER } from "./kontoforslag";
import { laerRegler, motpart, type Historikk } from "./laering";

const kjøp = (tekst: string, konto: string, kode: string | null = "1"): Historikk => ({
  tekst,
  belop: -125,
  linjer: [
    { konto, debet: 100, kredit: 0, mva_kode: kode },
    { konto: "2710", debet: 25, kredit: 0, mva_kode: kode },
    { konto: "1920", debet: 0, kredit: 125, mva_kode: null },
  ],
});

describe("motpart", () => {
  it("hopper over betalingsord og tall", () => {
    expect(motpart("VAREKJØP 12.10 Biltema Lillestrøm NOK 499")).toEqual(["biltema", "lillestrøm"]);
    expect(motpart("Visa 1234")).toBeNull();
  });
});

describe("laerRegler", () => {
  it("lager regel når samme motpart er ført på samme konto to ganger", () => {
    const r = laerRegler([
      kjøp("Varekjøp Biltema Lillestrøm", "6560"),
      kjøp("Varekjøp Biltema Lillestrøm", "6560"),
    ]);
    expect(r).toEqual([
      {
        id: "laert:ut:biltema lillestrøm",
        navn: "Som før (2 ganger)",
        moenstre: [["biltema", "lillestrøm"]],
        konto: "6560",
        mvaSats: 25,
        retning: "ut",
        sikkerhet: 0.9,
      },
    ]);
  });

  it("lærer ikke av én gang eller når kontoene spriker", () => {
    expect(laerRegler([kjøp("Biltema Oslo", "6560")])).toEqual([]);
    expect(laerRegler([kjøp("Biltema Oslo", "6560"), kjøp("Biltema Oslo", "6800")])).toEqual([]);
  });

  it("slår standardreglene og gir balansert forslag", () => {
    const lært = laerRegler([
      kjøp("Telenor bedrift", "6900"),
      kjøp("Telenor bedrift", "6900"),
      kjøp("Telenor bedrift", "6900"),
    ]);
    const f = foreslaaForBanktransaksjon(
      { dato: "2026-10-20", tekst: "Telenor bedrift", belop: -250 },
      true,
      [...lært, ...STANDARDREGLER],
    )!;
    expect(f.regelId).toBe("laert:ut:telenor bedrift");
    expect(f.payload.linjer[0]).toMatchObject({ konto: "6900", debet: 200 });
  });
});
