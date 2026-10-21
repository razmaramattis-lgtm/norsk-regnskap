export type BankRad = { dato: string; tekst: string; belop: number; referanse?: string | undefined };

function parseTall(s: string): number {
  const t = s.replace(/\s|\u00a0/g, "").replace(/kr/i, "");
  if (!t) return 0;
  // 1.234,56 eller 1234,56 eller 1234.56
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  return Number(t);
}

function parseDato(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) {
    const y = m[3]!.length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function split(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Leser kontoutskrift (CSV) fra norske banker: DNB, Sparebank 1, Nordea m.fl.
 * Gjenkjenner kolonner for dato, tekst/forklaring og enten ett beløp eller «Ut»/«Inn».
 */
export function parseBankCsv(innhold: string): BankRad[] {
  const linjer = innhold.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (linjer.length < 2) return [];
  const sep = (linjer[0]!.match(/;/g)?.length ?? 0) >= (linjer[0]!.match(/,/g)?.length ?? 0) ? ";" : ",";
  const hode = split(linjer[0]!, sep).map((h) => h.toLowerCase());
  const finn = (...navn: string[]) => hode.findIndex((h) => navn.some((n) => h.includes(n)));
  const iDato = finn("bokført", "dato", "date");
  const iTekst = finn("forklaring", "tekst", "beskrivelse", "description", "mottaker");
  const iUt = finn("ut fra", "ut", "uttak", "belastet");
  const iInn = finn("inn på", "inn", "innskudd", "godskrevet");
  const iBelop = finn("beløp", "belop", "amount");
  const iRef = finn("arkivref", "referanse", "kid");
  const rader: BankRad[] = [];
  for (const l of linjer.slice(1)) {
    const c = split(l, sep);
    const dato = parseDato(c[iDato] ?? "");
    if (!dato) continue;
    let belop = 0;
    if (iBelop >= 0 && iUt < 0) belop = parseTall(c[iBelop] ?? "");
    else {
      const ut = Math.abs(parseTall(iUt >= 0 ? (c[iUt] ?? "") : ""));
      const inn = Math.abs(parseTall(iInn >= 0 ? (c[iInn] ?? "") : ""));
      belop = inn - ut;
      if (!ut && !inn && iBelop >= 0) belop = parseTall(c[iBelop] ?? "");
    }
    if (!belop || Number.isNaN(belop)) continue;
    rader.push({ dato, tekst: c[iTekst] ?? "", belop: Math.round(belop * 100) / 100, referanse: iRef >= 0 ? c[iRef] : undefined });
  }
  return rader;
}

export function radHash(r: BankRad, konto: string): string {
  return [konto, r.dato, r.belop.toFixed(2), r.tekst, r.referanse ?? ""].join("|");
}
