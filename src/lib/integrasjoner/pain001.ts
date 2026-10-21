import { gyldigKontonummer } from "../format";
import type { Valideringsfeil } from "./adapter";
import { xmlEsc } from "./ehf";

/**
 * ISO 20022 pain.001.001.03 (Customer Credit Transfer Initiation) for norske kroner.
 *
 * Bankene har små forskjeller i hva de krever. Filen er bygget etter det
 * alminnelige norske bankoppsettet (innenlandske overføringer, KID som strukturert
 * kreditorreferanse), men må testes mot den aktuelle banken før bruk i drift.
 */

export type Betaling = {
  /** Unik ende-til-ende-id, maks 35 tegn. */
  id: string;
  mottakerNavn: string;
  mottakerKonto: string;
  belop: number;
  kid?: string | null;
  melding?: string | null;
};

export type Betalingsfil = {
  meldingsId: string;
  opprettet: Date;
  utforelsesdato: string;
  betalerNavn: string;
  betalerOrgNr: string;
  betalerKonto: string;
  betalinger: Betaling[];
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const f2 = (n: number) => r2(n).toFixed(2);
const maks = (s: string, n: number) => s.slice(0, n);
const kontoRen = (s: string) => s.replace(/[\s.]/g, "");

export function validerBetalingsfil(f: Betalingsfil): Valideringsfeil[] {
  const ut: Valideringsfeil[] = [];
  const feil = (felt: string, melding: string) => ut.push({ felt, melding, alvor: "feil" });
  if (!f.betalinger.length) feil("betalinger", "Betalingsfilen har ingen betalinger.");
  if (!gyldigKontonummer(f.betalerKonto)) feil("betalerKonto", "Belastningskonto er ugyldig.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.utforelsesdato))
    feil("utforelsesdato", "Utførelsesdato må være YYYY-MM-DD.");
  const ider = new Set<string>();
  f.betalinger.forEach((b, i) => {
    const felt = `betalinger[${i}]`;
    if (!gyldigKontonummer(b.mottakerKonto)) feil(felt, `${b.mottakerNavn}: ugyldig kontonummer.`);
    if (!(b.belop > 0)) feil(felt, `${b.mottakerNavn}: beløpet må være større enn null.`);
    if (!b.mottakerNavn.trim()) feil(felt, "Mottaker mangler navn.");
    if (b.kid && !/^\d{2,25}$/.test(b.kid))
      feil(felt, `${b.mottakerNavn}: KID må være 2–25 siffer.`);
    if (b.id.length > 35) feil(felt, "Ende-til-ende-id kan ikke være lengre enn 35 tegn.");
    if (ider.has(b.id)) feil(felt, `Duplikat betalings-id ${b.id}.`);
    ider.add(b.id);
  });
  return ut;
}

export function byggPain001(f: Betalingsfil): string {
  const sum = r2(f.betalinger.reduce((s, b) => s + b.belop, 0));
  const n = f.betalinger.length;
  const tid = f.opprettet.toISOString().replace(/\.\d{3}Z$/, "");

  const transaksjoner = f.betalinger
    .map((b) => {
      const ref = b.kid
        ? `<RmtInf><Strd><CdtrRefInf><Tp><CdOrPrtry><Cd>SCOR</Cd></CdOrPrtry><Issr>KID</Issr></Tp><Ref>${xmlEsc(b.kid)}</Ref></CdtrRefInf></Strd></RmtInf>`
        : b.melding
          ? `<RmtInf><Ustrd>${xmlEsc(maks(b.melding, 140))}</Ustrd></RmtInf>`
          : "";
      return `<CdtTrfTxInf>
        <PmtId><InstrId>${xmlEsc(maks(b.id, 35))}</InstrId><EndToEndId>${xmlEsc(maks(b.id, 35))}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="NOK">${f2(b.belop)}</InstdAmt></Amt>
        <Cdtr><Nm>${xmlEsc(maks(b.mottakerNavn, 70))}</Nm></Cdtr>
        <CdtrAcct><Id><Othr><Id>${xmlEsc(kontoRen(b.mottakerKonto))}</Id></Othr></Id></CdtrAcct>
        ${ref}
      </CdtTrfTxInf>`;
    })
    .join("\n      ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${xmlEsc(maks(f.meldingsId, 35))}</MsgId>
      <CreDtTm>${tid}</CreDtTm>
      <NbOfTxs>${n}</NbOfTxs>
      <CtrlSum>${f2(sum)}</CtrlSum>
      <InitgPty>
        <Nm>${xmlEsc(maks(f.betalerNavn, 70))}</Nm>
        <Id><OrgId><Othr><Id>${xmlEsc(f.betalerOrgNr.replace(/\s/g, ""))}</Id></Othr></OrgId></Id>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${xmlEsc(maks(f.meldingsId, 35))}-1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>false</BtchBookg>
      <NbOfTxs>${n}</NbOfTxs>
      <CtrlSum>${f2(sum)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>NORM</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${xmlEsc(f.utforelsesdato)}</ReqdExctnDt>
      <Dbtr><Nm>${xmlEsc(maks(f.betalerNavn, 70))}</Nm><PstlAdr><Ctry>NO</Ctry></PstlAdr></Dbtr>
      <DbtrAcct><Id><Othr><Id>${xmlEsc(kontoRen(f.betalerKonto))}</Id></Othr></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      ${transaksjoner}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`;
}
