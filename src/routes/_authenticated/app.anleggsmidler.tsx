import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, idag, kr } from "@/lib/format";
import {
  GRENSE_DIREKTE_KOSTNADSFORING,
  MIN_INNTEKTSFORING_PROSENT,
  SALDOGRUPPER,
  beregnSaldo,
  byggAvskrivningsbilag,
  byggMaanedsplan,
  kanKostnadsfores,
  sumSkattemessig,
  type Anleggsmiddel,
  type AvskrivningsLinje,
  type Saldogruppe,
} from "@/lib/anleggsmidler";
import {
  Empty,
  PageHeader,
  Panel,
  Stat,
  StatusPill,
  Th,
  selectCls,
  theadCls,
} from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/anleggsmidler")({
  head: () => ({ meta: [{ title: "Anleggsmidler – Fjordbok" }] }),
  component: Anleggsmidler,
});

type Rad = {
  id: string;
  navn: string;
  saldogruppe: string;
  anskaffet: string;
  anskaffelseskost: number | string;
  solgt: string | null;
  salgssum: number | string | null;
  konto: string | null;
};

const tilMiddel = (r: Rad): Anleggsmiddel => ({
  id: r.id,
  navn: r.navn,
  saldogruppe: r.saldogruppe as Saldogruppe,
  anskaffet: r.anskaffet,
  anskaffelseskost: Number(r.anskaffelseskost),
  solgt: r.solgt,
  salgssum: r.salgssum === null ? null : Number(r.salgssum),
});

