import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firma = {
  id: "c1",
  name: "Testfirma AS",
  org_nr: "923609016",
  company_type: "as",
  mva_registrert: true,
  mva_termin: "tomaaned",
  adresse: "Gata 1",
  postnr: "0150",
  poststed: "Oslo",
  kontonummer: "15031234562",
  epost: null,
  regnskapsaar_start: 1,
  neste_bilagsnr: 1,
  neste_fakturanr: 10001,
  laast_til: null,
  aga_sone: "1",
  feriepengesats: 10.2,
  created_by: "u1",
  created_at: "2026-01-01",
};

const tabeller: Record<string, unknown[]> = {
  company_members: [{ role: "eier", companies: firma }],
  agent_proposals: [
    {
      id: "p1",
      company_id: "c1",
      kilde: "regel",
      agent_navn: "Regelmotor",
      tittel: "Programvare: Microsoft 365",
      begrunnelse: "Treffer regelen Programvare",
      sikkerhet: 0.7,
      status: "ventende",
      voucher_id: null,
      payload: {
        dato: "2026-10-20",
        linjer: [
          { konto: "6552", debet: 199.2, kredit: 0, mva_kode: "1" },
          { konto: "2710", debet: 49.8, kredit: 0, mva_kode: "1" },
          { konto: "1920", debet: 0, kredit: 249 },
        ],
      },
      created_at: "2026-10-20",
    },
  ],
  accounts: [
    {
      id: "a1",
      company_id: "c1",
      number: "6552",
      name: "Programvare",
      aktiv: true,
      mva_kode: null,
    },
    {
      id: "a2",
      company_id: "c1",
      number: "2710",
      name: "Inngående mva",
      aktiv: true,
      mva_kode: null,
    },
    {
      id: "a3",
      company_id: "c1",
      number: "1920",
      name: "Bankinnskudd",
      aktiv: true,
      mva_kode: null,
    },
  ],
  account_balances: [
    { konto: "1920", debet: 100000, kredit: 0, mva_kode: null, dato: "2025-06-01" },
    { konto: "2000", debet: 0, kredit: 30000, mva_kode: null, dato: "2025-01-01" },
    { konto: "3000", debet: 0, kredit: 70000, mva_kode: "3", dato: "2025-06-01" },
  ],
};

vi.mock("@/integrations/supabase/client", () => {
  const bygg = (tabell: string) => {
    let enkelt = false;
    let tell = false;
    const rader = () => tabeller[tabell] ?? [];
    const proxy: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (ok: (v: unknown) => void) => {
              const r = rader();
              ok({ data: enkelt ? (r[0] ?? null) : r, error: null, count: tell ? r.length : null });
            };
          }
          return (...args: unknown[]) => {
            if (prop === "select" && (args[1] as { head?: boolean } | undefined)?.head) tell = true;
            if (prop === "maybeSingle" || prop === "single") enkelt = true;
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  return {
    supabase: {
      from: (t: string) => bygg(t),
      rpc: async () => ({ data: 0, error: null }),
      auth: {
        getUser: async () => ({ data: { user: { id: "u1" } } }),
        signOut: async () => ({}),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        getSession: async () => ({ data: { session: null } }),
      },
    },
  };
});

import { routeTree } from "@/routeTree.gen";

async function vis(sti: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [sti] }),
    context: { queryClient: new QueryClient() },
  });
  await router.load();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("nye sider rendrer med innhold", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => cleanup());

  it("oversikt viser kommende frister", async () => {
    await vis("/app");
    await waitFor(() => expect(screen.getByText("Kommende frister")).toBeInTheDocument());
    expect(screen.getAllByText(/MVA-melding|Skattemelding|Årsregnskap/).length).toBeGreaterThan(0);
  });

  it("navigasjonen har de nye sidene", async () => {
    await vis("/app");
    await waitFor(() => expect(screen.getByText("Integrasjoner")).toBeInTheDocument());
    for (const t of ["Forslag fra AI", "Årsregnskap", "Frister"])
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
  });

  it("integrasjoner viser alle åtte tjenester og ingen valgt leverandør", async () => {
    await vis("/app/integrasjoner");
    await waitFor(() => expect(screen.getByText("E-faktura (EHF / Peppol)")).toBeInTheDocument());
    for (const t of [
      "MVA-melding",
      "A-melding",
      "Årsregnskap",
      "Skattemelding for næringsdrivende",
      "Betalingsfiler (pain.001)",
    ]) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Ikke valgt").length).toBe(8);
  });

  it("frister viser MVA, a-melding og skattemelding for et AS med ansatte-uavhengig basis", async () => {
    await vis("/app/frister");
    await waitFor(() =>
      expect(screen.getByText("Skattemelding for aksjeselskap")).toBeInTheDocument(),
    );
    expect(screen.getByText("Aksjonærregisteroppgave")).toBeInTheDocument();
  });

  it("årsregnskap viser sjekkliste og nøkkeltall", async () => {
    await vis("/app/aarsregnskap");
    await waitFor(() => expect(screen.getByText("Balansen går i null")).toBeInTheDocument());
    expect(
      await screen.findByText("Årsberetning er skrevet og styret har signert"),
    ).toBeInTheDocument();
  });

  it("forslag viser agentens forslag med kontonavn og godkjenning", async () => {
    await vis("/app/forslag");
    await waitFor(() => expect(screen.getByText("Programvare: Microsoft 365")).toBeInTheDocument());
    expect(await screen.findByText("Programvare")).toBeInTheDocument();
    const knapp = screen.getByRole("button", { name: /Godkjenn og bokfør/ });
    expect(knapp).toBeEnabled();
  });

  it("mva viser innsendingspanel", async () => {
    await vis("/app/mva");
    await waitFor(() => expect(screen.getByText("Innsending")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Send til Skatteetaten/ })).toBeInTheDocument();
  });
});
