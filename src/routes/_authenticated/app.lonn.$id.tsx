import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Printer, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useCompany } from "@/lib/company";
import { dato, formatOrgNr, kr } from "@/lib/format";
import { nesteVirkedag } from "@/lib/frister";
import {
  AGA_SONER,
  LONNSARTER,
  ameldingSummer,
  beregnAnsatt,
  lonnsart,
  over60IFerieaaret,
  postBelop,
  type Post,
} from "@/lib/lonn";
import { PageHeader, Panel, Empty, theadCls, selectCls } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmployees } from "@/components/app/hooks";

export const Route = createFileRoute("/_authenticated/app/lonn/$id")({
  head: () => ({ meta: [{ title: "Lønnskjøring – Fjordbok" }] }),
  component: Kjoring,
});

type EditPost = { lonnsart: string; antall: string; belop: string };
type Rad = {
  employee_id: string;
  navn: string;
  timelonn: number;
  trekkmetode: "prosent" | "tabell";
  trekkPst: number;
  tabelltrekk: string;
  otpPst: number;
  over60: boolean;
  poster: EditPost[];
};
/** Lagret post i payroll_lines.poster. Kategori og konto følger med, så book_payroll kan føre trekk og godtgjørelser. */
type LagretPost = Post & { navn: string; kategori: string; konto: string | null; amelding: string };

const tall = (s: string) => Number((s || "0").replace(/\s/g, "").replace(",", "."));

