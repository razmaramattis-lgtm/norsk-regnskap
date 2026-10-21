import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { Button } from "@/components/ui/button";

async function sha256(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function lastOppDokument(companyId: string, file: File, link: { voucher_id?: string; supplier_invoice_id?: string } = {}) {
  const hash = await sha256(file);
  const path = `${companyId}/${new Date().toISOString().slice(0, 7)}/${hash.slice(0, 12)}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("bilag").upload(path, file, { upsert: false });
  if (error && !/exists/i.test(error.message)) throw error;
  const { error: e2 } = await supabase.from("documents").insert({
    company_id: companyId, path, filnavn: file.name, mime: file.type, storrelse: file.size, sha256: hash, ...link,
  });
  if (e2) throw e2;
}

export async function apneDokument(path: string) {
  const { data, error } = await supabase.storage.from("bilag").createSignedUrl(path, 300);
  if (error) { toast.error(error.message); return; }
  window.open(data.signedUrl, "_blank");
}

export function Vedlegg({ voucherId, supplierInvoiceId }: { voucherId?: string; supplierInvoiceId?: string }) {
  const { company, canWrite } = useCompany();
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const key = ["docs", voucherId ?? supplierInvoiceId];
  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase.from("documents").select("*").eq("company_id", company.id);
      q = voucherId ? q.eq("voucher_id", voucherId) : q.eq("supplier_invoice_id", supplierInvoiceId!);
      return (await q).data ?? [];
    },
  });
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await lastOppDokument(company.id, file, voucherId ? { voucher_id: voucherId } : { supplier_invoice_id: supplierInvoiceId });
      toast.success("Vedlegg lagret i arkivet");
      qc.invalidateQueries({ queryKey: key });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {data.map((d) => (
        <button key={d.id} onClick={() => apneDokument(d.path)} className="flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted">
          <Paperclip className="h-3 w-3" /> {d.filnavn}
        </button>
      ))}
      {canWrite && (
        <>
          <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => ref.current?.click()}><Upload /> Legg ved kvittering</Button>
        </>
      )}
    </div>
  );
}
