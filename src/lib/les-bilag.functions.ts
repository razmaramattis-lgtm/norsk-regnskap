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
      ? { type: "file", file: { filename: doc.filnavn, file_data: url } }
      : { type: "image_url", image_url: { url } };

    const svar = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Du leser norske kvitteringer og fakturaer. Hent ut feltene nøyaktig som de står. Datoer som ÅÅÅÅ-MM-DD, beløp som tall i kroner. Bruk null når et felt ikke finnes. beskrivelse: kort tekst på norsk, f.eks. 'Telenor mobil oktober'." },
          { role: "user", content: [{ type: "text", text: "Hent ut fakturadata fra dette bilaget." }, innhold] },
        ],
        tools: [{
          type: "function",
          function: {
            name: "bilag",
            parameters: {
              type: "object",
              properties: {
                leverandor: { type: ["string", "null"] },
                fakturanr: { type: ["string", "null"] },
                fakturadato: { type: ["string", "null"] },
                forfallsdato: { type: ["string", "null"] },
                belop_inkl_mva: { type: ["number", "null"] },
                mva_belop: { type: ["number", "null"] },
                mva_sats: { type: ["number", "null"], description: "25, 15, 12 eller 0" },
                kid: { type: ["string", "null"] },
                beskrivelse: { type: ["string", "null"] },
                type: { type: ["string", "null"], enum: ["kjop", "salg", null] },
              },
              required: ["leverandor", "fakturanr", "fakturadato", "forfallsdato", "belop_inkl_mva", "mva_belop", "mva_sats", "kid", "beskrivelse", "type"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "bilag" } },
      }),
    });
    if (svar.status === 429) throw new Error("For mange forespørsler. Prøv igjen om litt.");
    if (svar.status === 402) throw new Error("KI-kreditten er brukt opp.");
    if (!svar.ok) throw new Error("Kunne ikke lese bilaget");
    const j = await svar.json();
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Fant ingen fakturadata i dokumentet");
    return JSON.parse(args) as LestBilag;
  });