function Kjoring() {
  const { id } = Route.useParams();
  const { company } = useCompany();
  const { data: ansatte = [] } = useEmployees();
  const qc = useQueryClient();
  const nav = useNavigate();
  const aga = AGA_SONER[company.aga_sone] ?? AGA_SONER["1"]!;
  const { data: run } = useQuery({
    queryKey: ["run", id],
    queryFn: async () =>
      (await supabase.from("payroll_runs").select("*, payroll_lines(*, employees(navn, kontonummer, stilling))").eq("id", id).single()).data,
  });
  const [periode, setPeriode] = useState("");
  const [utb, setUtb] = useState("");
  const [halvt, setHalvt] = useState(false);
  const [rader, setRader] = useState<Rad[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!run || !ansatte.length) return;
    setPeriode(run.periode);
    setUtb(run.utbetalingsdato);
    setHalvt(run.halvt_trekk);
    const aar = Number(run.periode.slice(0, 4));
    setRader(
      ansatte
        .filter((a) => a.aktiv)
        .map((a) => {
          const l = run.payroll_lines.find((x) => x.employee_id === a.id);
          const lagret = (l?.poster as LagretPost[] | undefined) ?? [];
          const poster: EditPost[] = lagret.length
            ? lagret.map((p) => ({ lonnsart: p.lonnsart, antall: p.antall ? String(p.antall) : "", belop: String(p.belop) }))
            : a.lonnstype === "maaned"
              ? [{ lonnsart: "fastlonn", antall: "", belop: String(a.maanedslonn) }]
              : [{ lonnsart: "timelonn", antall: l ? String(l.timer) : "", belop: "" }];
          return {
            employee_id: a.id,
            navn: a.navn,
            timelonn: Number(a.timelonn),
            trekkmetode: a.trekkmetode === "tabell" ? "tabell" : "prosent",
            trekkPst: Number(a.skattetrekk_prosent),
            tabelltrekk: l && a.trekkmetode === "tabell" && !run.halvt_trekk ? String(l.skattetrekk) : String(a.tabelltrekk ?? 0),
            otpPst: Number(a.otp_prosent),
            over60: over60IFerieaaret(a.fodselsdato, aar),
            poster,
          };
        }),
    );
  }, [run, ansatte]);

  if (!run) return <Empty>Laster …</Empty>;
  const laast = run.status !== "utkast";

  const beregnet = rader.map((r) => {
    const poster: LagretPost[] = r.poster
      .filter((p) => lonnsart(p.lonnsart))
      .map((p) => {
        const a = lonnsart(p.lonnsart)!;
        const antall = tall(p.antall);
        return {
          lonnsart: a.id,
          navn: a.navn,
          kategori: a.kategori,
          konto: a.konto ?? null,
          amelding: a.amelding,
          antall,
          sats: a.faktor ? r.timelonn * a.faktor : 0,
          belop: postBelop({ lonnsart: a.id, antall, belop: tall(p.belop) }, r.timelonn),
        };
      })
      .filter((p) => p.belop !== 0);
    const b = beregnAnsatt({
      poster,
      trekkmetode: r.trekkmetode,
      skattetrekkProsent: r.trekkPst,
      tabelltrekk: tall(r.tabelltrekk),
      halvtTrekk: halvt,
      feriepengesats: Number(company.feriepengesats),
      over60: r.over60,
      otpProsent: r.otpPst,
      agaSats: aga.sats,
    });
    return { r, poster, b };
  });
  const sum = (k: keyof (typeof beregnet)[number]["b"]) => beregnet.reduce((s, x) => s + x.b[k], 0);

  async function lagre(bokfor: boolean) {
    setBusy(true);
    try {
      const { error } = await supabase.from("payroll_runs").update({ periode, utbetalingsdato: utb, halvt_trekk: halvt }).eq("id", id);
      if (error) throw error;
      await supabase.from("payroll_lines").delete().eq("run_id", id);
      const linjer = beregnet.filter((x) => x.poster.length);
      const { error: e2 } = await supabase.from("payroll_lines").insert(
        linjer.map(({ r, poster, b }) => ({
          run_id: id,
          company_id: company.id,
          employee_id: r.employee_id,
          timer: poster.filter((p) => p.lonnsart === "timelonn").reduce((s, p) => s + p.antall, 0),
          brutto: b.kontant,
          tillegg: 0,
          naturalytelse: b.natural,
          godtgjorelse: b.godtgjorelse,
          trekk: b.trekk,
          skattetrekk: b.skattetrekk,
          feriepenger: b.feriepenger,
          otp: b.otp,
          aga: b.aga,
          netto: b.netto,
          poster: poster as unknown as Json,
        })),
      );
      if (e2) throw e2;
      if (bokfor) {
        const { error: e3 } = await supabase.rpc("book_payroll", { _run: id });
        if (e3) throw e3;
        toast.success("Lønnen er bokført");
      } else toast.success("Lagret");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const setRad = (i: number, f: (r: Rad) => Rad) => setRader((rs) => rs.map((x, j) => (j === i ? f(x) : x)));
  const harTabell = rader.some((r) => r.trekkmetode === "tabell");

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={`Lønn ${run.periode}`}
          sub={`Arbeidsgiveravgift ${aga.navn}: ${aga.sats} % · feriepenger ${Number(company.feriepengesats)} %`}
          actions={
            laast ? (
              <>
                <Button variant="outline" onClick={() => window.print()}><Printer /> Lønnsslipper</Button>
                {run.voucher_id && (
                  <Button variant="ghost" asChild>
                    <Link to="/app/bilag/$id" params={{ id: run.voucher_id }}>Se bilag</Link>
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="ghost"
                onClick={async () => {
                  await supabase.from("payroll_runs").delete().eq("id", id);
                  qc.invalidateQueries();
                  nav({ to: "/app/lonn" });
                }}
              >
                Slett
              </Button>
            )
          }
        />
        {laast ? (
          <Bokfort run={run} agaSats={aga.sats} agaNavn={aga.navn} />
        ) : (
          <>
            <Panel className="mb-6 flex flex-wrap items-end gap-4 p-4">
              <div className="space-y-1.5"><Label>Periode</Label><Input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Utbetalingsdato</Label><Input type="date" value={utb} onChange={(e) => setUtb(e.target.value)} /></div>
              {harTabell && (
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={halvt} onChange={(e) => setHalvt(e.target.checked)} />
                  Halvt trekk (vanligvis november eller desember, for ansatte med tabelltrekk)
                </label>
              )}
            </Panel>
            <div className="space-y-4">
              {beregnet.map(({ r, b }, i) => (
                <Panel key={r.employee_id} className="p-5">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-lg font-medium">{r.navn}</h2>
                    <span className="text-xs text-muted-foreground">
                      {r.trekkmetode === "tabell" ? "Tabelltrekk" : `Prosenttrekk ${r.trekkPst} %`}
                      {r.timelonn ? ` · timelønn ${kr(r.timelonn)}` : ""}
                      {r.over60 ? " · 60+ (ekstra feriepenger)" : ""}
                    </span>
                  </div>
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="space-y-2">
                      {r.poster.map((p, k) => {
                        const a = lonnsart(p.lonnsart);
                        const setP = (f: Partial<EditPost>) => setRad(i, (x) => ({ ...x, poster: x.poster.map((y, n) => (n === k ? { ...y, ...f } : y)) }));
                        return (
                          <div key={k} className="grid grid-cols-[minmax(0,1fr)_90px_130px_36px] items-center gap-2">
                            <select className={`${selectCls} w-full`} value={p.lonnsart} onChange={(e) => setP({ lonnsart: e.target.value })}>
                              {(["kontant", "natural", "godtgjorelse", "trekk"] as const).map((kat) => (
                                <optgroup key={kat} label={{ kontant: "Lønn", natural: "Naturalytelser", godtgjorelse: "Trekkfrie godtgjørelser", trekk: "Trekk i lønn" }[kat]}>
                                  {LONNSARTER.filter((l) => l.kategori === kat).map((l) => <option key={l.id} value={l.id}>{l.navn}</option>)}
                                </optgroup>
                              ))}
                            </select>
                            {a?.faktor ? (
                              <>
                                <Input className="num" placeholder="Timer" value={p.antall} onChange={(e) => setP({ antall: e.target.value })} />
                                <span className="num px-2 text-right text-sm">{kr(postBelop({ lonnsart: a.id, antall: tall(p.antall), belop: 0 }, r.timelonn))}</span>
                              </>
                            ) : (
                              <>
                                <span />
                                <Input className="num" placeholder="Beløp" value={p.belop} onChange={(e) => setP({ belop: e.target.value })} />
                              </>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => setRad(i, (x) => ({ ...x, poster: x.poster.filter((_, n) => n !== k) }))}><Trash2 /></Button>
                          </div>
                        );
                      })}
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <Button variant="ghost" size="sm" onClick={() => setRad(i, (x) => ({ ...x, poster: [...x.poster, { lonnsart: "bonus", antall: "", belop: "" }] }))}>
                          <Plus /> Legg til lønnsart
                        </Button>
                        {r.trekkmetode === "tabell" && (
                          <label className="flex items-center gap-2 text-sm">
                            Trekk fra tabellen
                            <Input className="num w-28" value={r.tabelltrekk} onChange={(e) => setRad(i, (x) => ({ ...x, tabelltrekk: e.target.value }))} />
                          </label>
                        )}
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-y-1 rounded-md bg-muted/50 p-3 text-sm">
                      <dt>Bruttolønn</dt><dd className="num">{kr(b.kontant)}</dd>
                      {b.natural > 0 && <><dt>Naturalytelser</dt><dd className="num">{kr(b.natural)}</dd></>}
                      <dt>Forskuddstrekk</dt><dd className="num">−{kr(b.skattetrekk)}</dd>
                      {b.trekk > 0 && <><dt>Trekk i lønn</dt><dd className="num">−{kr(b.trekk)}</dd></>}
                      {b.godtgjorelse > 0 && <><dt>Godtgjørelser</dt><dd className="num">{kr(b.godtgjorelse)}</dd></>}
                      <dt className="border-t pt-1 font-semibold">Utbetales</dt><dd className="num border-t pt-1 font-semibold">{kr(b.netto)}</dd>
                      <dt className="pt-2 text-muted-foreground">Feriepenger</dt><dd className="num pt-2 text-muted-foreground">{kr(b.feriepenger)}</dd>
                      <dt className="text-muted-foreground">OTP</dt><dd className="num text-muted-foreground">{kr(b.otp)}</dd>
                      <dt className="text-muted-foreground">AGA</dt><dd className="num text-muted-foreground">{kr(b.aga)}</dd>
                    </dl>
                  </div>
                </Panel>
              ))}
            </div>
            <Panel className="mt-6 grid gap-4 p-5 text-sm sm:grid-cols-3 lg:grid-cols-6">
              {([
                ["Brutto", sum("kontant")],
                ["Forskuddstrekk", sum("skattetrekk")],
                ["Utbetales", sum("netto")],
                ["Feriepenger", sum("feriepenger")],
                ["OTP", sum("otp")],
                ["Arbeidsgiveravgift", sum("aga")],
              ] as const).map(([t, v]) => (
                <div key={t}><div className="text-xs uppercase text-muted-foreground">{t}</div><div className="num mt-1 text-left text-lg">{kr(v)}</div></div>
              ))}
            </Panel>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => lagre(false)}>Lagre</Button>
              <Button disabled={busy || sum("kontant") + sum("natural") <= 0} onClick={() => lagre(true)}>Bokfør lønn</Button>
            </div>
          </>
        )}
      </div>
      {laast && <Lonnsslipper run={run} />}
    </>
  );
}

/** Bokført kjøring med linjer og ansatte, slik den hentes over. */
type Kjøring = {
  periode: string;
  utbetalingsdato: string;
  payroll_lines: {
    id: string;
    brutto: number;
    tillegg: number;
    naturalytelse: number;
    godtgjorelse: number;
    trekk: number;
    skattetrekk: number;
    feriepenger: number;
    otp: number;
    aga: number;
    netto: number;
    poster: Json;
    employees: { navn: string; kontonummer: string | null; stilling: string | null } | null;
  }[];
};

/** Oversikt etter bokføring, med grunnlaget for a-meldingen. */
function Bokfort({ run, agaSats, agaNavn }: { run: Kjøring; agaSats: number; agaNavn: string }) {
  const n = (v: unknown) => Number(v ?? 0);
  const alle = run.payroll_lines.flatMap((l) => (l.poster as unknown as Post[]) ?? []);
  const [y, m] = run.utbetalingsdato.split("-").map(Number) as [number, number];
  const frist = nesteVirkedag(m === 12 ? `${y + 1}-01-05` : `${y}-${String(m + 1).padStart(2, "0")}-05`);
  const agaGrunnlag = run.payroll_lines.reduce((s, l) => s + n(l.brutto) + n(l.tillegg) + n(l.naturalytelse) + n(l.feriepenger) + n(l.otp), 0);
  return (
    <>
      <Panel className="mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={theadCls}>
            <tr><th className="px-3 py-3">Ansatt</th><th className="px-3 py-3 text-right">Brutto</th><th className="px-3 py-3 text-right">Naturalytelser</th><th className="px-3 py-3 text-right">Forskuddstrekk</th><th className="px-3 py-3 text-right">Trekk</th><th className="px-3 py-3 text-right">Godtgjørelser</th><th className="px-3 py-3 text-right">Utbetalt</th><th className="px-3 py-3 text-right">Feriepenger</th><th className="px-3 py-3 text-right">OTP</th><th className="px-3 py-3 text-right">AGA</th></tr>
          </thead>
          <tbody>
            {run.payroll_lines.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="px-3 py-2">{l.employees?.navn}</td>
                <td className="num px-3 py-2">{kr(n(l.brutto) + n(l.tillegg))}</td>
                <td className="num px-3 py-2">{kr(l.naturalytelse)}</td>
                <td className="num px-3 py-2">{kr(l.skattetrekk)}</td>
                <td className="num px-3 py-2">{kr(l.trekk)}</td>
                <td className="num px-3 py-2">{kr(l.godtgjorelse)}</td>
                <td className="num px-3 py-2 font-medium">{kr(l.netto)}</td>
                <td className="num px-3 py-2">{kr(l.feriepenger)}</td>
                <td className="num px-3 py-2">{kr(l.otp)}</td>
                <td className="num px-3 py-2">{kr(l.aga)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel className="p-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl">Grunnlag for a-melding</h2>
          <span className="text-sm text-muted-foreground">Frist {dato(frist)}</span>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <table className="w-full text-sm">
            <thead className={theadCls}><tr><th className="py-2">Lønnsbeskrivelse</th><th className="py-2 text-right">Beløp</th></tr></thead>
            <tbody>
              {ameldingSummer(alle).map((s) => (
                <tr key={s.beskrivelse} className="border-b"><td className="py-1.5">{s.navn} <span className="text-xs text-muted-foreground">({s.beskrivelse})</span></td><td className="num py-1.5">{kr(s.belop)}</td></tr>
              ))}
            </tbody>
          </table>
          <dl className="grid grid-cols-2 content-start gap-y-1 text-sm">
            <dt>Forskuddstrekk</dt><dd className="num">{kr(run.payroll_lines.reduce((s, l) => s + n(l.skattetrekk), 0))}</dd>
            <dt>AGA-grunnlag ({agaNavn})</dt><dd className="num">{kr(agaGrunnlag)}</dd>
            <dt>Arbeidsgiveravgift ({agaSats} %)</dt><dd className="num">{kr(run.payroll_lines.reduce((s, l) => s + n(l.aga), 0))}</dd>
          </dl>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Kodene følger a-meldingens kodeliste for lønnsbeskrivelse og bør kontrolleres mot gjeldende versjon. AGA-grunnlaget her inkluderer avsatte feriepenger; i a-meldingen rapporteres feriepengene når de utbetales. Innsending krever Maskinporten og kommer via integrasjonsadapteren.
        </p>
      </Panel>
    </>
  );
}

/** Én lønnsslipp per ansatt, vises bare ved utskrift. */
function Lonnsslipper({ run }: { run: Kjøring }) {
  const { company } = useCompany();
  return (
    <div className="hidden print:block">
      {run.payroll_lines.map((l) => {
        const poster = (l.poster as unknown as (Post & { navn: string; kategori: string })[]) ?? [];
        return (
          <section key={l.id} className="break-after-page p-8 text-sm">
            <div className="flex justify-between">
              <div>
                <div className="font-serif text-xl">{company.name}</div>
                <div className="text-muted-foreground">Org.nr {formatOrgNr(company.org_nr)}</div>
              </div>
              <div className="text-right">
                <div className="font-serif text-xl">Lønnsslipp</div>
                <div>Periode {run.periode} · utbetalt {dato(run.utbetalingsdato)}</div>
              </div>
            </div>
            <div className="mt-6">
              <div className="font-medium">{l.employees?.navn}</div>
              {l.employees?.stilling && <div>{l.employees.stilling}</div>}
              {l.employees?.kontonummer && <div>Kontonr {l.employees.kontonummer}</div>}
            </div>
            <table className="mt-6 w-full">
              <thead className="border-b text-left text-xs uppercase"><tr><th className="py-1">Lønnsart</th><th className="py-1 text-right">Antall</th><th className="py-1 text-right">Sats</th><th className="py-1 text-right">Beløp</th></tr></thead>
              <tbody>
                {poster.map((p, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1">{p.navn}</td>
                    <td className="num py-1">{p.antall || ""}</td>
                    <td className="num py-1">{p.sats ? kr(p.sats) : ""}</td>
                    <td className="num py-1">{p.kategori === "trekk" ? `−${kr(p.belop)}` : kr(p.belop)}</td>
                  </tr>
                ))}
                <tr className="border-b"><td className="py-1">Forskuddstrekk</td><td /><td /><td className="num py-1">−{kr(l.skattetrekk)}</td></tr>
              </tbody>
            </table>
            <dl className="ml-auto mt-4 grid w-72 grid-cols-2 gap-y-1">
              <dt className="font-semibold">Utbetalt</dt><dd className="num font-semibold">{kr(l.netto)}</dd>
              <dt className="text-muted-foreground">Opptjent feriepenger</dt><dd className="num text-muted-foreground">{kr(l.feriepenger)}</dd>
              {Number(l.naturalytelse) > 0 && <><dt className="text-muted-foreground">Naturalytelser (skattepliktig, ikke utbetalt)</dt><dd className="num text-muted-foreground">{kr(l.naturalytelse)}</dd></>}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
