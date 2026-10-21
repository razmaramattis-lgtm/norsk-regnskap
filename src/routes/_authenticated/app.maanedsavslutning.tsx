import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, TriangleAlert } from "lucide-react";
import { useCompany } from "@/lib/company";
import { dato, idag } from "@/lib/format";
import { maanedsavslutning, type Sjekkpunkt } from "@/lib/klienter";
import { Empty, PageHeader, Panel, StatusPill, selectCls } from "@/components/app/ui";
import { useOversikt } from "@/lib/oversikt";

export const Route = createFileRoute("/_authenticated/app/maanedsavslutning")({
  head: () => ({ meta: [{ title: "Månedsavslutning – Fjordbok" }] }),
  component: Maanedsavslutning,
});

const MAANEDER = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

function Maanedsavslutning() {
  const { company, canWrite } = useCompany();
  const qc = useQueryClient();
  const { data: oversikt = [], isLoading } = useOversikt();
  const na = new Date();
  // Standard: forrige måned, siden det normalt er den som avsluttes
  const forrige = new Date(na.getFullYear(), na.getMonth() - 1, 1);
  const [aar, setAar] = useState(forrige.getFullYear());
  const [maaned, setMaaned] = useState(forrige.getMonth() + 1);
  const o = oversikt.find((x) => x.company_id === company.id);
  const siste = new Date(aar, maaned, 0).getDate();
  const periodeSlutt = `${aar}-${String(maaned).padStart(2, "0")}-${String(siste).padStart(2, "0")}`;
  const punkter = o ? maanedsavslutning(company, o, periodeSlutt) : [];
  const { data: avkrysset = new Map<string, string>() } = useQuery({
    queryKey: ["avkrysning", company.id, periodeSlutt],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maanedsavslutning_avkrysning")
        .select("punkt, kontrollert_at")
        .eq("company_id", company.id)
        .eq("periode", periodeSlutt);
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.punkt, r.kontrollert_at]));
    },
  });
  async function kryss(p: Sjekkpunkt, på: boolean) {
    const { error } = på
      ? await supabase.from("maanedsavslutning_avkrysning").insert({ company_id: company.id, periode: periodeSlutt, punkt: p.id })
      : await supabase
          .from("maanedsavslutning_avkrysning")
          .delete()
          .eq("company_id", company.id)
          .eq("periode", periodeSlutt)
          .eq("punkt", p.id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["avkrysning", company.id, periodeSlutt] });
  }
  const ferdig = (p: Sjekkpunkt) => p.status === "ok" || (p.status === "manuell" && avkrysset.has(p.id));
  const antallFerdig = punkter.filter(ferdig).length;
  const advarsler = punkter.filter((p) => p.status === "advarsel").length;

  return (
    <>
      <PageHeader
        title="Månedsavslutning"
        sub={`${MAANEDER[maaned - 1]} ${aar} · ${company.name}`}
        actions={
          <>
            <select
              className={selectCls}
              value={maaned}
              onChange={(e) => setMaaned(Number(e.target.value))}
              aria-label="Måned"
            >
              {MAANEDER.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className={selectCls}
              value={aar}
              onChange={(e) => setAar(Number(e.target.value))}
              aria-label="År"
            >
              {[na.getFullYear() - 1, na.getFullYear()].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </>
        }
      />
      {isLoading ? (
        <Panel>
          <Empty>Laster …</Empty>
        </Panel>
      ) : !o ? (
        <Panel>
          <Empty>Fant ikke data for firmaet.</Empty>
        </Panel>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <StatusPill tone={advarsler ? "warn" : antallFerdig === punkter.length ? "ok" : "info"}>
              {antallFerdig} av {punkter.length} ferdig
            </StatusPill>
            {advarsler > 0 && (
              <span className="text-muted-foreground">{advarsler} må rettes før avslutning</span>
            )}
          </div>
          <Panel>
            <ul className="divide-y">
              {punkter.map((p) => {
                const klar = ferdig(p);
                return (
                  <li key={p.id} className="flex items-start gap-4 px-5 py-4">
                    <span className="mt-0.5 shrink-0" aria-hidden>
                      {klar ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : p.status === "advarsel" ? (
                        <TriangleAlert className="h-5 w-5 text-destructive" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{p.tittel}</div>
                      <div className="text-sm text-muted-foreground">{p.detalj}</div>
                    </div>
                    {p.status === "manuell" && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          disabled={!canWrite}
                          checked={avkrysset.has(p.id)}
                          onChange={(e) => kryss(p, e.target.checked)}
                        />
                        {avkrysset.has(p.id) ? `Kontrollert ${dato(avkrysset.get(p.id))}` : "Kontrollert"}
                      </label>
                    )}
                    {p.lenke && !klar && (
                      <Link to={p.lenke} className="shrink-0 text-sm text-primary hover:underline">
                        Åpne
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
          <p className="mt-4 text-xs text-muted-foreground">
            De automatiske punktene gjelder status akkurat nå ({idag()}), ikke per månedsslutt:
            transaksjoner og utkast som er registrert etter månedsskiftet telles også. Avkryssing av
            manuelle punkter lagres med hvem som kontrollerte og når. Bruk periodelåsing under Perioder
            og årsoppgjør som sluttsteg.
          </p>
        </>
      )}
    </>
  );
}
