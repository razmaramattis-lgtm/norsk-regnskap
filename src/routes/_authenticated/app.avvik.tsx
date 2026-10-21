import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, idag, kr } from "@/lib/format";
import { filnavn } from "@/lib/nedlasting";
import { Empty, PageHeader, Panel, Stat, StatusPill, Th, theadCls } from "@/components/app/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/avvik")({
  head: () => ({ meta: [{ title: "Avvikshåndtering – Fjordbok" }] }),
  component: Avvik,
});

type AvvikRad = {
  kategori: string;
  dato: string;
  beskrivelse: string;
  belop: number | null;
  lenke: string | null;
  alvor: "hoy" | "middels" | "lav";
};

const TONE = { hoy: "error", middels: "warn", lav: "muted" } as const;
const ALVOR_LABEL = { hoy: "Høy", middels: "Middels", lav: "Lav" } as const;

function Avvik() {
  const { company } = useCompany();
  const { data: avvik = [], isLoading } = useQuery({
    queryKey: ["avvik", company.id],
    queryFn: async (): Promise<AvvikRad[]> => {
      const idagStr = idag();
      const for7dager = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      const [bilag, vedlegg, bank, fakturaer, levFakturaer] = await Promise.all([
        supabase.from("vouchers").select("id, bilagsnr, dato, beskrivelse, status, kilde, created_at, voucher_lines(debet)")
          .eq("company_id", company.id).order("dato", { ascending: false }).limit(1000),
        supabase.from("documents").select("voucher_id").eq("company_id", company.id).not("voucher_id", "is", null).limit(5000),
        supabase.from("bank_transactions").select("id, dato, tekst, belop").eq("company_id", company.id).eq("status", "ny").limit(1000),
        supabase.from("invoices").select("id, fakturanr, forfallsdato, total, innbetalt, customers(navn)")
          .eq("company_id", company.id).eq("status", "sendt").lt("forfallsdato", idagStr).limit(1000),
        supabase.from("supplier_invoices").select("id, fakturanr, forfallsdato, total, suppliers(navn)")
          .eq("company_id", company.id).eq("status", "bokfort").lt("forfallsdato", idagStr).limit(1000),
      ]);
      for (const r of [bilag, vedlegg, bank, fakturaer, levFakturaer]) if (r.error) throw r.error;

      const medVedlegg = new Set((vedlegg.data ?? []).map((d) => d.voucher_id));
      const ut: AvvikRad[] = [];

      for (const v of bilag.data ?? []) {
        const sum = (v.voucher_lines ?? []).reduce((s, l) => s + Number(l.debet), 0);
        if (v.status === "bokfort" && !medVedlegg.has(v.id) && !["aarsavslutning", "korreksjon"].includes(v.kilde)) {
          ut.push({
            kategori: "Bokført bilag uten vedlegg",
            dato: v.dato,
            beskrivelse: `Bilag ${v.bilagsnr}: ${v.beskrivelse}`,
            belop: sum,
            lenke: `/app/bilag/${v.id}`,
            alvor: "hoy",
          });
        }
        if (v.status === "utkast" && v.created_at.slice(0, 10) < for7dager) {
          ut.push({
            kategori: "Bilagsutkast eldre enn 7 dager",
            dato: v.dato,
            beskrivelse: `Utkast: ${v.beskrivelse}`,
            belop: sum,
            lenke: `/app/bilag/${v.id}`,
            alvor: "middels",
          });
        }
      }
      for (const b of bank.data ?? []) {
        ut.push({
          kategori: "Banktransaksjon ikke bokført",
          dato: b.dato,
          beskrivelse: b.tekst,
          belop: Number(b.belop),
          lenke: "/app/bank",
          alvor: "middels",
        });
      }
      for (const f of fakturaer.data ?? []) {
        ut.push({
          kategori: "Forfalt kundefaktura",
          dato: f.forfallsdato,
          beskrivelse: `Faktura ${f.fakturanr} til ${(f.customers as { navn: string } | null)?.navn ?? "ukjent"}`,
          belop: Number(f.total) - Number(f.innbetalt),
          lenke: "/app/fakturaer",
          alvor: "hoy",
        });
      }
      for (const f of levFakturaer.data ?? []) {
        ut.push({
          kategori: "Forfalt leverandørfaktura",
          dato: f.forfallsdato,
          beskrivelse: `Faktura ${f.fakturanr ?? ""} fra ${(f.suppliers as { navn: string } | null)?.navn ?? "ukjent"}`,
          belop: Number(f.total),
          lenke: "/app/leverandorfakturaer",
          alvor: "hoy",
        });
      }
      return ut.sort((a, b) => a.dato.localeCompare(b.dato));
    },
  });

  function lastNedExcel() {
    const wb = XLSX.utils.book_new();
    const hode = ["Kategori", "Alvorlighet", "Dato", "Beskrivelse", "Beløp (kr)"];
    const rader = avvik.map((a) => [a.kategori, ALVOR_LABEL[a.alvor], a.dato, a.beskrivelse, a.belop]);
    const ws = XLSX.utils.aoa_to_sheet([
      [`Avviksrapport – ${company.name}`, `Generert ${idag()}`],
      [],
      hode,
      ...rader,
      [],
      ["Sum beløp", "", "", "", avvik.reduce((s, a) => s + (a.belop ?? 0), 0)],
    ]);
    ws["!cols"] = [{ wch: 34 }, { wch: 12 }, { wch: 12 }, { wch: 60 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "Avvik");
    const perKategori = [...new Set(avvik.map((a) => a.kategori))].map((k) => [
      k, avvik.filter((a) => a.kategori === k).length,
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([["Kategori", "Antall"], ...perKategori]);
    ws2["!cols"] = [{ wch: 34 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Oppsummering");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filnavn(`avviksrapport-${company.name}-${idag()}`)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const antallManglerVedlegg = avvik.filter((a) => a.kategori === "Bokført bilag uten vedlegg").length;
  const antallBank = avvik.filter((a) => a.kategori === "Banktransaksjon ikke bokført").length;
  const antallForfalt = avvik.filter((a) => a.kategori.startsWith("Forfalt")).length;

  return (
    <>
      <PageHeader
        title="Avvikshåndtering"
        sub="Føringer som mangler bilag, ubokførte banktransaksjoner og forfalte poster. Last ned som Excel for oppfølging."
        actions={
          <Button variant="outline" disabled={!avvik.length} onClick={lastNedExcel}>
            <Download /> Last ned Excel
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Bilag uten vedlegg" value={String(antallManglerVedlegg)} />
        <Stat label="Ubokførte banktransaksjoner" value={String(antallBank)} />
        <Stat label="Forfalte fakturaer" value={String(antallForfalt)} />
      </div>
      <Panel>
        {isLoading ? (
          <Empty>Laster …</Empty>
        ) : avvik.length === 0 ? (
          <Empty>Ingen avvik funnet. Alt er bokført, dokumentert og betalt i tide.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className={theadCls}>
              <tr><Th>Kategori</Th><Th>Alvorlighet</Th><Th>Dato</Th><Th>Beskrivelse</Th><Th right>Beløp</Th></tr>
            </thead>
            <tbody>
              {avvik.map((a, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-2 text-muted-foreground">{a.kategori}</td>
                  <td className="px-4 py-2"><StatusPill tone={TONE[a.alvor]}>{ALVOR_LABEL[a.alvor]}</StatusPill></td>
                  <td className="px-4 py-2">{dato(a.dato)}</td>
                  <td className="px-4 py-2">
                    {a.lenke?.startsWith("/app/bilag/") ? (
                      <Link to="/app/bilag/$id" params={{ id: a.lenke.split("/").pop()! }} className="text-primary hover:underline">{a.beskrivelse}</Link>
                    ) : a.lenke ? (
                      <Link to={a.lenke} className="text-primary hover:underline">{a.beskrivelse}</Link>
                    ) : a.beskrivelse}
                  </td>
                  <td className="num px-4 py-2 text-right">{a.belop !== null ? kr(a.belop) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
