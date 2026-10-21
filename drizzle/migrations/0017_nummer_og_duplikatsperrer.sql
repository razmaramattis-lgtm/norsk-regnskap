-- Nummer- og duplikatsperrer: samme fakturanummer skal ikke kunne brukes to ganger
-- hos samme firma (kundefaktura) eller fra samme leverandør (leverandørfaktura).
-- Bilagsnummer og bankimport har allerede unike sperrer fra tidligere migrasjoner.

CREATE UNIQUE INDEX invoices_company_fakturanr_unik
  ON public.invoices (company_id, fakturanr)
  WHERE fakturanr IS NOT NULL;

CREATE UNIQUE INDEX supplier_invoices_company_leverandor_fakturanr_unik
  ON public.supplier_invoices (company_id, supplier_id, fakturanr)
  WHERE fakturanr IS NOT NULL;