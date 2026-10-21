import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { haandter, kjorVerktoy, VERKTOY } from "./fjordbok-mcp.mjs";

const lagFetch = (svar, status = 200, fanget = []) => async (url, init) => {
  fanget.push({ url, headers: init.headers, body: JSON.parse(init.body) });
  return { ok: status < 400, status, text: async () => JSON.stringify(svar) };
};

describe("protokoll", () => {
  it("svarer på initialize og lister tre verktøy", async () => {
    const i = await haandter({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } });
    expect(i.result.serverInfo.name).toBe("fjordbok");
    expect(i.result.protocolVersion).toBe("2025-03-26");
    const l = await haandter({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(l.result.tools.map((t) => t.name)).toEqual(["hent_kontoplan", "hent_banktransaksjoner", "foreslaa_bilag"]);
    expect(VERKTOY.every((t) => t.inputSchema.type === "object")).toBe(true);
  });

  it("ignorerer varsler, og ukjente metoder gir feilkode", async () => {
    expect(await haandter({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    expect((await haandter({ jsonrpc: "2.0", id: 3, method: "finnes/ikke" })).error.code).toBe(-32601);
  });

  it("snakker JSON-RPC over stdio (ekte prosess)", () => {
    const inn = [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ].map((m) => JSON.stringify(m)).join("\n") + "\n";
    const r = spawnSync("node", ["mcp/fjordbok-mcp.mjs"], { input: inn, encoding: "utf8", timeout: 10000 });
    const svar = r.stdout.trim().split("\n").map((l) => JSON.parse(l));
    expect(svar).toHaveLength(2);
    expect(svar[1].result.tools).toHaveLength(3);
  });
});

describe("verktøy", () => {
  const gammel = { ...process.env };
  beforeEach(() => {
    process.env.FJORDBOK_URL = "https://x.supabase.co/";
    process.env.FJORDBOK_PUBLIC_KEY = "pub";
    process.env.FJORDBOK_AGENT_KEY = "fbk_test";
  });
  afterEach(() => {
    for (const k of ["FJORDBOK_URL", "FJORDBOK_PUBLIC_KEY", "FJORDBOK_AGENT_KEY"]) {
      if (gammel[k] === undefined) delete process.env[k]; else process.env[k] = gammel[k];
    }
  });

  it("foreslaa_bilag sender nøkkel, payload og bankreferanse til riktig funksjon", async () => {
    const fanget = [];
    const r = await kjorVerktoy(
      "foreslaa_bilag",
      { tittel: "T", begrunnelse: "B", sikkerhet: 0.9, bank_transaksjon_id: "abc", dato: "2026-10-20", linjer: [{ konto: "6800", debet: 1 }, { konto: "1920", kredit: 1 }] },
      lagFetch("id-1", 200, fanget),
    );
    expect(r.forslag_id).toBe("id-1");
    expect(fanget[0].url).toBe("https://x.supabase.co/rest/v1/rpc/agent_foreslaa_bilag");
    expect(fanget[0].headers.apikey).toBe("pub");
    expect(fanget[0].body).toMatchObject({ _key: "fbk_test", _tittel: "T", _bank_transaction_id: "abc", _sikkerhet: 0.9 });
    expect(fanget[0].body._payload.linjer).toHaveLength(2);
  });

  it("hent_banktransaksjoner sender grense", async () => {
    const fanget = [];
    await kjorVerktoy("hent_banktransaksjoner", { grense: 5 }, lagFetch([], 200, fanget));
    expect(fanget[0].body).toEqual({ _key: "fbk_test", _grense: 5 });
  });

  it("databasefeil vises som verktøyfeil, ikke krasj", async () => {
    const r = await haandter(
      { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "hent_kontoplan", arguments: {} } },
      lagFetch({ message: "Ugyldig eller tilbakekalt agentnøkkel" }, 400),
    );
    expect(r.result.isError).toBe(true);
    expect(r.result.content[0].text).toMatch(/tilbakekalt/);
  });

  it("mangler miljø gir lesbar feil", async () => {
    delete process.env.FJORDBOK_AGENT_KEY;
    const r = await haandter({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "hent_kontoplan" } });
    expect(r.result.isError).toBe(true);
    expect(r.result.content[0].text).toMatch(/FJORDBOK_AGENT_KEY/);
  });

  it("ukjent verktøy avvises", async () => {
    await expect(kjorVerktoy("bokfor_alt", {})).rejects.toThrow(/Ukjent verktøy/);
  });
});
