import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Lock, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, kr } from "@/lib/format";
import { DokumentViser } from "./DokumentViser";
import { useDokumenter } from "./Vedlegg";
import { Empty, StatusPill, useAccounts } from "./ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function useBilag(id: string | null | undefined) {
  return useQuery({
    queryKey: ["voucher", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("vouchers").select("*, voucher_lines(*)").eq("id", id!).single();
      if (error) throw error;
      data.voucher_lines.sort((a, b) => a.linjenr - b.linjenr);
      return data;
    },
  });
}

/** Bilagets posteringer, med kontonavn. */
export function BilagLinjer({ linjer }: { linjer: { id: string; konto: string; tekst: string | null; mva_kode: string | null; debet: number; kredit: number }[] }) {
  const { data: kontoer = [] } = useAccounts();
  const sum = linjer.reduce((s, l) => s + Number(l.debet), 0);
  return (
    <table className="w-full text-sm">
      <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr><th className="px-3 py-2">Konto</th><th className="px-3 py-2">Tekst</th><th className="px-3 py-2">MVA</th><th className="px-3 py-2 text-right">Debet</th><th className="px-3 py-2 text-right">Kredit</th></tr>
      </thead>
      <tbody>
        {linjer.map((l) => (
          <tr key={l.id} className="border-b last:border-0">
            <td className="px-3 py-2"><span className="font-mono">{l.konto}</span> <span className="text-muted-foreground">{kontoer.find((k) => k.number === l.konto)?.name}</span></td>
            <td className="px-3 py-2">{l.tekst}</td>
            <td className="px-3 py-2 font-mono">{l.mva_kode}</td>
            <td className="num px-3 py-2">{Number(l.debet) ? kr(l.debet) : ""}</td>
            <td className="num px-3 py-2">{Number(l.kredit) ? kr(l.kredit) : ""}</td>
          </tr>
        ))}
      </tbody>
      <tfoot><tr className="border-t bg-muted/50 font-medium"><td colSpan={3} className="px-3 py-2">Sum</td><td className="num px-3 py-2">{kr(sum)}</td><td className="num px-3 py-2">{kr(sum)}</td></tr></tfoot>
    </table>
  );
}

/** Vedleggene til et bilag med innebygd viser. */
export function BilagDokumenter({ voucherId, className = "" }: { voucherId: string; className?: string }) {
  const { data: docs = [] } = useDokumenter({ voucherId });
  const [valgt, setValgt] = useState<string | null>(null);
  useEffect(() => setValgt(docs[0]?.id ?? null), [docs]);
  const d = docs.find((x) => x.id === valgt);
  if (!docs.length) return null;
  return (
    <div className={`flex min-h-0 flex-col gap-2 ${className}`}>
      {docs.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {docs.map((x) => (
            <button key={x.id} onClick={() => setValgt(x.id)} className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${x.id === valgt ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
              <Paperclip className="h-3 w-3" /> {x.filnavn}
            </button>
          ))}
        </div>
      )}
      {d && <DokumentViser key={d.id} path={d.path} mime={d.mime} filnavn={d.filnavn} className="flex-1" />}
    </div>
  );
}

/** Kompakt visning av ett bilag, brukt i sidepanelet fra rapporter og hovedbok. */
export function BilagKort({ id }: { id: string }) {
  const { data: v } = useBilag(id);
  if (!v) return <Empty>Laster …</Empty>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {v.status === "bokfort" ? <StatusPill tone="ok"><Lock className="h-3 w-3" /> Bilag {v.bilagsnr}</StatusPill> : <StatusPill tone="warn">Utkast</StatusPill>}
        <span>{dato(v.dato)}</span>
        <span className="text-muted-foreground">{v.beskrivelse}</span>
        <Button size="sm" variant="ghost" asChild className="ml-auto">
          <Link to="/app/bilag/$id" params={{ id }}>Åpne bilaget <ArrowUpRight /></Link>
        </Button>
      </div>
      <div className="rounded-lg border"><BilagLinjer linjer={v.voucher_lines} /></div>
      <BilagDokumenter voucherId={id} className="h-[60vh]" />
    </div>
  );
}

