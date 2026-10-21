import {
  Archive,
  Inbox,
  Upload,
  Briefcase,
  BookOpen,
  Bot,
  Building,
  Building2,
  CalendarCheck,
  CalendarClock,
  FileInput,
  FileText,
  FileSpreadsheet,
  History,
  Landmark,
  LayoutDashboard,
  ListTree,
  Package,
  Plug,
  Receipt,
  BarChart3,
  ScrollText,
  Truck,
  Users,
  Wallet,
  Scale,
} from "lucide-react";

/** Sidemenyen og søket (⌘K) bruker samme liste, så en ny side trenger bare én oppføring. */
export const grupper = [
  { tittel: "", lenker: [{ to: "/app", label: "Oversikt", icon: LayoutDashboard, exact: true }] },
  {
    tittel: "Salg",
    lenker: [
      { to: "/app/fakturaer", label: "Fakturaer", icon: FileText },
      { to: "/app/kunder", label: "Kunder", icon: Users },
      { to: "/app/varer", label: "Varer og tjenester", icon: Package },
    ],
  },
  {
    tittel: "Kjøp",
    lenker: [
      { to: "/app/leverandorfakturaer", label: "Inngående fakturaer", icon: FileInput },
      { to: "/app/leverandorer", label: "Leverandører", icon: Truck },
    ],
  },
  {
    tittel: "Regnskap",
    lenker: [
      { to: "/app/mottak", label: "Bilagsmottak", icon: Inbox },
      { to: "/app/bilag", label: "Bilag", icon: BookOpen },
      { to: "/app/bank", label: "Bank", icon: Landmark },
      { to: "/app/lonn", label: "Lønn", icon: Wallet },
      { to: "/app/arkiv", label: "Bilagsarkiv", icon: Archive },
      { to: "/app/anleggsmidler", label: "Anleggsmidler", icon: Building },
      { to: "/app/forslag", label: "Forslag fra AI", icon: Bot },
    ],
  },
  {
    tittel: "Rapporter",
    lenker: [
      { to: "/app/klienter", label: "Klientoversikt", icon: Briefcase },
      { to: "/app/maanedsavslutning", label: "Månedsavslutning", icon: CalendarCheck },
      { to: "/app/mva", label: "MVA-melding", icon: Receipt },
      { to: "/app/aarsregnskap", label: "Årsregnskap", icon: FileSpreadsheet },
      { to: "/app/frister", label: "Frister", icon: CalendarClock },
      { to: "/app/rapporter", label: "Resultat og balanse", icon: BarChart3 },
      { to: "/app/hovedbok", label: "Hovedbok", icon: ScrollText },
      { to: "/app/reskontro", label: "Reskontro", icon: Scale },
    ],
  },
  {
    tittel: "Innstillinger",
    lenker: [
      { to: "/app/aarsavslutning", label: "Perioder og årsoppgjør", icon: CalendarCheck },
      { to: "/app/kontoplan", label: "Kontoplan", icon: ListTree },
      { to: "/app/import", label: "Import fra annet system", icon: Upload },
      { to: "/app/integrasjoner", label: "Integrasjoner", icon: Plug },
      { to: "/app/logg", label: "Revisjonslogg", icon: History },
      { to: "/app/firma", label: "Firma og brukere", icon: Building2 },
    ],
  },
] as const;
