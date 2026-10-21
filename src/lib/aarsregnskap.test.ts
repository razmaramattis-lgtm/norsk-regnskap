import { describe, expect, it } from "vitest";
import {
  byggBalanse,
  byggResultat,
  erSmaaForetak,
  saldoFraLinjer,
  sjekklisteAarsregnskap,
} from "./aarsregnskap";
import { beregnSelskapsskatt } from "./skatt";

// Et lite AS: 1 mill salg, kostnader, bank og aksjekapital.
const linjer = [
  { konto: "1920", debet: 1_030_000, kredit: 0 },
  { konto: "2000", debet: 0, kredit: 30_000 },
  { konto: "3000", debet: 0, kredit: 1_000_000 },
  { konto: "5000", debet: 400_000, kredit: 0 },
  { konto: "5400", debet: 56_400, kredit: 0 },
  { konto: "6300", debet: 120_000, kredit: 0 },
  { konto: "6800", debet: 20_000, kredit: 0 },
  { konto: "8040", debet: 0, kredit: 2_000 },
  { konto: "8140", debet: 5_000, kredit: 0 },
  { konto: "8300", debet: 90_000, kredit: 0 },
];
// Hele regnskapet må gå i null: legg til motposter via 1920 / gjeld så summen blir 0.
const medMotpost = (() => {
  const d = linjer.reduce((s, l) => s + l.debet, 0);
  const k = linjer.reduce((s, l) => s + l.kredit, 0);
  return [
    ...linjer,
    { konto: "2500", debet: 0, kredit: 90_000 },
    { konto: "2770", debet: 0, kredit: 56_400 },
    { konto: "2400", debet: 0, kredit: d - k - 90_000 - 56_400 },
  ];
})();

describe("resultatregnskap", () => {
  const s = saldoFraLinjer(medMotpost.filter((l) => Number(l.konto) >= 3000));
  const r = byggResultat(s);

  it("summerer driftsinntekter, kostnader og resultat", () => {
    expect(r.driftsinntekter).toBe(1_000_000);
    expect(r.driftskostnader).toBe(596_400);
    expect(r.driftsresultat).toBe(403_600);
    expect(r.finansresultat).toBe(-3_000);
    expect(r.resultatForSkatt).toBe(400_600);
    expect(r.skattekostnad).toBe(90_000);
    expect(r.aarsresultat).toBe(310_600);
  });

  it("legger kostnader under riktig gruppe", () => {
    const l = (id: string) => r.linjer.find((x) => x.id === id)!;
    expect(l("lonnskostnad").belop).toBe(456_400);
    expect(l("annen-driftskostnad").belop).toBe(140_000);
    expect(l("annen-driftskostnad").kontoer.map((k) => k.konto)).toEqual(["6300", "6800"]);
  });
});

describe("balanse", () => {
  const bal = saldoFraLinjer(medMotpost.filter((l) => Number(l.konto) < 3000));
  const udisponert = -Object.values(
    saldoFraLinjer(medMotpost.filter((l) => Number(l.konto) >= 3000)),
  ).reduce((a, b) => a + b, 0);

  it("går i null når udisponert resultat tas med", () => {
    const b = byggBalanse(bal, udisponert);
    expect(b.udisponertResultat).toBe(310_600);
    expect(b.gaarIOpp).toBe(true);
    expect(b.sumEiendeler).toBe(1_030_000);
    expect(b.sumOmlopsmidler).toBe(1_030_000);
    expect(b.sumAnleggsmidler).toBe(0);
  });

  it("avdekker avvik uten udisponert resultat", () => {
    const b = byggBalanse(bal, 0);
    expect(b.gaarIOpp).toBe(false);
    expect(b.avvik).toBe(310_600);
  });
});

describe("størrelse og sjekkliste", () => {
  it("små foretak krever to av tre vilkår", () => {
    expect(erSmaaForetak({ salgsinntekt: 10e6, balansesum: 5e6, arsverk: 5 })).toBe(true);
    expect(erSmaaForetak({ salgsinntekt: 100e6, balansesum: 5e6, arsverk: 5 })).toBe(true);
    expect(erSmaaForetak({ salgsinntekt: 100e6, balansesum: 40e6, arsverk: 5 })).toBe(false);
  });

  it("flagger feil og manuelle punkter, og viser AS-spesifikke krav", () => {
    const b = byggBalanse({ "1920": 100 }, 0);
    const s = sjekklisteAarsregnskap({
      selskapstype: "as",
      balanse: b,
      aarAvsluttet: false,
      antallUtkastBilag: 2,
      periodeLaastTilAarsslutt: false,
      mvaAvstemt: null,
      bankAvstemt: null,
    });
    expect(s.find((x) => x.id === "balanse")?.status).toBe("feil");
    expect(s.find((x) => x.id === "utkast")?.status).toBe("advarsel");
    expect(s.find((x) => x.id === "mva")?.status).toBe("manuell");
    expect(s.some((x) => x.id === "beretning")).toBe(true);
    const enk = sjekklisteAarsregnskap({
      selskapstype: "enk",
      balanse: b,
      aarAvsluttet: true,
      antallUtkastBilag: 0,
      periodeLaastTilAarsslutt: true,
      mvaAvstemt: true,
      bankAvstemt: true,
    });
    expect(enk.some((x) => x.id === "beretning")).toBe(false);
  });
});

describe("selskapsskatt", () => {
  it("beregner 22 % av skattepliktig inntekt", () => {
    const r = beregnSelskapsskatt({ resultatForSkatt: 400_600, permanenteForskjeller: 10_000 });
    expect(r.skattepliktigInntekt).toBe(410_600);
    expect(r.betalbarSkatt).toBe(90_332);
  });

  it("bruker fremførbart underskudd og skaper nytt ved underskudd", () => {
    const a = beregnSelskapsskatt({ resultatForSkatt: 100_000, framfortUnderskudd: 60_000 });
    expect(a.skattepliktigInntekt).toBe(40_000);
    expect(a.betalbarSkatt).toBe(8_800);
    expect(a.nyttFramfortUnderskudd).toBe(0);
    const b = beregnSelskapsskatt({ resultatForSkatt: -50_000, framfortUnderskudd: 10_000 });
    expect(b.betalbarSkatt).toBe(0);
    expect(b.nyttFramfortUnderskudd).toBe(60_000);
  });
});
