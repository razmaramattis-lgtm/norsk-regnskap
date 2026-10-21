import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nytt passord – Fjordbok" },
      { name: "description", content: "Velg et nytt passord for Fjordbok-kontoen din." },
      { property: "og:title", content: "Nytt passord – Fjordbok" },
      { property: "og:description", content: "Velg et nytt passord." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const nav = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Passordet er oppdatert.");
    nav({ to: "/app" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl">Velg nytt passord</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Nytt passord</Label>
          <Input id="pw" type="password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full">Lagre</Button>
      </form>
    </div>
  );
}