function Anleggsmidler() {
  const { company, canWrite } = useCompany();
  const qc = useQueryClient();
  const nav = useNavigate();
  const aar = new Date().getFullYear();
  const [valgtAar, setAar] = useState(aar);
  const [inntekt, setInntekt] = useState(MIN_INNTEKTSFORING_PROSENT);
  const [visning, setVisning] = useState<"aar" | "maaned">("maaned");
  const { data: rader = [], isLoading } = useQuery({
    queryKey: ["anleggsmidler", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("anleggsmidler")
        .select("id, navn, saldogruppe, anskaffet, anskaffelseskost, solgt, salgssum, konto")
        .eq("company_id", company.id)
        .order("anskaffet", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Rad[];
    },
  });

  const saldo = beregnSaldo(rader.map(tilMiddel), valgtAar, inntekt);
  const sum = sumSkattemessig(saldo);
  const kontoOverstyring = new Map(
    rader.filter((r) => r.konto).map((r) => [r.id, r.konto as string]),
  );
  const kontoFor = (r: (typeof saldo)[number]) => {
    // Eget driftsmiddel (ikke felles saldo) kan ha egen konto.
    const id = r.nokkel.includes(":") ? r.nokkel.slice(r.nokkel.indexOf(":") + 1) : null;
    return (id && kontoOverstyring.get(id)) || SALDOGRUPPER[r.gruppe].konto;
  };
  const bilagslinjer = byggAvskrivningsbilag(saldo, kontoFor);
  const maanedsplan = byggMaanedsplan(saldo, valgtAar, kontoFor);

  async function lagBilag(linjer: AvskrivningsLinje[], datoStr: string, beskrivelse: string) {
    if (!linjer.length) return;
    const { data: v, error } = await supabase
      .from("vouchers")
      .insert({
        company_id: company.id,
        dato: datoStr,
        beskrivelse,
        kilde: "avskrivning",
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const { error: e2 } = await supabase.from("voucher_lines").insert(
      linjer.map((l, i) => ({
        voucher_id: v.id,
        company_id: company.id,
        konto: l.konto,
        tekst: l.tekst,
        debet: l.debet,
        kredit: l.kredit,
        linjenr: i,
      })),
    );
    if (e2) {
      await supabase.from("vouchers").delete().eq("id", v.id);
      toast.error(e2.message);
      return;
    }
    toast.success("Avskrivningsbilag opprettet som utkast. Kontroller og bokfør.");
    qc.invalidateQueries();
    nav({ to: "/app/bilag/$id", params: { id: v.id } });
  }

  async function slett(id: string) {
    const { error } = await supabase.from("anleggsmidler").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["anleggsmidler"] });
  }

  return (
    <>
      <PageHeader
        title="Anleggsmidler"
        sub="Register og skattemessig saldoavskrivning. Satsene er veiledende og må kontrolleres mot Skatteetaten for inntektsåret."
        actions={
          <>
            <div className="flex rounded-md border">
              {(["maaned", "aar"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisning(v)}
                  className={`px-3 py-1.5 text-sm ${visning === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {v === "maaned" ? "Månedlig" : "Årlig"}
                </button>
              ))}
            </div>
            <select
              className={selectCls}
              value={valgtAar}
              onChange={(e) => setAar(Number(e.target.value))}
              aria-label="Inntektsår"
            >
              {[aar - 2, aar - 1, aar, aar + 1].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={`Avskrivning ${valgtAar}`} value={kr(sum.avskrivning)} />
        <Stat label="Inntektsføring av negativ saldo" value={kr(sum.inntektsforing)} />
        <Stat label="Utgående saldo" value={kr(sum.ub)} />
      </div>

      <Panel className="mb-6">
        {isLoading ? (
          <Empty>Laster …</Empty>
        ) : saldo.length === 0 ? (
          <Empty>Ingen driftsmidler registrert for {valgtAar}. Legg til det første under.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadCls}>
                <tr>
                  <Th>Saldogruppe</Th>
                  <Th right>Sats</Th>
                  <Th right>Inngående</Th>
                  <Th right>Tilgang</Th>
                  <Th right>Avgang</Th>
                  <Th right>Avskrivning</Th>
                  <Th right>Inntektsført</Th>
                  <Th right>Utgående</Th>
                </tr>
              </thead>
              <tbody>
                {saldo.map((r) => (
                  <tr key={r.nokkel} className="border-b">
                    <td className="px-4 py-3">
                      {r.navn}
                      {r.kanKostnadsforeRest && (
                        <span className="ml-2">
                          <StatusPill tone="info">Restsaldo kan kostnadsføres</StatusPill>
                        </span>
                      )}
                    </td>
                    <td className="num px-4 py-3 text-right">{r.sats} %</td>
                    <td className="num px-4 py-3 text-right">{kr(r.ib)}</td>
                    <td className="num px-4 py-3 text-right">{kr(r.tilgang)}</td>
                    <td className="num px-4 py-3 text-right">{kr(r.avgang)}</td>
                    <td className="num px-4 py-3 text-right">{kr(r.avskrivning)}</td>
                    <td className="num px-4 py-3 text-right">{kr(r.inntektsforing)}</td>
                    <td className="num px-4 py-3 text-right">{kr(r.ub)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4 border-t px-4 py-3 text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            Inntektsføring av negativ saldo
            <select
              className={selectCls}
              value={inntekt}
              onChange={(e) => setInntekt(Number(e.target.value))}
            >
              <option value={20}>20 % (minimum)</option>
              <option value={50}>50 %</option>
              <option value={100}>100 %</option>
            </select>
          </label>
          <span className="ml-auto" />
          {canWrite && (
            <Button variant="outline" disabled={!bilagslinjer.length} onClick={lagBilag}>
              Opprett avskrivningsbilag
            </Button>
          )}
        </div>
      </Panel>

      {canWrite && (
        <NyttMiddel onLagret={() => qc.invalidateQueries({ queryKey: ["anleggsmidler"] })} />
      )}

      {rader.length > 0 && (
        <Panel className="mt-6">
          <div className="border-b px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Register
          </div>
          <ul className="divide-y text-sm">
            {rader.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3">
                <span className="min-w-0 flex-1 font-medium">{r.navn}</span>
                <span className="text-muted-foreground">Gruppe {r.saldogruppe.toUpperCase()}</span>
                <span className="text-muted-foreground">{dato(r.anskaffet)}</span>
                <span className="num">{kr(Number(r.anskaffelseskost))}</span>
                {r.solgt && (
                  <StatusPill tone="muted">
                    Solgt {dato(r.solgt)}
                    {r.salgssum !== null ? ` for ${kr(Number(r.salgssum))}` : ""}
                  </StatusPill>
                )}
                {canWrite && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Slett ${r.navn}`}
                    onClick={() => slett(r.id)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Driftsmidler under {kr(GRENSE_DIREKTE_KOSTNADSFORING)} (eller med brukstid under 3 år) kan
        kostnadsføres direkte og trenger ikke ligge i registeret. Hele året avskrives uansett
        anskaffelsesdato. Bygg og skip m.m. (gruppe e–j) har egen saldo per driftsmiddel. Bilaget
        bruker netto-metoden (kredit på anleggskontoen) og må tilpasses hvis dere avskriver
        regnskapsmessig på annen måte enn skattemessig.
      </p>
    </>
  );
}

function NyttMiddel({ onLagret }: { onLagret: () => void }) {
  const { company } = useCompany();
  const [navn, setNavn] = useState("");
  const [gruppe, setGruppe] = useState<Saldogruppe>("d");
  const [anskaffet, setAnskaffet] = useState(idag());
  const [kost, setKost] = useState("");
  const [solgt, setSolgt] = useState("");
  const [salgssum, setSalgssum] = useState("");
  const [busy, setBusy] = useState(false);

  async function lagre() {
    const k = Number(kost.replace(/\s/g, "").replace(",", "."));
    if (!navn.trim() || !(k > 0)) {
      toast.error("Fyll ut navn og anskaffelseskost.");
      return;
    }
    const s = salgssum.trim() === "" ? null : Number(salgssum.replace(/\s/g, "").replace(",", "."));
    if (solgt && s === null) {
      toast.error("Oppgi salgssum (0 ved utrangering).");
      return;
    }
    if (!solgt && s !== null) {
      toast.error("Oppgi salgsdato.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("anleggsmidler").insert({
      company_id: company.id,
      navn: navn.trim(),
      saldogruppe: gruppe,
      anskaffet,
      anskaffelseskost: k,
      solgt: solgt || null,
      salgssum: solgt ? s : null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (kanKostnadsfores(k))
      toast.info(
        "Beløpet er under grensen for direkte kostnadsføring. Vurder om det heller bør kostnadsføres.",
      );
    else toast.success("Driftsmiddel lagt til");
    setNavn("");
    setKost("");
    setSolgt("");
    setSalgssum("");
    onLagret();
  }

  return (
    <Panel className="p-5">
      <h2 className="mb-4 text-lg">Nytt driftsmiddel</h2>
      <div className="grid items-end gap-4 md:grid-cols-6">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="am-navn">Navn</Label>
          <Input
            id="am-navn"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            placeholder="F.eks. Skriver, bil, kontorbygg"
            maxLength={120}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="am-gruppe">Saldogruppe</Label>
          <select
            id="am-gruppe"
            className={`${selectCls} w-full`}
            value={gruppe}
            onChange={(e) => setGruppe(e.target.value as Saldogruppe)}
          >
            {(Object.keys(SALDOGRUPPER) as Saldogruppe[]).map((g) => (
              <option key={g} value={g}>
                {g.toUpperCase()} · {SALDOGRUPPER[g].navn} ({SALDOGRUPPER[g].sats} %)
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="am-dato">Anskaffet</Label>
          <Input
            id="am-dato"
            type="date"
            value={anskaffet}
            onChange={(e) => setAnskaffet(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="am-kost">Kostpris</Label>
          <Input
            id="am-kost"
            className="num"
            value={kost}
            onChange={(e) => setKost(e.target.value)}
            placeholder="0,00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="am-solgt">Solgt (valgfritt)</Label>
          <Input
            id="am-solgt"
            type="date"
            value={solgt}
            onChange={(e) => setSolgt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="am-sum">Salgssum</Label>
          <Input
            id="am-sum"
            className="num"
            value={salgssum}
            onChange={(e) => setSalgssum(e.target.value)}
            placeholder="0,00"
            disabled={!solgt}
          />
        </div>
        <Button onClick={lagre} disabled={busy}>
          Legg til
        </Button>
      </div>
    </Panel>
  );
}
