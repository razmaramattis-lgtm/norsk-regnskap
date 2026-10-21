import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  anleggsmidler: [
    { id: "m1", navn: "Skriver", saldogruppe: "a", anskaffet: "2025-03-10", anskaffelseskost: 40000, solgt: null, salgssum: null, konto: null },
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
      rpc: async (navn: string) => ({
        data:
          navn === "byraa_oversikt"
            ? [
                {
                  company_id: "c1",
                  ubehandlede_banktransaksjoner: 4,
                  bilagsutkast: 1,
                  ventende_forslag: 1,
                  forfalte_kundefakturaer: 0,
                  forfalt_kundebelop: 0,
                  forfalte_leverandorfakturaer: 0,
                  forfalt_leverandorbelop: 0,
                  har_ansatte: false,
                  siste_bilagsdato: "2026-10-15",
                  siste_bokforte_bilagsdato: "2026-10-15",
                },
              ]
            : 0,
        error: null,
      }),
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

  it("oversikt viser gjøremål fra databasen", async () => {
    await vis("/app");
    await waitFor(() => expect(screen.getByText("Til behandling")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("4 banktransaksjoner å avstemme")).toBeInTheDocument());
    expect(screen.getByText("1 forslag venter på godkjenning")).toBeInTheDocument();
  });

  it("⌘K åpner søket med sider og hurtigvalg", async () => {
    await vis("/app");
    await waitFor(() => expect(screen.getByText("Kommende frister")).toBeInTheDocument());
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() => expect(screen.getByPlaceholderText(/Søk etter side/)).toBeInTheDocument());
    expect(screen.getByText("Registrer bilag", { selector: "[cmdk-item]" })).toBeInTheDocument();
  });

  it("import fra annet system forklarer SAF-T-flyttingen", async () => {
    await vis("/app/import");
    await waitFor(() => expect(screen.getByText("Slik gjør du det")).toBeInTheDocument());
    expect(screen.getByText("Velg SAF-T-fil")).toBeInTheDocument();
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

  it("anleggsmidler viser saldoavskrivning og register", async () => {
    await vis("/app/anleggsmidler");
    await waitFor(() => expect(screen.getByText("Gruppe A Kontormaskiner o.l.")).toBeInTheDocument());
    expect(screen.getByText("Skriver")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Opprett avskrivningsbilag/ })).toBeEnabled();
  });

  it("mva viser fradragskolonne", async () => {
    await vis("/app/mva");
    expect(await screen.findByText("Fradrag")).toBeInTheDocument();
  });

  it("klientoversikt viser firmaet med status og avvik", async () => {
    await vis("/app/klienter");
    expect(await screen.findByText("4 uavstemte banktransaksjoner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Åpne Testfirma AS" })).toBeInTheDocument();
  });

  it("månedsavslutning viser automatiske og manuelle punkter", async () => {
    await vis("/app/maanedsavslutning");
    await waitFor(() => expect(screen.getByText("Alle banktransaksjoner er avstemt")).toBeInTheDocument());
    expect(screen.getByText("4 transaksjoner mangler avstemming.")).toBeInTheDocument();
    expect(screen.getByText("Banksaldo i Fjordbok stemmer med kontoutskriften")).toBeInTheDocument();
  });
});
