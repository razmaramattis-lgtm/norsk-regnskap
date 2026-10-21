import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Midlertidig lenke til en fil i bilagsarkivet (gyldig i 10 minutter). */
export function useSignertUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signert-url", path],
    enabled: !!path,
    staleTime: 8 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("bilag").createSignedUrl(path!, 600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Viser PDF eller bilde direkte i siden, med lenke for å åpne i ny fane. */
export function DokumentViser({
  path,
  mime,
  filnavn,
  className = "",
}: {
  path: string;
  mime: string | null;
  filnavn: string;
  className?: string;
}) {
  const { data: url, isLoading, error } = useSignertUrl(path);
  const erPdf = mime === "application/pdf" || filnavn.toLowerCase().endsWith(".pdf");
  const erBilde = mime?.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/i.test(filnavn);
  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-lg border bg-muted/40 ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{filnavn}</span>
        </span>
        {url && (
          <Button size="sm" variant="ghost" asChild>
            <a href={url} target="_blank" rel="noreferrer"><ExternalLink /> Åpne</a>
          </Button>
        )}
      </div>
      <div className="relative min-h-[420px] flex-1">
        {isLoading ? (
          <div className="absolute inset-0 animate-pulse bg-muted" />
        ) : error || !url ? (
          <div className="p-6 text-sm text-destructive">Kunne ikke hente filen.</div>
        ) : erPdf ? (
          <iframe title={filnavn} src={`${url}#view=FitH`} className="absolute inset-0 h-full w-full bg-white" />
        ) : erBilde ? (
          <div className="absolute inset-0 overflow-auto p-3">
            <img src={url} alt={filnavn} className="mx-auto max-w-full rounded shadow-paper" />
          </div>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Forhåndsvisning støttes ikke for denne filtypen. Bruk «Åpne».</div>
        )}
      </div>
    </div>
  );
}
