import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { kr, idag } from "@/lib/format";
import { MVA_KODER, INNGAENDE_KONTO, splittBrutto } from "@/lib/mva";
import { useAccounts, Panel } from "./ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type EditLinje = { konto: string; tekst: string; debet: string; kredit: string; mva_kode: string };

const tom = (): EditLinje => ({ konto: "", tekst: "", debet: "", kredit: "", mva_kode: "" });

export function BilagEditor({
  voucherId,
  initial,
}: {
  voucherId?: string;
  initial?: { dato: string; beskrivelse: string; linjer: EditLinje[] };
}) {
  const { company } = useCompany();
  const { data: kontoer = [] } = useAccounts();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [dato, setDato] = useState(initial?.dato ?? idag());
  const [beskr, setBeskr] = useState(initial?.beskrivelse ?? "");
  const [linjer, setLinjer] = useState<EditLinje[]>(initial?.linjer ?? [tom(), tom()]);
  const [busy, setBusy] = useState(false);

  // Hurtigutgift
  const [brutto, setBrutto] = useState("");
  const [kostKonto, setKostKonto] = useState("6800");
  const [sats, setSats] = useState(25);
  const [betaltFra, setBetaltFra] = useState("1920");

  const sumD = linjer.reduce((s, l) => s + Number(l.debet || 0), 0);
  const sumK = linjer.reduce((s, l) => s + Number(l.kredit || 0), 0);
  const balanse = Math.round((sumD - sumK) * 100) / 100;

  const set = (i: number, k: keyof EditLinje, v: string) =>
    setLinjer((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v, ...(k === "konto" ? { mva_kode: kontoer.find((a) => a.number === v)?.mva_kode ?? l.mva_kode } : {}) } : l)));

  function lagFraUtgift() {
    const b = Number(brutto.replace(",", "."));
    if (!b) { toast.error("Skriv inn beløp"); return; }
    const mvaOk = company.mva_registrert && sats > 0;
    const { netto, mva } = mvaOk ? splittBrutto(b, sats) : { netto: b, mva: 0 };
    const ink = INNGAENDE_KONTO[sats] ?? { konto: "2710", kode: "1" };
    const ls: EditLinje[] = [
      { konto: kostKonto, tekst: beskr, debet: String(netto), kredit: "", mva_kode: mvaOk ? ink.kode : "" },
    ];
    if (mvaOk) ls.push({ konto: ink.konto, tekst: `Inngående mva ${sats} %`, debet: String(mva), kredit: "", mva_kode: ink.kode });
    ls.push({ konto: betaltFra, tekst: beskr, debet: "", kredit: String(b), mva_kode: "" });
    setLinjer(ls);
    toast.success("Posteringer laget – kontroller og bokfør.");
  }

  async function lagre(bokfor: boolean) {
    if (!beskr.trim()) { toast.error("Legg inn en beskrivelse"); return; }
    const rader = linjer.filter((l) => l.konto && (Number(l.debet) || Number(l.kredit)));
    for (const r of rader) if (!kontoer.find((a) => a.number === r.konto)) { toast.error(`Konto ${r.konto} finnes ikke i kontoplanen`); return; }
    setBusy(true);
    try {
      let id = voucherId;
      if (id) {
        const { error } = await supabase.from("vouchers").update({ dato, beskrivelse: beskr }).eq("id", id);
        if (error) throw error;
        await supabase.from("voucher_lines").delete().eq("voucher_id", id);
      } else {
        const { data, error } = await supabase.from("vouchers").insert({ company_id: company.id, dato, beskrivelse: beskr }).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      if (rader.length) {
        const { error } = await supabase.from("voucher_lines").insert(
          rader.map((r, i) => ({
            voucher_id: id!,
            company_id: company.id,
            konto: r.konto,
            tekst: r.tekst || null,
            debet: Number(r.debet || 0),
            kredit: Number(r.kredit || 0),
            mva_kode: r.mva_kode || null,
            linjenr: i,
          })),
        );
        if (error) throw error;
      }
      if (bokfor) {
        const { data: nr, error } = await supabase.rpc("post_voucher", { _voucher: id! });
        if (error) throw error;
        toast.success(`Bilag ${nr} er bokført`);
      } else toast.success("Utkast lagret");
      qc.invalidateQueries();
      nav({ to: "/app/bilag/$id", params: { id: id! } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel className="grid gap-4 p-6 md:grid-cols-[180px_1fr]">
        <div className="space-y-1.5">
          <Label>Bilagsdato</Label>
          <Input type="date" value={dato} onChange={(e) => setDato(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Beskrivelse</Label>
          <Input value={beskr} onChange={(e) => setBeskr(e.target.value)} placeholder="F.eks. Kontorrekvisita fra Staples" />
        </div>
      </Panel>

      <Tabs defaultValue={initial ? "manuell" : "utgift"}>
        <TabsList>
          <TabsTrigger value="utgift">Kjøp / utgift</TabsTrigger>
          <TabsTrigger value="manuell">Posteringer</TabsTrigger>
        </TabsList>
        <TabsContent value="utgift">
          <Panel className="grid items-end gap-4 p-6 md:grid-cols-5">
            <div className="space-y-1.5">
              <Label>Beløp inkl. mva</Label>
              <Input className="num" value={brutto} onChange={(e) => setBrutto(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Kostnadskonto</Label>
              <KontoInput value={kostKonto} onChange={setKostKonto} kontoer={kontoer} />
            </div>
            <div className="space-y-1.5">
              <Label>MVA-sats</Label>
              <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={sats} onChange={(e) => setSats(Number(e.target.value))}>
                <option value={25}>25 % (høy)</option>
                <option value={15}>15 % (mat)</option>
                <option value={12}>12 % (transport, kino)</option>
                <option value={0}>0 % / ingen</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Betalt fra</Label>
              <KontoInput value={betaltFra} onChange={setBetaltFra} kontoer={kontoer} />
            </div>
            <Button type="button" variant="secondary" onClick={lagFraUtgift}>Lag posteringer</Button>
          </Panel>
        </TabsContent>
        <TabsContent value="manuell" />
      </Tabs>

      <Panel>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Konto</th>
              <th className="px-4 py-3">Tekst</th>
              <th className="px-4 py-3">MVA-kode</th>
              <th className="px-4 py-3 text-right">Debet</th>
              <th className="px-4 py-3 text-right">Kredit</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {linjer.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="w-56 px-4 py-2"><KontoInput value={l.konto} onChange={(v) => set(i, "konto", v)} kontoer={kontoer} /></td>
                <td className="px-4 py-2"><Input value={l.tekst} onChange={(e) => set(i, "tekst", e.target.value)} /></td>
                <td className="w-44 px-4 py-2">
                  <select className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm" value={l.mva_kode} onChange={(e) => set(i, "mva_kode", e.target.value)}>
                    <option value="">–</option>
                    {MVA_KODER.map((k) => <option key={k.kode} value={k.kode}>{k.kode} · {k.navn}</option>)}
                  </select>
                </td>
                <td className="w-36 px-4 py-2"><Input className="num" value={l.debet} onChange={(e) => set(i, "debet", e.target.value.replace(",", "."))} /></td>
                <td className="w-36 px-4 py-2"><Input className="num" value={l.kredit} onChange={(e) => set(i, "kredit", e.target.value.replace(",", "."))} /></td>
                <td className="w-10 pr-2">
                  <Button variant="ghost" size="icon" onClick={() => setLinjer((ls) => ls.filter((_, j) => j !== i))}><Trash2 /></Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/50">
              <td className="px-4 py-3" colSpan={3}>
                <Button variant="ghost" size="sm" onClick={() => setLinjer((ls) => [...ls, tom()])}><Plus /> Ny linje</Button>
              </td>
              <td className="num px-4 py-3">{kr(sumD)}</td>
              <td className="num px-4 py-3">{kr(sumK)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Panel>

      <div className="flex items-center justify-between">
        <span className={`text-sm ${balanse === 0 ? "text-success" : "text-destructive"}`}>
          {balanse === 0 ? "Bilaget balanserer" : `Differanse ${kr(balanse)}`}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={() => lagre(false)}>Lagre utkast</Button>
          <Button disabled={busy || balanse !== 0 || sumD === 0} onClick={() => lagre(true)}>Bokfør</Button>
        </div>
      </div>
    </div>
  );
}

function KontoInput({ value, onChange, kontoer }: { value: string; onChange: (v: string) => void; kontoer: { number: string; name: string }[] }) {
  const navn = kontoer.find((k) => k.number === value)?.name;
  return (
    <div>
      <Input list="kontoliste" value={value} onChange={(e) => onChange(e.target.value.split(" ")[0])} className="font-mono" />
      <datalist id="kontoliste">
        {kontoer.map((k) => <option key={k.number} value={k.number}>{k.number} {k.name}</option>)}
      </datalist>
      {navn && <div className="mt-1 truncate text-xs text-muted-foreground">{navn}</div>}
    </div>
  );
}
