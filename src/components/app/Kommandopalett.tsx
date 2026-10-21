import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Building2, FilePlus2, Landmark, PenLine } from "lucide-react";
import { useCompany } from "@/lib/company";
import { grupper } from "@/components/app/navigasjon";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

const handlinger = [
  { to: "/app/bilag/ny", label: "Registrer bilag", icon: PenLine },
  { to: "/app/fakturaer", label: "Ny faktura", icon: FilePlus2 },
  { to: "/app/bank", label: "Importer kontoutskrift", icon: Landmark },
] as const;

/** Søk og hurtigvalg med ⌘K / Ctrl+K: gå til side, start en oppgave eller bytt firma. */
export function Kommandopalett({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const { company, companies, setActive, canWrite } = useCompany();

  useEffect(() => {
    const tast = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", tast);
    return () => window.removeEventListener("keydown", tast);
  }, [open, onOpenChange]);

  const gå = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Søk etter side, oppgave eller firma …" />
      <CommandList>
        <CommandEmpty>Ingen treff.</CommandEmpty>
        {canWrite && (
          <CommandGroup heading="Gjør noe">
            {handlinger.map(({ to, label, icon: Icon }) => (
              <CommandItem key={label} value={label} onSelect={() => gå(to)}>
                <Icon className="mr-2 h-4 w-4" /> {label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {grupper.map((g) => (
          <CommandGroup key={g.tittel || "start"} heading={g.tittel || "Start"}>
            {g.lenker.map(({ to, label, icon: Icon }) => (
              <CommandItem key={to} value={`${g.tittel} ${label}`} onSelect={() => gå(to)}>
                <Icon className="mr-2 h-4 w-4" /> {label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {companies.length > 1 && (
          <CommandGroup heading="Bytt firma">
            {companies.map((m) => (
              <CommandItem
                key={m.company.id}
                value={`firma ${m.company.name} ${m.company.org_nr ?? ""}`}
                onSelect={() => {
                  setActive(m.company.id);
                  onOpenChange(false);
                }}
              >
                <Building2 className="mr-2 h-4 w-4" /> {m.company.name}
                {m.company.id === company.id && <CommandShortcut>Aktivt</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
