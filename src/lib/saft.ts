/** SAF-T Financial (Norge, versjon 1.30) – eksport av hovedbok, kontoplan og reskontro. */

type Konto = { number: string; name: string };
type Part = { id: string; navn: string; org_nr: string | null };
type SLinje = { konto: string; debet: number; kredit: number; mva_kode: string | null; tekst: string | null };
type SBilag = { id: string; bilagsnr: number | null; dato: string; beskrivelse: string; lines: SLinje[] };

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n2 = (n: number) => n.toFixed(2);

/** Standard gruppering (SAF-T Grouping Category) – første to siffer av NS 4102-konto. */
const gruppe = (k: string) => k.slice(0, 2);

export function byggSaft(d: {
  company: { name: string; org_nr: string | null; adresse: string | null; postnr: string | null; poststed: string | null };
  fra: string;
  til: string;
  accounts: Konto[];
  customers: Part[];
  suppliers: Part[];
  vouchers: SBilag[];
  inngaende?: Record<string, number>;
}): string {
  const saldo = new Map<string, number>();
  let tD = 0;
  let tK = 0;
  for (const v of d.vouchers)
    for (const l of v.lines) {
      saldo.set(l.konto, (saldo.get(l.konto) ?? 0) + l.debet - l.kredit);
      tD += l.debet;
      tK += l.kredit;
    }
  const antLinjer = d.vouchers.reduce((s, v) => s + v.lines.length, 0);
  const part = (p: Part, tag: string, idTag: string) => `
      <${tag}>
        <RegistrationNumber>${esc(p.org_nr)}</RegistrationNumber>
        <Name>${esc(p.navn)}</Name>
        <Address><City>-</City><Country>NO</Country></Address>
        <${idTag}>${esc(p.id)}</${idTag}>
      </${tag}>`;

  const kontoer = d.accounts
    .map((a) => {
      const ib = d.inngaende?.[a.number] ?? 0;
      const ub = ib + (saldo.get(a.number) ?? 0);
      return `
      <Account>
        <AccountID>${esc(a.number)}</AccountID>
        <AccountDescription>${esc(a.name)}</AccountDescription>
        <GroupingCategory>RF-1167</GroupingCategory>
        <GroupingCode>${gruppe(a.number)}</GroupingCode>
        <AccountType>GL</AccountType>
        ${ib >= 0 ? `<OpeningDebitBalance>${n2(ib)}</OpeningDebitBalance>` : `<OpeningCreditBalance>${n2(-ib)}</OpeningCreditBalance>`}
        ${ub >= 0 ? `<ClosingDebitBalance>${n2(ub)}</ClosingDebitBalance>` : `<ClosingCreditBalance>${n2(-ub)}</ClosingCreditBalance>`}
      </Account>`;
    })
    .join("");

  const bilag = d.vouchers
    .map(
      (v) => `
        <Transaction>
          <TransactionID>${v.bilagsnr ?? ""}</TransactionID>
          <Period>${Number(v.dato.slice(5, 7))}</Period>
          <PeriodYear>${v.dato.slice(0, 4)}</PeriodYear>
          <TransactionDate>${v.dato}</TransactionDate>
          <Description>${esc(v.beskrivelse)}</Description>
          <SystemEntryDate>${v.dato}</SystemEntryDate>
          <GLPostingDate>${v.dato}</GLPostingDate>${v.lines
            .map(
              (l, i) => `
          <Line>
            <RecordID>${i + 1}</RecordID>
            <AccountID>${esc(l.konto)}</AccountID>
            <Description>${esc(l.tekst ?? v.beskrivelse)}</Description>
            ${l.debet ? `<DebitAmount><Amount>${n2(l.debet)}</Amount></DebitAmount>` : `<CreditAmount><Amount>${n2(l.kredit)}</Amount></CreditAmount>`}${
              l.mva_kode ? `
            <TaxInformation><TaxType>MVA</TaxType><TaxCode>${esc(l.mva_kode)}</TaxCode></TaxInformation>` : ""
            }
          </Line>`,
            )
            .join("")}
        </Transaction>`,
    )
    .join("");

  const totalD = `<TotalDebit>${n2(tD)}</TotalDebit>`;
  const totalK = `<TotalCredit>${n2(tK)}</TotalCredit>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:StandardAuditFile-Taxation-Financial:NO">
  <Header>
    <AuditFileVersion>1.30</AuditFileVersion>
    <AuditFileCountry>NO</AuditFileCountry>
    <AuditFileDateCreated>${new Date().toISOString().slice(0, 10)}</AuditFileDateCreated>
    <SoftwareCompanyName>Fjordbok</SoftwareCompanyName>
    <SoftwareID>Fjordbok</SoftwareID>
    <SoftwareVersion>1.0</SoftwareVersion>
    <Company>
      <RegistrationNumber>${esc(d.company.org_nr)}</RegistrationNumber>
      <Name>${esc(d.company.name)}</Name>
      <Address><StreetName>${esc(d.company.adresse)}</StreetName><City>${esc(d.company.poststed)}</City><PostalCode>${esc(d.company.postnr)}</PostalCode><Country>NO</Country></Address>
    </Company>
    <DefaultCurrencyCode>NOK</DefaultCurrencyCode>
    <SelectionCriteria><SelectionStartDate>${d.fra}</SelectionStartDate><SelectionEndDate>${d.til}</SelectionEndDate></SelectionCriteria>
    <TaxAccountingBasis>A</TaxAccountingBasis>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts>${kontoer}
    </GeneralLedgerAccounts>
    <Customers>${d.customers.map((c) => part(c, "Customer", "CustomerID")).join("")}
    </Customers>
    <Suppliers>${d.suppliers.map((s) => part(s, "Supplier", "SupplierID")).join("")}
    </Suppliers>
    <TaxTable><TaxTableEntry><TaxType>MVA</TaxType><Description>Merverdiavgift</Description></TaxTableEntry></TaxTable>
  </MasterFiles>
  <GeneralLedgerEntries>
    <NumberOfEntries>${d.vouchers.length}</NumberOfEntries>
    <NumberOfLines>${antLinjer}</NumberOfLines>
    ${totalD}
    ${totalK}
    <Journal>
      <JournalID>GL</JournalID>
      <Description>Hovedbok</Description>
      <Type>GL</Type>${bilag}
    </Journal>
  </GeneralLedgerEntries>
</AuditFile>
`;
}
