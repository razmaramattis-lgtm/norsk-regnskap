UPDATE public.account_templates SET kun_for = NULL, name = 'Annen egenkapital' WHERE number = '2050';
CREATE OR REPLACE FUNCTION public.handle_new_company() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.company_members (company_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'eier');
  INSERT INTO public.accounts (company_id, number, name, mva_kode)
  SELECT NEW.id, number, name, CASE WHEN NEW.mva_registrert THEN mva_kode ELSE NULL END
  FROM public.account_templates WHERE kun_for IS NULL OR kun_for = NEW.company_type;
  IF NEW.company_type = 'enk' THEN
    UPDATE public.accounts SET name = 'Egenkapital' WHERE company_id = NEW.id AND number = '2050';
  END IF;
  RETURN NEW;
END $$;