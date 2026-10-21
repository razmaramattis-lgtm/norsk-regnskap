import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type KiKontoforslag = {
  type: "kjop" | "salg";
  konto: string;
  kontonavn: string;
  mva_sats: number;
  mva_behandling: string;
  begrunnelse: string;
  sikkerhet: number;
};

/**
 * Foreslår kostnads-/inntektskonto og mva-behandling for et dokument, ut fra bilaget og firmaets kontoplan.
 * Bare et forslag: brukeren ser over og bokfører selv, og `post_voucher` kontrollerer uansett.
 */
export const foreslaaKontoKi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dokumentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<KiKontoforslag> => {
    const sb = context.supabase;
    const { data: doc } = await sb.from("documents").select("company_id, path, mime, filnavn").eq("id", data.dokumentId).single();
    if (!doc) throw new Error("Fant ikke dokumentet");
    const [{ data: firma }, { data: kontoer }, { data: fil }] = await Promise.all([
      sb.from("companies").select("company_type, mva_registrert").eq("id", doc.company_id).single(),
      sb.from("accounts").select("number, name, mva_kode").eq("company_id", doc.company_id).eq("aktiv", true).order("number"),
      sb.storage.from("bilag").download(doc.path),
    ]);
    if (!fil) throw new Error("Kunne ikke hente filen");
    if (fil.size > 15_000_000) throw new Error("Filen er for stor til å leses automatisk");
    const aktuelle = (kontoer ?? []).filter((k) => k.number >= "3000" && k.number < "8000");
    if (!aktuelle.length) throw new Error("Kontoplanen er tom");

    const buf = new Uint8Array(await fil.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const mime = doc.mime || (doc.filnavn.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const url = `data:${mime};base64,${btoa(bin)}`;
    const innhold = mime === "application/pdf"
      ? { type: "input_file", filename: doc.filnavn, file_data: url }
      : { type: "input_image", image_url: url };

    const plan = aktuelle.map((k) => `${k.number} ${k.name}${k.mva_kode ? ` (mva-kode ${k.mva_kode})` : ""}`).join("\n");
    const instruks = [
      "Du er en norsk regnskapsfører. Velg én resultatkonto fra kontoplanen under for bilaget, og riktig mva-behandling etter norske regler (merverdiavgiftsloven).",
      `Firmaet er ${firma?.company_type === "as" ? "et aksjeselskap" : "et enkeltpersonforetak"} og ${firma?.mva_registrert ? "er mva-registrert" : "er IKKE mva-registrert (bruk mva_sats 0)"}.`,
      "mva_sats: 25 (alminnelig), 15 (næringsmidler), 12 (persontransport, overnatting, kino m.m.) eller 0 (ingen fradrag/fritatt/unntatt, f.eks. representasjon, forsikring, husleie uten frivillig registrering, utenlandske tjenester uten norsk mva).",
      "type: kjop for kostnader/innkjøp, salg for inntekter. mva_behandling: kort setning, f.eks. 'Inngående mva 25 % med fradrag'. begrunnelse: én–to setninger på norsk. sikkerhet: 0–1.",
      "Konto MÅ være et nummer fra listen.",
      "",
      "Kontoplan:",
      plan,
    ].join("\n");

    const svar = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": process.env["LOVABLE_API_KEY"] ?? "", "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: instruks,
        input: [{ role: "user", content: [{ type: "input_text", text: "Foreslå konto og mva-behandling for dette bilaget." }, innhold] }],
        text: {
          format: {
            type: "json_schema",
            name: "kontoforslag",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                type: { type: "string", enum: ["kjop", "salg"] },
                konto: { type: "string", enum: aktuelle.map((k) => k.number) },
                mva_sats: { type: "number", enum: [25, 15, 12, 0] },
                mva_behandling: { type: "string" },
                begrunnelse: { type: "string" },
                sikkerhet: { type: "number" },
              },
              required: ["type", "konto", "mva_sats", "mva_behandling", "begrunnelse", "sikkerhet"],
            },
          },
        },
      }),
    });
    if (svar.status === 429) throw new Error("For mange forespørsler. Prøv igjen om litt.");
    if (svar.status === 402) throw new Error("KI-kreditten er brukt opp.");
    if (svar.status === 403) throw new Error("KI-grensen for arbeidsområdet er nådd. En administrator må heve den.");
    if (!svar.ok || !svar.body) throw new Error("Kunne ikke lage forslag");
    const leser = svar.body.getReader();
    const dek = new TextDecoder();
    let rest = "", ut = "";
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      rest += dek.decode(value, { stream: true });
      const linjer = rest.split("\n");
      rest = linjer.pop() ?? "";
      for (const l of linjer) {
        if (!l.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(l.slice(5).trim());
          if (ev.type === "response.output_text.delta") ut += ev.delta;
        } catch { /* ufullstendig linje */ }
      }
    }
    if (!ut) throw new Error("Fikk ikke noe forslag");
    const r = JSON.parse(ut) as Omit<KiKontoforslag, "kontonavn">;
    const k = aktuelle.find((x) => x.number === r.konto);
    if (!k) throw new Error("Forslaget brukte en konto som ikke finnes");
    return { ...r, mva_sats: firma?.mva_registrert ? r.mva_sats : 0, kontonavn: k.name };
  });
