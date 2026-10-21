import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bot, Check, X } from "lucide-react";
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
          <strong>MCP-tilgang (forberedt, ikke koblet).</strong> Eksterne agenter (Claude m.fl.) kan
          senere få scoped nøkler som kun kan <em>opprette forslag og lese</em>, aldri godkjenne
          eller bokføre.
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