export type KontoUtvalg = { konto: string; fra: string; til: string; tittel?: string } | null;

/**
 * Sidepanel med alle posteringer på en konto i en periode. Klikk på en linje for å se bilaget og vedleggene.
 * Brukes fra resultat, balanse, saldobalanse og hovedbok.
 */
export function KontoSheet({ valg, onClose }: { valg: KontoUtvalg; onClose: () => void }) {
  const { company } = useCompany();
  const { data: kontoer = [] } = useAccounts();
  const [bilag, setBilag] = useState<string | null>(null);
  useEffect(() => setBilag(null), [valg]);
  const { data, isLoading } = useQuery({
    queryKey: ["konto-poster", company.id, valg?.konto, valg?.fra, valg?.til],
    enabled: !!valg,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voucher_lines")
        .select("id, debet, kredit, tekst, mva_kode, vouchers!inner(id, bilagsnr, dato, beskrivelse, status)")
        .eq("company_id", company.id)
        .eq("konto", valg!.konto)
        .eq("vouchers.status", "bokfort")
        .gte("vouchers.dato", valg!.fra)
        .lte("vouchers.dato", valg!.til);
      if (error) throw error;
      return data
        .map((l) => ({ ...l, d: Number(l.debet), k: Number(l.kredit), v: l.vouchers }))
        .sort((a, b) => a.v.dato.localeCompare(b.v.dato) || (a.v.bilagsnr ?? 0) - (b.v.bilagsnr ?? 0));
    },
  });
  const navn = kontoer.find((k) => k.number === valg?.konto)?.name ?? "";
  const sum = (data ?? []).reduce((s, r) => s + r.d - r.k, 0);
  return (
    <Sheet open={!!valg} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">
            {bilag ? (
              <button onClick={() => setBilag(null)} className="flex items-center gap-2 hover:text-primary"><ArrowLeft className="h-5 w-5" /> {valg?.konto} {navn}</button>
            ) : (
              <>{valg?.konto} {navn}</>
            )}
          </SheetTitle>
          <SheetDescription>
            {valg?.tittel ?? "Bokførte posteringer"} · {valg && `${dato(valg.fra)}–${dato(valg.til)}`}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {bilag ? (
            <BilagKort id={bilag} />
          ) : isLoading || !data ? (
            <Empty>Laster …</Empty>
          ) : data.length === 0 ? (
            <Empty>Ingen posteringer i perioden.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="py-2 pr-3">Dato</th><th className="py-2 pr-3">Bilag</th><th className="py-2 pr-3">Tekst</th><th className="py-2 pr-3 text-right">Debet</th><th className="py-2 text-right">Kredit</th></tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id} onClick={() => setBilag(r.v.id)} className="cursor-pointer border-b transition-colors hover:bg-primary/5">
                    <td className="py-2 pr-3 whitespace-nowrap">{dato(r.v.dato)}</td>
                    <td className="py-2 pr-3 font-mono text-primary">{r.v.bilagsnr}</td>
                    <td className="py-2 pr-3">{r.tekst || r.v.beskrivelse}</td>
                    <td className="num py-2 pr-3">{r.d ? kr(r.d) : ""}</td>
                    <td className="num py-2">{r.k ? kr(r.k) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="font-medium"><td colSpan={3} className="py-2">Bevegelse i perioden ({data.length} posteringer)</td><td colSpan={2} className="num py-2">{kr(sum)}</td></tr></tfoot>
            </table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Sidepanel med ett bilag og vedleggene, f.eks. fra hovedboken. */
export function BilagSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Bilag</SheetTitle>
          <SheetDescription>Posteringer og vedlegg</SheetDescription>
        </SheetHeader>
        <div className="mt-4">{id && <BilagKort id={id} />}</div>
      </SheetContent>
    </Sheet>
  );
}
