-- Nummerintegritet: et fakturanummer eller bilagsnummer kan aldri brukes to ganger, tellerne kan ikke settes
-- tilbake, og samme leverandørfaktura kan ikke registreres to ganger.

-- Tellerne i companies kan bare gå fremover (en administrator kunne ellers sette dem tilbake via API-et).
CREATE OR REPLACE FUNCTION public.vakt_nummerteller() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.neste_fakturanr < OLD.neste_fakturanr THEN
    RAISE EXCEPTION 'Neste fakturanummer kan ikke settes lavere (% → %). Et fakturanummer kan bare brukes én gang.', OLD.neste_fakturanr, NEW.neste_fakturanr;
  END IF;
  IF NEW.neste_bilagsnr < OLD.neste_bilagsnr THEN
    RAISE EXCEPTION 'Neste bilagsnummer kan ikke settes lavere (% → %). Bilagsnummer er fortløpende og brukes bare én gang.', OLD.neste_bilagsnr, NEW.neste_bilagsnr;
  END IF;
  -- Startnummer kan velges fritt (f.eks. fortsette serien fra Fiken), men bare før første faktura/bilag.
  -- Etterpå går tellerne kun ett steg om gangen, så serien blir uten hull.
  IF NEW.neste_fakturanr > OLD.neste_fakturanr + 1
     AND EXISTS (SELECT 1 FROM public.invoices WHERE company_id = NEW.id AND fakturanr IS NOT NULL) THEN
    RAISE EXCEPTION 'Fakturanummer kan ikke hoppes over når fakturaer allerede er sendt. Serien må være fortløpende.';
  END IF;
  IF NEW.neste_bilagsnr > OLD.neste_bilagsnr + 1
     AND EXISTS (SELECT 1 FROM public.vouchers WHERE company_id = NEW.id AND bilagsnr IS NOT NULL) THEN
    RAISE EXCEPTION 'Bilagsnummer kan ikke hoppes over når bilag allerede er bokført. Serien må være fortløpende.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vakt_nummerteller ON public.companies;
CREATE TRIGGER vakt_nummerteller BEFORE UPDATE OF neste_fakturanr, neste_bilagsnr ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.vakt_nummerteller();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.invoices WHERE fakturanr IS NOT NULL GROUP BY company_id, fakturanr HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Det finnes allerede fakturaer med samme fakturanummer. Rett dem før migrasjonen kjøres: SELECT company_id, fakturanr FROM invoices GROUP BY 1,2 HAVING count(*) > 1';
  END IF;
  IF EXISTS (SELECT 1 FROM public.supplier_invoices WHERE nullif(btrim(fakturanr), '') IS NOT NULL
             GROUP BY company_id, supplier_id, lower(btrim(fakturanr)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Samme leverandørfaktura er registrert flere ganger. Slett duplikatene før migrasjonen kjøres.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_unikt_fakturanr ON public.invoices (company_id, fakturanr) WHERE fakturanr IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_invoices_unik_per_leverandor
  ON public.supplier_invoices (company_id, supplier_id, lower(btrim(fakturanr)))
  WHERE nullif(btrim(fakturanr), '') IS NOT NULL;

-- Tydelig melding når samme leverandørfaktura registreres igjen (indeksen over er selve garantien)
CREATE OR REPLACE FUNCTION public.vakt_leverandorfaktura() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE _n text;
BEGIN
  IF nullif(btrim(NEW.fakturanr), '') IS NULL THEN RETURN NEW; END IF;
  SELECT s.navn INTO _n FROM public.supplier_invoices i JOIN public.suppliers s ON s.id = i.supplier_id
  WHERE i.company_id = NEW.company_id AND i.supplier_id = NEW.supplier_id AND i.id <> NEW.id
    AND lower(btrim(i.fakturanr)) = lower(btrim(NEW.fakturanr));
  IF FOUND THEN
    RAISE EXCEPTION 'Faktura % fra % er allerede registrert.', btrim(NEW.fakturanr), _n USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vakt_leverandorfaktura ON public.supplier_invoices;
CREATE TRIGGER vakt_leverandorfaktura BEFORE INSERT OR UPDATE OF fakturanr, supplier_id ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.vakt_leverandorfaktura();

-- Samme fil (samme SHA-256) skal ikke arkiveres to ganger i samme firma; da ville kvitteringen kunne bokføres dobbelt.
CREATE UNIQUE INDEX IF NOT EXISTS documents_unik_fil ON public.documents (company_id, sha256) WHERE sha256 IS NOT NULL;

-- Bilagsmottak: notat og tidspunkt for når dokumentet ble behandlet
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS notat text CHECK (notat IS NULL OR char_length(notat) <= 500);
