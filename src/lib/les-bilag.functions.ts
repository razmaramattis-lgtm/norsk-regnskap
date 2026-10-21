import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LestBilag = {
  leverandor: string | null;
  fakturanr: string | null;
  fakturadato: string | null;
  forfallsdato: string | null;
  belop_inkl_mva: number | null;
  mva_belop: number | null;
  mva_sats: number | null;
  kid: string | null;
  beskrivelse: string | null;
  type: "kjop" | "salg" | null;
};

/** Leser et dokument i bilagsarkivet med KI og henter ut fakturadata. Brukeren må se over før bokføring. */
export const lesBilag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dokumentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<LestBilag> => {
    const { data: doc, error } = await context.supabase.from("documents").select("path, mime, filnavn").eq("id", data.dokumentId).single();
    if (error || !doc) throw new Error("Fant ikke dokumentet");
    const { data: fil, error: e2 } = await context.supabase.storage.from("bilag").download(doc.path);
    if (e2 || !fil) throw new Error("Kunne ikke hente filen");
    if (fil.size > 15_000_000) throw new Error("Filen er for stor til å leses automatisk");
    const buf = new Uint8Array(await fil.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const mime = doc.mime || (doc.filnavn.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const url = `data:${mime};base64,${btoa(bin)}`;
    const innhold = mime === "application/pdf"
      ? { type: "input_file", filename: doc.filnavn, file_data: url }
      : { type: "input_image", image_url: url };
    const tekstEllerNull = { type: ["string", "null"] };
    const tallEllerNull = { type: ["number", "null"] };

    const svar = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": process.env["LOVABLE_API_KEY"] ?? "", "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: "Du leser norske kvitteringer og fakturaer. Hent ut feltene nøyaktig som de står. Datoer som ÅÅÅÅ-MM-DD, beløp som tall i kroner. Bruk null når et felt ikke finnes. mva_sats er 25, 15, 12 eller 0. type er kjop for utgifter vi har betalt/skal betale, salg for fakturaer vi har sendt. beskrivelse: kort tekst på norsk, f.eks. 'Telenor mobil oktober'.",
        input: [{ role: "user", content: [{ type: "input_text", text: "Hent ut fakturadata fra dette bilaget." }, innhold] }],
        text: {
          format: {
            type: "json_schema",
            name: "bilag",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                leverandor: tekstEllerNull, fakturanr: tekstEllerNull, fakturadato: tekstEllerNull, forfallsdato: tekstEllerNull,
                belop_inkl_mva: tallEllerNull, mva_belop: tallEllerNull, mva_sats: tallEllerNull, kid: tekstEllerNull, beskrivelse: tekstEllerNull,
                type: { type: ["string", "null"], enum: ["kjop", "salg", null] },
              },
              required: ["leverandor", "fakturanr", "fakturadato", "forfallsdato", "belop_inkl_mva", "mva_belop", "mva_sats", "kid", "beskrivelse", "type"],
            },
          },
        },
      }),
    });
    if (svar.status === 429) throw new Error("For mange forespørsler. Prøv igjen om litt.");
    if (svar.status === 402) throw new Error("KI-kreditten er brukt opp.");
    if (svar.status === 403) throw new Error("KI-grensen for arbeidsområdet er nådd. En administrator må heve den.");
    if (!svar.ok || !svar.body) throw new Error("Kunne ikke lese bilaget");
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
        } catch { /* ignorer */ }
      }
    }
    if (!ut) throw new Error("Fant ingen fakturadata i dokumentet");
    return JSON.parse(ut) as LestBilag;
  });
