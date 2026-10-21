const nokFmt = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function kr(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return nokFmt.format(Math.round(v * 100) / 100);
}

export function dato(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
}

export function idag(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Validerer norsk organisasjonsnummer (mod11, vekter 3,2,7,6,5,4,3,2). */
export function gyldigOrgNr(org: string): boolean {
  const s = org.replace(/\s/g, "");
  if (!/^\d{9}$/.test(s)) return false;
  const w = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = w.reduce((acc, wi, i) => acc + wi * Number(s[i]), 0);
  const r = 11 - (sum % 11);
  const k = r === 11 ? 0 : r;
  if (k === 10) return false;
  return k === Number(s[8]);
}

/** KID med mod10 (Luhn) kontrollsiffer. */
export function kidMod10(base: string): string {
  let sum = 0;
  let dbl = true;
  for (let i = base.length - 1; i >= 0; i--) {
    let d = Number(base[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return base + ((10 - (sum % 10)) % 10);
}

export function formatOrgNr(org: string | null | undefined) {
  if (!org) return "";
  const s = org.replace(/\s/g, "");
  return s.length === 9 ? `${s.slice(0, 3)} ${s.slice(3, 6)} ${s.slice(6)}` : org;
}

/** Validerer norsk kontonummer (11 siffer, mod11 med vekter 5,4,3,2,7,6,5,4,3,2). */
export function gyldigKontonummer(konto: string): boolean {
  const s = konto.replace(/[\s.]/g, "");
  if (!/^\d{11}$/.test(s)) return false;
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = w.reduce((acc, wi, i) => acc + wi * Number(s[i]), 0);
  const r = 11 - (sum % 11);
  const k = r === 11 ? 0 : r;
  if (k === 10) return false;
  return k === Number(s[10]);
}
