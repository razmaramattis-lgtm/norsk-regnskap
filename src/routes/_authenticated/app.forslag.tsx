import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bot, Check, Copy, KeyRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { dato, kr } from "@/lib/format";
import { PageHeader, Panel, Empty, StatusPill, useAccounts } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/app/forslag")({
  head: () => ({ meta: [{ title: "Forslag – Fjordbok" }] }),
  component: Forslag,
});

type PLinje = { konto: string; debet?: number; kredit?: number; tekst?: string; mva_kode?: string };
type Payload = { dato: string; beskrivelse?: string; linjer: PLinje[] };

function lesPayload(p: unknown): Payload | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  if (typeof o["dato"] !== "string" || !Array.isArray(o["linjer"])) return null;
  return o as unknown as Payload;
}

function Forslag() {
  const { company } = useCompany();
  const { data = [], isLoading } = useQuery({
    queryKey: ["forslag", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_proposals")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const ventende = data.filter((f) => f.status === "ventende");
  const avgjort = data.filter((f) => f.status !== "ventende");

  return (
    <>
      <PageHeader
        title="Forslag fra AI og regler"
        sub="Agenten foreslår, du bestemmer. Ingenting bokføres før du godkjenner, og godkjente forslag går gjennom samme kontroller som alle andre bilag."
      />
      <Tabs defaultValue="ventende">
        <TabsList>
          <TabsTrigger value="ventende">
            Til godkjenning{" "}
            {ventende.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-xs text-primary">
                {ventende.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="historikk">Avgjort</TabsTrigger>
          <TabsTrigger value="agent">Koble til en AI-agent</TabsTrigger>
        </TabsList>

        <TabsContent value="ventende">
          {isLoading ? (
            <Empty>Laster …</Empty>
          ) : ventende.length === 0 ? (
            <Panel>
              <Empty>
                Ingen forslag å godkjenne. Gå til{" "}
                <Link to="/app/bank" className="text-primary hover:underline">
                  Bank
                </Link>{" "}
                og trykk «Foreslå konteringer» for å la regelmotoren forberede bilag fra uavstemte
                transaksjoner.
              </Empty>
            </Panel>
          ) : (
            <div className="space-y-4">
              {ventende.map((f) => (
                <ForslagKort key={f.id} f={f} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historikk">
          <Panel>
            {avgjort.length === 0 ? (
              <Empty>Ingen avgjorte forslag ennå.</Empty>
            ) : (
              <ul className="divide-y">
                {avgjort.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-4 px-5 py-3 text-sm">
                    <StatusPill tone={f.status === "godkjent" ? "ok" : "muted"}>
                      {f.status === "godkjent" ? "Godkjent" : "Avvist"}
                    </StatusPill>
                    <span className="min-w-0 flex-1 truncate">{f.tittel}</span>
                    <span className="text-muted-foreground">
                      {f.avgjort_at ? dato(f.avgjort_at) : ""}
                    </span>
                    {f.voucher_id && (
                      <Link
                        to="/app/bilag/$id"
                        params={{ id: f.voucher_id }}
                        className="text-primary hover:underline"
                      >
                        Se bilag
                      </Link>
                    )}
                    {f.avvisningsgrunn && (
                      <span className="text-muted-foreground">«{f.avvisningsgrunn}»</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="agent">
          <AgentInfo />
        </TabsContent>
      </Tabs>
    </>
  );
}

type Rad = {
  id: string;
  tittel: string;
  begrunnelse: string | null;
  sikkerhet: number | null;
  kilde: string;
  agent_navn: string | null;
  payload: unknown;
};

function ForslagKort({ f }: { f: Rad }) {
  const { company, canWrite } = useCompany();
  const { data: kontoer = [] } = useAccounts();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [avvis, setAvvis] = useState(false);
  const [grunn, setGrunn] = useState("");
  const p = lesPayload(f.payload);
  const navn = (k: string) =>
    kontoer.find((a) => a.number === k)?.name ?? "Konto finnes ikke i kontoplanen";
  const sumD = p?.linjer.reduce((s, l) => s + Number(l.debet ?? 0), 0) ?? 0;
  const sumK = p?.linjer.reduce((s, l) => s + Number(l.kredit ?? 0), 0) ?? 0;
  const balanserer = Math.abs(sumD - sumK) < 0.005 && sumD > 0;
  const ukjenteKontoer = p?.linjer.filter((l) => !kontoer.some((a) => a.number === l.konto)) ?? [];

  async function avgjor(godkjenn: boolean) {
    setBusy(true);
    const { error } = godkjenn
      ? await supabase.rpc("approve_proposal", { _id: f.id })
      : await supabase.rpc("reject_proposal", {
          _id: f.id,
          ...(grunn.trim() ? { _grunn: grunn.trim() } : {}),
        });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(godkjenn ? "Godkjent og bokført" : "Forslaget er avvist");
    qc.invalidateQueries();
  }

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h2 className="text-lg">{f.tittel}</h2>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {f.agent_navn ?? (f.kilde === "regel" ? "Regelmotor" : f.kilde)}
            {p && ` · ${dato(p.dato)}`}
            {f.sikkerhet != null && ` · sikkerhet ${Math.round(Number(f.sikkerhet) * 100)} %`}
          </div>
        </div>
        {!balanserer && <StatusPill tone="bad">Balanserer ikke</StatusPill>}
        {ukjenteKontoer.length > 0 && <StatusPill tone="bad">Ukjent konto</StatusPill>}
      </div>

      {f.begrunnelse && (
        <p className="mt-3 rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
          {f.begrunnelse}
        </p>
      )}

      {p ? (
        <table className="mt-4 w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">Konto</th>
              <th className="py-2">Tekst</th>
              <th className="py-2">MVA</th>
              <th className="py-2 text-right">Debet</th>
              <th className="py-2 text-right">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {p.linjer.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2">
                  <span className="font-mono">{l.konto}</span>{" "}
                  <span className="text-muted-foreground">{navn(l.konto)}</span>
                </td>
                <td className="py-2 text-muted-foreground">{l.tekst}</td>
                <td className="py-2 font-mono text-muted-foreground">{l.mva_kode}</td>
                <td className="num py-2">{Number(l.debet ?? 0) ? kr(l.debet) : ""}</td>
                <td className="num py-2">{Number(l.kredit ?? 0) ? kr(l.kredit) : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td colSpan={3} className="py-2">
                Sum
              </td>
              <td className="num py-2">{kr(sumD)}</td>
              <td className="num py-2">{kr(sumK)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="mt-4 text-sm text-destructive">
          Forslaget har et format Fjordbok ikke forstår og kan ikke godkjennes.
        </p>
      )}

      {canWrite && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {avvis ? (
            <>
              <Input
                className="max-w-xs"
                placeholder="Grunn (valgfritt)"
                value={grunn}
                onChange={(e) => setGrunn(e.target.value)}
              />
              <Button variant="ghost" onClick={() => setAvvis(false)} disabled={busy}>
                Avbryt
              </Button>
              <Button variant="destructive" onClick={() => avgjor(false)} disabled={busy}>
                Bekreft avvisning
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setAvvis(true)} disabled={busy}>
                <X /> Avvis
              </Button>
              <Button
                onClick={() => avgjor(true)}
                disabled={busy || !p || !balanserer || ukjenteKontoer.length > 0}
              >
                <Check /> Godkjenn og bokfør
              </Button>
            </>
          )}
        </div>
      )}
      <span className="sr-only">{company.name}</span>
    </Panel>
  );
}

function AgentInfo() {
  return (
    <div className="space-y-6">
      <AgentNokler />
      <AgentForklaring />
    </div>
  );
}

type Nokkel = {
  id: string;
  navn: string;
  prefix: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

function AgentNokler() {
  const { company, isAdmin } = useCompany();
  const qc = useQueryClient();
  const [navn, setNavn] = useState("");
  const [ny, setNy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const { data: nokler = [] } = useQuery({
    queryKey: ["agent-keys", company.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_keys")
        .select("id, navn, prefix, created_at, revoked_at, last_used_at")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Nokkel[];
    },
  });

  async function opprett() {
    if (!navn.trim()) {
      toast.error("Gi nøkkelen et navn, f.eks. hvilken agent som skal bruke den.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_agent_key", {
      _company: company.id,
      _navn: navn.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNy(data);
    setNavn("");
    qc.invalidateQueries({ queryKey: ["agent-keys"] });
  }

  async function kall(id: string) {
    const { error } = await supabase.rpc("revoke_agent_key", { _id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Nøkkelen er tilbakekalt");
    qc.invalidateQueries({ queryKey: ["agent-keys"] });
  }

  async function kopier(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      toast.success("Kopiert");
    } catch {
      toast.error("Kunne ikke kopiere. Marker teksten og kopier manuelt.");
    }
  }

  if (!isAdmin) {
    return (
      <Panel className="p-6 text-sm text-muted-foreground">
        Kun eier og administrator kan opprette agentnøkler.
      </Panel>
    );
  }

  return (
    <Panel className="space-y-5 p-6 text-sm">
      <div>
        <h2 className="flex items-center gap-2 text-xl">
          <KeyRound className="h-5 w-5 text-primary" /> Agentnøkler
        </h2>
        <p className="mt-2 text-muted-foreground">
          En nøkkel gir én agent lov til å lese kontoplanen og nye banktransaksjoner i{" "}
          <strong className="text-foreground">{company.name}</strong>, og til å foreslå bilag. Den
          kan ikke bokføre, godkjenne, slette eller se noe annet. Du kan kalle den tilbake når som
          helst.
        </p>
      </div>

      {ny && (
        <div className="rounded-md border border-primary/40 bg-accent/40 p-4">
          <p className="font-medium">Kopier nøkkelen nå. Den vises ikke igjen.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-background px-2 py-1.5 text-xs">
              {ny}
            </code>
            <Button variant="outline" size="sm" onClick={() => kopier(ny)}>
              <Copy /> Kopier
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNy(null)}>
            Jeg har lagret den
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="nokkelnavn" className="text-xs text-muted-foreground">
            Navn på nøkkelen
          </label>
          <Input
            id="nokkelnavn"
            className="w-72"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            placeholder="F.eks. Claude – bankavstemming"
            maxLength={80}
          />
        </div>
        <Button onClick={opprett} disabled={busy}>
          Opprett nøkkel
        </Button>
      </div>

      {nokler.length > 0 && (
        <ul className="divide-y rounded-md border">
          {nokler.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="font-medium">{n.navn}</span>
              <code className="text-xs text-muted-foreground">{n.prefix}…</code>
              <span className="text-xs text-muted-foreground">
                Opprettet {dato(n.created_at)}
                {n.last_used_at ? ` · sist brukt ${dato(n.last_used_at)}` : " · aldri brukt"}
              </span>
              <span className="ml-auto flex items-center gap-2">
                {n.revoked_at ? (
                  <StatusPill tone="muted">Tilbakekalt</StatusPill>
                ) : (
                  <>
                    <StatusPill tone="ok">Aktiv</StatusPill>
                    <Button variant="ghost" size="sm" onClick={() => kall(n.id)}>
                      Kall tilbake
                    </Button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Slik kaller agenten Fjordbok
        </h3>
        <p className="mb-2 text-muted-foreground">
          Tre funksjoner over HTTPS. Send nøkkelen som parameter; «apikey» er den offentlige
          nettstedsnøkkelen. Dokumentasjon med flere eksempler ligger i{" "}
          <code>docs/AI-AGENTER.md</code>.
        </p>
        <pre className="overflow-x-auto rounded-md bg-ink p-4 text-xs leading-relaxed text-ink-foreground">{`POST ${url ?? "https://<prosjekt>.supabase.co"}/rest/v1/rpc/agent_hent_kontoplan
POST ${url ?? "https://<prosjekt>.supabase.co"}/rest/v1/rpc/agent_hent_banktransaksjoner
POST ${url ?? "https://<prosjekt>.supabase.co"}/rest/v1/rpc/agent_foreslaa_bilag
apikey: <offentlig nøkkel>
Content-Type: application/json

{ "_key": "fbk_…", "_tittel": "…", "_begrunnelse": "…", "_payload": { … }, "_sikkerhet": 0.9 }`}</pre>
      </div>
    </Panel>
  );
}

function AgentForklaring() {
  return (
    <Panel className="space-y-5 p-6 text-sm">
      <div>
        <h2 className="text-xl">Slik jobber en AI-agent i Fjordbok</h2>
        <p className="mt-2 text-muted-foreground">
          Fjordbok er bygget slik at en agent aldri bokfører selv. Den legger frem et{" "}
          <strong className="text-foreground">forslag</strong> med begrunnelse og sikkerhet, og du
          godkjenner eller avviser. Ved godkjenning går forslaget gjennom den samme databasevakten
          som alle bilag: balansekontroll, periodelås, kontoplan, fortløpende bilagsnummer og
          revisjonslogg.
        </p>
      </div>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          <strong>Regelmotor (finnes nå).</strong> Under Bank lager «Foreslå konteringer» forslag
          fra uavstemte transaksjoner med enkle, forklarbare regler (bankgebyr, programvare, telefon
          m.m.). Det gjettes ikke: treffer ingen regel, lages ikke noe forslag.
        </li>
        <li>
          <strong>Språkmodell (forberedt, ikke koblet).</strong> En modell kan lese kvitteringer og
          fakturaer og skrive samme forslagsformat. Det krever en leverandør og en server-funksjon
          som holder nøklene hemmelige.
        </li>
        <li>
          <strong>Eksterne agenter (klart nå).</strong> Agenter som Claude kan få en nøkkel (se
          over) som kun kan <em>lese kontoplan og nye banktransaksjoner og opprette forslag</em>,
          aldri godkjenne eller bokføre. En ferdig MCP-server oppå dette er ikke bygget ennå.
        </li>
      </ol>
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Format for et forslag
        </h3>
        <pre className="overflow-x-auto rounded-md bg-ink p-4 text-xs leading-relaxed text-ink-foreground">{`{
  "dato": "2026-10-20",
  "beskrivelse": "Kontorrekvisita",
  "linjer": [
    { "konto": "6800", "debet": 80.00, "kredit": 0, "mva_kode": "1" },
    { "konto": "2710", "debet": 20.00, "kredit": 0, "mva_kode": "1" },
    { "konto": "1920", "debet": 0, "kredit": 100.00 }
  ]
}`}</pre>
      </div>
      <p className="text-xs text-muted-foreground">
        Personvern: send aldri personopplysninger til en ekstern modell uten databehandleravtale.
        Velg leverandør og region med omhu, spesielt for lønnsdata.
      </p>
    </Panel>
  );
}
