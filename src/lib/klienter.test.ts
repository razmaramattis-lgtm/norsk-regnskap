import { describe, expect, it } from "vitest";
import { maanedsavslutning, sorterKlienter, vurderKlient, type OversiktRad } from "./klienter";

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
const as = { company_type: "as", mva_registrert: true, mva_termin: "tomaaned", laast_til: null };

describe("vurderKlient", () => {
  it("rolig klient uten avvik og med frist langt frem er ok", () => {
    const v = vurderKlient({ ...as, mva_registrert: false }, rad(), "2026-10-21");
    expect(v.nivaa).toBe("ok");
    expect(v.punkter).toEqual([]);
  });

  it("nær frist teller tungt", () => {
    // MVA 5. termin 2026 har frist 10. desember; 5. desember er 5 dager før
    const v = vurderKlient(as, rad(), "2026-12-05");
    expect(v.nesteFrist?.tittel).toMatch(/MVA/);
    expect(v.dagerTilFrist).toBe(5);
    expect(v.punkter[0]?.vekt).toBe(3);
  });

  it("mange avvik gir haster, og forfalt leverandørgjeld teller mer enn forfalte kundefakturaer", () => {
    const v = vurderKlient(
      as,
      rad({ ubehandlede_banktransaksjoner: 30, bilagsutkast: 2, forfalte_leverandorfakturaer: 1 }),
      "2026-10-21",
    );
    expect(v.nivaa).toBe("haster");
    expect(v.poeng).toBeGreaterThanOrEqual(5);
    const k = vurderKlient(as, rad({ forfalte_kundefakturaer: 1 }), "2026-10-21");
    const l = vurderKlient(as, rad({ forfalte_leverandorfakturaer: 1 }), "2026-10-21");
    expect(l.poeng).toBeGreaterThan(k.poeng);
  });

  it("flagger klient som ikke er bokført på lenge", () => {
    const v = vurderKlient(
      { ...as, mva_registrert: false },
      rad({ siste_bokforte_bilagsdato: "2026-08-01" }),
      "2026-10-21",
    );
    expect(v.dagerSidenBokfort).toBe(81);
    expect(v.punkter.some((p) => /Ikke bokført/.test(p.tekst))).toBe(true);
  });

  it("entall og flertall på norsk", () => {
    const v = vurderKlient(
      { ...as, mva_registrert: false },
      rad({ bilagsutkast: 1, ubehandlede_banktransaksjoner: 1 }),
      "2026-10-21",
    );
    expect(v.punkter.map((p) => p.tekst)).toEqual(["1 uavstemt banktransaksjon", "1 bilagsutkast"]);
  });
});

describe("sorterKlienter", () => {
  it("mest hastende først, så nærmeste frist, så navn", () => {
    const a = { navn: "B AS", vurdering: vurderKlient(as, rad({ bilagsutkast: 1 }), "2026-10-21") };
    const b = {
      navn: "A AS",
      vurdering: vurderKlient(
        as,
        rad({ ubehandlede_banktransaksjoner: 30, bilagsutkast: 3 }),
        "2026-10-21",
      ),
    };
    const c = { navn: "C AS", vurdering: vurderKlient(as, rad({ bilagsutkast: 1 }), "2026-10-21") };
    expect(sorterKlienter([a, c, b]).map((x) => x.navn)).toEqual(["A AS", "B AS", "C AS"]);
  });
});

describe("maanedsavslutning", () => {
  it("alt ok gir automatiske punkter ok, og manuelle punkter må krysses av", () => {
    const p = maanedsavslutning(as, rad(), "2026-10-31");
    expect(
      p
        .filter((x) => ["bank", "utkast", "forslag", "levfakt", "kundefakt"].includes(x.id))
        .every((x) => x.status === "ok"),
    ).toBe(true);
    expect(p.find((x) => x.id === "kontoutskrift")?.status).toBe("manuell");
  });

  it("avvik gir advarsel med lenke", () => {
    const p = maanedsavslutning(as, rad({ ubehandlede_banktransaksjoner: 3 }), "2026-10-31");
    const bank = p.find((x) => x.id === "bank")!;
    expect(bank.status).toBe("advarsel");
    expect(bank.detalj).toBe("3 transaksjoner mangler avstemming.");
    expect(bank.lenke).toBe("/app/bank");
  });

  it("MVA-punkt vises bare når terminen slutter i måneden; lønn bare med ansatte", () => {
    const okt = maanedsavslutning(as, rad(), "2026-10-31");
    expect(okt.some((x) => x.id === "mva")).toBe(true); // 5. termin slutter oktober
    const sep = maanedsavslutning(as, rad(), "2026-09-30");
    expect(sep.some((x) => x.id === "mva")).toBe(false);
    expect(okt.some((x) => x.id === "lonn")).toBe(false);
    expect(
      maanedsavslutning(as, rad({ har_ansatte: true }), "2026-10-31").some((x) => x.id === "lonn"),
    ).toBe(true);
  });

  it("låst periode vises som ok", () => {
    const p = maanedsavslutning({ ...as, laast_til: "2026-10-31" }, rad(), "2026-10-31");
    expect(p.find((x) => x.id === "last")?.status).toBe("ok");
  });
});
