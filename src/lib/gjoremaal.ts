import { kr } from "./format";
import { dagerTil, kommendeFrister } from "./frister";
import { fristValgFor, type KlientFirma, type OversiktRad } from "./klienter";

export type GjoremaalTone = "bad" | "warn" | "info";

export type Gjoremaal = {
  id: string;
  tittel: string;
  detalj?: string;
  tone: GjoremaalTone;
  lenke: string;
};

const flertall = (n: number, ett: string, flere: string) => `${n} ${n === 1 ? ett : flere}`;

const RANG: Record<GjoremaalTone, number> = { bad: 0, warn: 1, info: 2 };

/**
 * Lager «Til behandling» for ett firma fra `byraa_oversikt()`, med det som haster øverst.
 * Lista er tom når alt er à jour, slik at oversikten kan si det rett ut.
 */
export function lagGjoremaal(firma: KlientFirma, r: OversiktRad, idag: string): Gjoremaal[] {
  const ut: Gjoremaal[] = [];

  const frist = kommendeFrister(idag, fristValgFor(firma, r.har_ansatte), 1)[0];
  if (frist) {
    const d = dagerTil(idag, frist.dato);
    if (d <= 14)
      ut.push({
        id: "frist",
        tittel: frist.tittel,
        detalj: d === 0 ? "Frist i dag" : d === 1 ? "Frist i morgen" : `Frist om ${d} dager`,
        tone: d <= 7 ? "bad" : "warn",
        lenke: "/app/frister",
      });
  }
  if (r.forfalte_kundefakturaer > 0)
    ut.push({
      id: "kunde",
      tittel: flertall(
        r.forfalte_kundefakturaer,
        "forfalt kundefaktura",
        "forfalte kundefakturaer",
      ),
      detalj: `${kr(r.forfalt_kundebelop)} kr å purre`,
      tone: "bad",
      lenke: "/app/reskontro",
    });
  if (r.forfalte_leverandorfakturaer > 0)
    ut.push({
      id: "leverandor",
      tittel: flertall(r.forfalte_leverandorfakturaer, "forfalt regning", "forfalte regninger"),
      detalj: `${kr(r.forfalt_leverandorbelop)} kr å betale`,
      tone: "bad",
      lenke: "/app/leverandorfakturaer",
    });
  if (r.ventende_forslag > 0)
    ut.push({
      id: "forslag",
      tittel: `${r.ventende_forslag} forslag venter på godkjenning`,
      detalj: "Kontert automatisk, du godkjenner",
      tone: "warn",
      lenke: "/app/forslag",
    });
  if (r.ubehandlede_banktransaksjoner > 0)
    ut.push({
      id: "bank",
      tittel: `${flertall(r.ubehandlede_banktransaksjoner, "banktransaksjon", "banktransaksjoner")} å avstemme`,
      tone: "warn",
      lenke: "/app/bank",
    });
  if (r.bilagsutkast > 0)
    ut.push({
      id: "utkast",
      tittel: `${r.bilagsutkast} bilagsutkast er ikke bokført`,
      tone: "info",
      lenke: "/app/bilag",
    });

  return ut.sort((a, b) => RANG[a.tone] - RANG[b.tone]);
}
