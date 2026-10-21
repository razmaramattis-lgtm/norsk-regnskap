import { describe, expect, it } from "vitest";
import { komIGang, lagGjoremaal } from "./gjoremaal";
import type { OversiktRad } from "./klienter";

const rad = (o: Partial<OversiktRad> = {}): OversiktRad => ({
  company_id: "c1",
  ubehandlede_banktransaksjoner: 0,
  bilagsutkast: 0,
  ventende_forslag: 0,
  forfalte_kundefakturaer: 0,
  forfalt_kundebelop: 0,
  forfalte_leverandorfakturaer: 0,
  forfalt_leverandorbelop: 0,
  har_ansatte: false,
  siste_bilagsdato: "2026-10-15",
  siste_bokforte_bilagsdato: "2026-10-15",
  ...o,
});
const enk = { company_type: "enk", mva_registrert: false, mva_termin: "tomaaned" };
const as = { company_type: "as", mva_registrert: true, mva_termin: "tomaaned" };

describe("lagGjoremaal", () => {
  it("er tom når alt er à jour og ingen frist er nær", () => {
    expect(lagGjoremaal(enk, rad(), "2026-10-21")).toEqual([]);
  });

  it("tar med nær frist og sorterer det som haster først", () => {
    // MVA 5. termin har frist 10. desember
    const g = lagGjoremaal(
      as,
      rad({
        bilagsutkast: 2,
        ventende_forslag: 1,
        forfalte_kundefakturaer: 1,
        forfalt_kundebelop: 1250,
      }),
      "2026-12-05",
    );
    expect(g.map((x) => x.id)).toEqual(["frist", "kunde", "forslag", "utkast"]);
    expect(g[0]!.detalj).toBe("Frist om 5 dager");
    expect(g[1]!.tittel).toBe("1 forfalt kundefaktura");
  });

  it("bruker flertall og lenker til riktig side", () => {
    const g = lagGjoremaal(enk, rad({ ubehandlede_banktransaksjoner: 4 }), "2026-10-21");
    expect(g).toEqual([
      { id: "bank", tittel: "4 banktransaksjoner å avstemme", tone: "warn", lenke: "/app/bank" },
    ]);
  });
});

describe("komIGang", () => {
  it("markerer ferdige steg", () => {
    const s = komIGang({ org_nr: "923609016", kontonummer: null }, { harBokfort: false, harBank: true, harFaktura: false });
    expect(s.map((x) => [x.id, x.ferdig])).toEqual([["firma", false], ["import", false], ["bank", true], ["faktura", false]]);
  });
});
