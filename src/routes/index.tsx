import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Landmark, Lock, Receipt, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fjordbok – åpent regnskap for ENK og AS" },
      { name: "description", content: "Dobbel bokføring etter bokføringsloven, NS 4102-kontoplan, faktura med KID og MVA-melding." },
      { property: "og:title", content: "Fjordbok – åpent regnskap for ENK og AS" },
      { property: "og:description", content: "Dobbel bokføring, faktura med KID og MVA-melding for norske bedrifter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const funksjoner = [
  { i: BookOpen, t: "Dobbel bokføring", d: "NS 4102-kontoplan, fortløpende bilagsnummer og balansekontroll." },
  { i: Lock, t: "Låste bilag", d: "Bokførte bilag kan ikke endres – kun korrigeres, slik bokføringsloven krever." },
  { i: FileText, t: "Faktura med KID", d: "Fakturaer med mod10-KID, flere mva-satser og automatisk postering." },
  { i: Receipt, t: "MVA-melding", d: "Grunnlag og avgift per SAF-T-kode for hver termin." },
  { i: Landmark, t: "Resultat og balanse", d: "Resultatregnskap, balanse og saldobalanse i sanntid." },
  { i: Users, t: "Regnskapsfører-tilgang", d: "Flere brukere og firmaer med roller per firma." },
];

function Index() {
  return (
    <div className="min-h-screen">
      <header className="bg-fjord text-ink-foreground">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-serif text-xl">Fjordbok</span>
          <Button asChild variant="secondary" size="sm">
            <Link to="/auth">Logg inn</Link>
          </Button>
        </nav>
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-16">
          <p className="mb-4 text-sm uppercase tracking-[0.2em] text-sidebar-primary">Enkeltpersonforetak · Aksjeselskap</p>
          <h1 className="max-w-3xl text-5xl leading-tight md:text-6xl">Regnskap som følger bokføringsloven – helt fra første bilag.</h1>
          <p className="mt-6 max-w-xl text-lg opacity-80">
            Fjordbok er et åpent regnskapssystem for norske bedrifter. Før bilag, send faktura med KID og lever MVA-melding uten regneark.
          </p>
          <div className="mt-10 flex gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/auth">Kom i gang gratis</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-px overflow-hidden px-6 py-20 md:grid-cols-3">
        {funksjoner.map(({ i: Icon, t, d }) => (
          <div key={t} className="border-t border-border py-8 pr-8">
            <Icon className="mb-4 h-5 w-5 text-primary" />
            <h3 className="text-xl">{t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </main>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Basert på åpen kildekode (AGPL-3.0) fra Accounted, tilpasset norsk marked.
      </footer>
    </div>
  );
}
