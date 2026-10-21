import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { gyldigOrgNr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { BrregKnapp } from "@/components/app/BrregKnapp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function useSuppliers() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["suppliers", company.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").eq("company_id", company.id).order("navn");
      if (error) throw error;
      return data;
    },
  });
}

export function NyLeverandor({ onCreated }: { onCreated?: (id: string) => void }) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ navn: "", org_nr: "", epost: "", kontonummer: "", standard_konto: "6800", land: "NO" });
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.org_nr && f.land === "NO" && !gyldigOrgNr(f.org_nr)) { toast.error("Ugyldig organisasjonsnummer"); return; }
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ ...f, org_nr: f.org_nr.replace(/\s/g, "") || null, company_id: company.id })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    setOpen(false);
    onCreated?.(data.id);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant={onCreated ? "outline" : "default"}><Plus /> Ny leverandør</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Ny leverandør</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Navn</Label><Input value={f.navn} onChange={up("navn")} required /></div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between"><Label>Org.nr</Label><BrregKnapp orgNr={f.org_nr} onFunnet={(e) => setF((x) => ({ ...x, navn: e.navn || x.navn, land: e.land || x.land }))} /></div>
            <Input value={f.org_nr} onChange={up("org_nr")} />
          </div>
          <div className="space-y-1.5"><Label>E-post</Label><Input type="email" value={f.epost} onChange={up("epost")} /></div>
          <div className="space-y-1.5"><Label>Bankkonto</Label><Input value={f.kontonummer} onChange={up("kontonummer")} /></div>
          <div className="space-y-1.5"><Label>Standard kostnadskonto</Label><Input className="font-mono" value={f.standard_konto} onChange={up("standard_konto")} /></div>
          <Button type="submit" className="col-span-2">Lagre leverandør</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
