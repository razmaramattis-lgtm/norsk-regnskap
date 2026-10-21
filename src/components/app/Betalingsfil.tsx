import { useState } from "react";
import { Download } from "lucide-react";
import type { Company } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusPill } from "@/components/app/ui";
import { idag, kr } from "@/lib/format";
import { byggPain001, validerBetalingsfil, type Betalingsfil } from "@/lib/integrasjoner/pain001";
import { filnavn, lastNed } from "@/lib/nedlasting";

export type BetalbarFaktura = {
  id: string;
  fakturanr: string | null;
  kid: string | null;
  total: number | string;
  forfallsdato: string;
  suppliers: { navn: string; kontonummer: string | null } | null;
};

/** Lager en ISO 20022-betalingsfil (pain.001) som lastes opp i nettbanken. Registrerer ikke betalingen; den bokføres ved bankavstemming. */
export function BetalingsfilDialog({
  fakturaer,
  company,
  onClose,
}: {
  fakturaer: BetalbarFaktura[];
  company: Company;
  onClose: () => void;
}) {
  const [betalingsdato, setBetalingsdato] = useState(idag());
  const [konto, setKonto] = useState(company.kontonummer ?? "");

  const fil: Betalingsfil = {
    meldingsId: `FB-${betalingsdato.replace(/-/g, "")}-${fakturaer.length}`,
    opprettet: new Date(),
    utforelsesdato: betalingsdato,
    betalerNavn: company.name,
    betalerOrgNr: company.org_nr ?? "",
    betalerKonto: konto,
    betalinger: fakturaer.map((f) => ({
      id: `INV-${f.id.slice(0, 8)}`,
      mottakerNavn: f.suppliers?.navn ?? "",
      mottakerKonto: f.suppliers?.kontonummer ?? "",
      belop: Number(f.total),
      kid: f.kid && /^\d{2,25}$/.test(f.kid) ? f.kid : null,
      melding: f.kid && /^\d{2,25}$/.test(f.kid) ? null : `Faktura ${f.fakturanr ?? ""}`.trim(),
    })),
  };
  const funn = validerBetalingsfil(fil);
  const sum = fakturaer.reduce((s, f) => s + Number(f.total), 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Betalingsfil (pain.001)</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Betalingsdato</Label>
            <Input
              type="date"
              value={betalingsdato}
              min={idag()}
              onChange={(e) => setBetalingsdato(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Belastningskonto</Label>
            <Input
              value={konto}
              onChange={(e) => setKonto(e.target.value)}
              placeholder="11 siffer"
              className="font-mono"
            />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Mottaker</th>
              <th className="py-2">Konto</th>
              <th className="py-2">KID / melding</th>
              <th className="py-2 text-right">Beløp</th>
            </tr>
          </thead>
          <tbody>
            {fil.betalinger.map((b) => (
              <tr key={b.id} className="border-b last:border-0">
                <td className="py-2">{b.mottakerNavn}</td>
                <td className="py-2 font-mono text-xs">{b.mottakerKonto || "–"}</td>
                <td className="py-2 font-mono text-xs">{b.kid ?? b.melding}</td>
                <td className="num py-2">{kr(b.belop)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td colSpan={3} className="py-2">
                Sum ({fil.betalinger.length})
              </td>
              <td className="num py-2">{kr(sum)}</td>
            </tr>
          </tfoot>
        </table>
        {funn.length > 0 ? (
          <ul className="space-y-1 text-sm text-destructive">
            {funn.map((f, i) => (
              <li key={i}>• {f.melding}</li>
            ))}
          </ul>
        ) : (
          <StatusPill tone="ok">Filen er klar</StatusPill>
        )}
        <p className="text-xs text-muted-foreground">
          Filen betaler ingenting før du laster den opp i nettbanken og godkjenner der. Fakturaene
          markeres som betalt først når betalingen avstemmes mot banken. Kontroller formatet mot
          bankens veiledning før første bruk.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Lukk
          </Button>
          <Button
            disabled={funn.length > 0}
            onClick={() => lastNed(`${filnavn(`betaling-${betalingsdato}`)}.xml`, byggPain001(fil))}
          >
            <Download /> Last ned fil
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
