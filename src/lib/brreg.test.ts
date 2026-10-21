import { describe, expect, it } from "vitest";
import { BrregFeil, hentEnhet, tolkEnhet } from "./brreg";

const eksempel = {
  organisasjonsnummer: "923609016",
  navn: "EKSEMPEL AS",
  organisasjonsform: { kode: "AS", beskrivelse: "Aksjeselskap" },
  registrertIMvaregisteret: true,
  forretningsadresse: {
    land: "Norge",
    landkode: "NO",
    postnummer: "0150",
    poststed: "OSLO",
    adresse: ["Storgata 1", "c/o Test"],
    kommune: "OSLO",
  },
};

describe("Enhetsregisteret", () => {
  it("tolker en typisk respons", () => {
    expect(tolkEnhet(eksempel)).toEqual({
      orgNr: "923609016",
      navn: "EKSEMPEL AS",
      adresse: "Storgata 1, c/o Test",
      postnr: "0150",
      poststed: "OSLO",
      land: "NO",
      organisasjonsform: "AS",
      mvaRegistrert: true,
      slettet: false,
      konkurs: false,
      underAvvikling: false,
    });
  });

  it("tåler manglende felt og feil typer", () => {
    expect(tolkEnhet(null)).toBeNull();
    expect(tolkEnhet({})).toBeNull();
    const t = tolkEnhet({
      organisasjonsnummer: "923609016",
      navn: 5,
      forretningsadresse: { adresse: "ikke liste" },
    })!;
    expect(t.navn).toBe("");
    expect(t.adresse).toBe("");
    expect(t.mvaRegistrert).toBeNull();
    expect(t.land).toBe("NO");
  });

  it("flagger slettede enheter og konkurs", () => {
    const t = tolkEnhet({ ...eksempel, slettedato: "2024-01-01", konkurs: true })!;
    expect(t.slettet).toBe(true);
    expect(t.konkurs).toBe(true);
  });

  it("bruker postadresse når forretningsadresse mangler", () => {
    const { forretningsadresse: _f, ...resten } = eksempel;
    const t = tolkEnhet({
      ...resten,
      postadresse: { postnummer: "5003", poststed: "BERGEN", adresse: ["Postboks 1"] },
    })!;
    expect(t.poststed).toBe("BERGEN");
  });

  it("hentEnhet: avviser ugyldig org.nr uten nettverkskall", async () => {
    let kalt = false;
    await expect(
      hentEnhet("123", (async () => {
        kalt = true;
        return new Response("{}");
      }) as typeof fetch),
    ).rejects.toBeInstanceOf(BrregFeil);
    expect(kalt).toBe(false);
  });

  it("hentEnhet: 404 gir null, 500 og nettverksfeil gir BrregFeil", async () => {
    const f = (status: number, body: unknown = {}) =>
      (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
    expect(await hentEnhet("923 609 016", f(404))).toBeNull();
    await expect(hentEnhet("923609016", f(500))).rejects.toThrow(/feil \(500\)/);
    await expect(
      hentEnhet("923609016", (async () => {
        throw new TypeError("nett");
      }) as typeof fetch),
    ).rejects.toThrow(/Kunne ikke nå/);
    expect((await hentEnhet("923609016", f(200, eksempel)))?.navn).toBe("EKSEMPEL AS");
  });
});
