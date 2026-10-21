import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logg inn – Fjordbok" },
      { name: "description", content: "Logg inn eller opprett konto i Fjordbok." },
      { property: "og:title", content: "Logg inn – Fjordbok" },
      { property: "og:description", content: "Logg inn eller opprett konto i Fjordbok." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"inn" | "ny" | "glemt">("inn");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [navn, setNavn] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) nav({ to: "/app" });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) nav({ to: "/app" });
    });
    return () => data.subscription.unsubscribe();
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "inn") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else if (mode === "ny") {
        const { error } = await supabase.auth.signUp({
          email,
          password: pw,
          options: { emailRedirectTo: window.location.origin + "/app", data: { full_name: navn } },
        });
        if (error) throw error;
        toast.success("Sjekk e-posten din for å bekrefte kontoen.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("Vi har sendt deg en lenke for å velge nytt passord.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function oauth(p: "google" | "lovable") {
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(String(r.error.message ?? r.error));
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden bg-fjord p-12 text-ink-foreground md:flex md:flex-col md:justify-between">
        <Link to="/" className="font-serif text-xl">Fjordbok</Link>
        <blockquote className="font-serif text-3xl leading-snug">
          «Bokføringen skal være ajourført, fullstendig og nøyaktig.»
          <span className="mt-4 block font-sans text-sm opacity-70">Bokføringsloven § 4</span>
        </blockquote>
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <h1 className="text-3xl">{mode === "inn" ? "Logg inn" : mode === "ny" ? "Opprett konto" : "Glemt passord"}</h1>
          {mode === "ny" && (
            <div className="space-y-1.5">
              <Label htmlFor="navn">Fullt navn</Label>
              <Input id="navn" value={navn} onChange={(e) => setNavn(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-post</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode !== "glemt" && (
            <div className="space-y-1.5">
              <Label htmlFor="pw">Passord</Label>
              <Input id="pw" type="password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "inn" ? "Logg inn" : mode === "ny" ? "Opprett konto" : "Send lenke"}
          </Button>
          {mode !== "glemt" && (
            <>
              <div className="relative py-2 text-center text-xs text-muted-foreground">eller</div>
              <Button type="button" variant="outline" className="w-full" onClick={() => oauth("google")}>
                Fortsett med Google
              </Button>
              <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>
                Continue with Lovable
              </button>
            </>
          )}
          <div className="flex justify-between text-sm">
            <button type="button" className="text-primary hover:underline" onClick={() => setMode(mode === "inn" ? "ny" : "inn")}>
              {mode === "inn" ? "Ny bruker? Opprett konto" : "Har du konto? Logg inn"}
            </button>
            {mode === "inn" && (
              <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode("glemt")}>
                Glemt passord?
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
