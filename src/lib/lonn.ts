/** Arbeidsgiveravgift-satser per sone (2026). */
export const AGA_SONER: Record<string, { navn: string; sats: number }> = {
  "1": { navn: "Sone 1", sats: 14.1 },
  "1a": { navn: "Sone 1a", sats: 10.6 },
  "2": { navn: "Sone 2", sats: 10.6 },
  "3": { navn: "Sone 3", sats: 6.4 },
  "4": { navn: "Sone 4", sats: 5.1 },
  "4a": { navn: "Sone 4a", sats: 7.9 },
  "5": { navn: "Sone 5 (Finnmark og Nord-Troms)", sats: 0 },
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export type LonnInput = {
  brutto: number;
  tillegg: number;
  skattetrekkProsent: number;
  feriepengesats: number;
  otpProsent: number;
  agaSats: number;
};

/**
 * Beregner én lønnslinje.
 * Feriepenger avsettes av feriepengegrunnlaget (brutto + tillegg).
 * Arbeidsgiveravgift beregnes av utbetalt lønn + avsatte feriepenger + OTP-premie.
 */
export function beregnLonn(i: LonnInput) {
  const grunnlag = r2(i.brutto + i.tillegg);
  const skattetrekk = Math.floor((grunnlag * i.skattetrekkProsent) / 100);
  const feriepenger = r2((grunnlag * i.feriepengesats) / 100);
  const otp = r2((grunnlag * i.otpProsent) / 100);
  const aga = r2(((grunnlag + feriepenger + otp) * i.agaSats) / 100);
  return { grunnlag, skattetrekk, feriepenger, otp, aga, netto: r2(grunnlag - skattetrekk) };
}
