import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { gyldigOrgNr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const STATUS: Record<string, { t: string; v: "outline" | "secondary" | "default" | "destructive" }> = {
  utkast: { t: "Utkast", v: "outline" },
  sendt: { t: "Sendt", v: "secondary" },
  betalt: { t: "Betalt", v: "default" },
  kreditert: { t: "Kreditert", v: "destructive" },
};

export function useCustomers() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["customers", company.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("company_id", company.id).order("navn");
      if (error) throw error;
      return data;
    },
  });
}

export function NyKunde({ onCreated }: { onCreated?: (id: string) => void }) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ navn: "", org_nr: "", epost: "", adresse: "", postnr: "", poststed: "", land: "NO", betalingsfrist: "14" });
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.org_nr && f.land === "NO" && !gyldigOrgNr(f.org_nr)) return toast.error("Ugyldig organisasjonsnummer");
    const { data, error } = await supabase
      .from("customers")
      .insert({ ...f, org_nr: f.org_nr.replace(/\s/g, "") || null, land: f.land.toUpperCase(), betalingsfrist: Number(f.betalingsfrist), company_id: company.id })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["customers"] });
    setOpen(false);
    onCreated?.(data.id);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant={onCreated ? "outline" : "default"}><Plus /> Ny kunde</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Ny kunde</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Navn</Label><Input value={f.navn} onChange={up("navn")} required /></div>
          <div className="space-y-1.5"><Label>Org.nr</Label><Input value={f.org_nr} onChange={up("org_nr")} /></div>
          <div className="space-y-1.5"><Label>E-post</Label><Input type="email" value={f.epost} onChange={up("epost")} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Adresse</Label><Input value={f.adresse} onChange={up("adresse")} /></div>
          <div className="space-y-1.5"><Label>Postnr</Label><Input value={f.postnr} onChange={up("postnr")} /></div>
          <div className="space-y-1.5"><Label>Poststed</Label><Input value={f.poststed} onChange={up("poststed")} /></div>
          <div className="space-y-1.5"><Label>Land (ISO)</Label><Input value={f.land} onChange={up("land")} maxLength={2} /></div>
          <div className="space-y-1.5"><Label>Betalingsfrist (dager)</Label><Input type="number" value={f.betalingsfrist} onChange={up("betalingsfrist")} /></div>
          <Button type="submit" className="col-span-2">Lagre kunde</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
