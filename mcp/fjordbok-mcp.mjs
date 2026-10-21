#!/usr/bin/env node
/**
 * Fjordbok MCP-server (stdio). Gir en AI-agent tre verktøy: les kontoplan, les nye banktransaksjoner
 * og foreslå bilag. Serveren kan ikke bokføre, godkjenne eller lese annet: det er nøkkelen i
 * Fjordbok som begrenser tilgangen, ikke denne filen. Ingen avhengigheter; krever Node 18+.
 *
 * Miljøvariabler:
 *   FJORDBOK_URL         f.eks. https://<prosjekt>.supabase.co
 *   FJORDBOK_PUBLIC_KEY  den offentlige nøkkelen (VITE_SUPABASE_PUBLISHABLE_KEY)
 *   FJORDBOK_AGENT_KEY   agentnøkkel (fbk_…) fra Forslag fra AI → Koble til en AI-agent
 */
import readline from "node:readline";

const miljo = () => ({
  url: (process.env.FJORDBOK_URL ?? "").replace(/\/+$/, ""),
  pub: process.env.FJORDBOK_PUBLIC_KEY ?? "",
  agent: process.env.FJORDBOK_AGENT_KEY ?? "",
});
const VERSION = "0.1.0";

export const VERKTOY = [
  {
    name: "hent_kontoplan",
    description:
      "Henter firmaets kontoplan (konto, navn, standard MVA-kode). Bruk bare kontoer fra denne listen når du foreslår bilag.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "hent_banktransaksjoner",
    description:
      "Henter nye, uavstemte banktransaksjoner som ikke allerede har et ventende forslag. Negativt beløp er utbetaling.",
    inputSchema: {
      type: "object",
      properties: {
        grense: {
          type: "integer",
          minimum: 1,
          maximum: 500,
          description: "Maks antall (standard 100)",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "foreslaa_bilag",
    description:
      "Foreslår et bilag. Et menneske må godkjenne i Fjordbok før noe bokføres. Summen av debet og kredit må være lik. " +
      "Foreslå bare når du har grunnlag, og skriv hva forslaget bygger på i begrunnelsen. Ikke gjett kontoer eller MVA-koder.",
    inputSchema: {
      type: "object",
      required: ["tittel", "begrunnelse", "dato", "linjer"],
      properties: {
        tittel: { type: "string", maxLength: 200 },
        begrunnelse: { type: "string", maxLength: 2000 },
        sikkerhet: { type: "number", minimum: 0, maximum: 1, description: "Ærlig sikkerhet 0–1" },
        bank_transaksjon_id: {
          type: "string",
          description: "Id fra hent_banktransaksjoner, hvis forslaget gjelder en slik",
        },
        dato: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        beskrivelse: { type: "string" },
        linjer: {
          type: "array",
          minItems: 2,
          items: {
            type: "object",
            required: ["konto"],
            properties: {
              konto: { type: "string", pattern: "^\\d{4}$" },
              debet: { type: "number", minimum: 0 },
              kredit: { type: "number", minimum: 0 },
              mva_kode: { type: "string" },
              tekst: { type: "string" },
            },
          },
        },
      },
      additionalProperties: false,
    },
  },
];

async function rpc(navn, body, fetchFn = fetch) {
  const { url: URL_BASE, pub: PUBLIC_KEY, agent: AGENT_KEY } = miljo();
  if (!URL_BASE || !PUBLIC_KEY || !AGENT_KEY) {
    throw new Error(
      "Mangler FJORDBOK_URL, FJORDBOK_PUBLIC_KEY eller FJORDBOK_AGENT_KEY i miljøet.",
    );
  }
  const res = await fetchFn(`${URL_BASE}/rest/v1/rpc/${navn}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: PUBLIC_KEY,
      authorization: `Bearer ${PUBLIC_KEY}`,
    },
    body: JSON.stringify({ _key: AGENT_KEY, ...body }),
  });
  const tekst = await res.text();
  let data;
  try {
    data = tekst ? JSON.parse(tekst) : null;
  } catch {
    data = tekst;
  }
  if (!res.ok)
    throw new Error(
      typeof data === "object" && data?.message ? data.message : `Feil ${res.status}`,
    );
  return data;
}

export async function kjorVerktoy(navn, args = {}, fetchFn = fetch) {
  switch (navn) {
    case "hent_kontoplan":
      return rpc("agent_hent_kontoplan", {}, fetchFn);
    case "hent_banktransaksjoner":
      return rpc(
        "agent_hent_banktransaksjoner",
        args.grense ? { _grense: args.grense } : {},
        fetchFn,
      );
    case "foreslaa_bilag": {
      const { tittel, begrunnelse, sikkerhet, bank_transaksjon_id, dato, beskrivelse, linjer } =
        args;
      const id = await rpc(
        "agent_foreslaa_bilag",
        {
          _tittel: tittel,
          _begrunnelse: begrunnelse,
          _sikkerhet: sikkerhet ?? null,
          _agent_navn: "MCP",
          _bank_transaction_id: bank_transaksjon_id ?? null,
          _payload: { dato, beskrivelse, linjer },
        },
        fetchFn,
      );
      return {
        forslag_id: id,
        status: "ventende",
        melding: "Forslaget venter på godkjenning i Fjordbok.",
      };
    }
    default:
      throw new Error(`Ukjent verktøy: ${navn}`);
  }
}

/** Håndterer én JSON-RPC-melding. Returnerer svar, eller null for varsler. */
export async function haandter(msg, fetchFn = fetch) {
  const { id, method, params } = msg;
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const feil = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (id === undefined || id === null) return null; // varsel (f.eks. notifications/initialized)
  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "fjordbok", version: VERSION },
        instructions:
          "Fjordbok-agent: du kan bare foreslå bilag. Et menneske godkjenner. Hent kontoplanen først og bruk bare kontoer som finnes.",
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: VERKTOY });
    case "tools/call":
      try {
        const data = await kjorVerktoy(params?.name, params?.arguments ?? {}, fetchFn);
        return ok({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
      } catch (e) {
        return ok({
          isError: true,
          content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
        });
      }
    default:
      return feil(-32601, `Metoden støttes ikke: ${method}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", async (linje) => {
    if (!linje.trim()) return;
    let msg;
    try {
      msg = JSON.parse(linje);
    } catch {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Ugyldig JSON" },
        }) + "\n",
      );
      return;
    }
    const svar = await haandter(msg);
    if (svar) process.stdout.write(JSON.stringify(svar) + "\n");
  });
}
