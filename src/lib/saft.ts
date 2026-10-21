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
      <nl:${tag}>
        <nl:RegistrationNumber>${esc(p.org_nr)}</nl:RegistrationNumber>
        <nl:Name>${esc(p.navn)}</nl:Name>
        <nl:Address><nl:City>-</nl:City><nl:Country>NO</nl:Country></nl:Address>
        <nl:${idTag}>${esc(p.id)}</nl:${idTag}>
      </nl:${tag}>`;

  const kontoer = d.accounts
    .map((a) => {
      const ib = d.inngaende?.[a.number] ?? 0;
      const ub = ib + (saldo.get(a.number) ?? 0);
      return `
      <nl:Account>
        <nl:AccountID>${esc(a.number)}</nl:AccountID>
        <nl:AccountDescription>${esc(a.name)}</nl:AccountDescription>
        <nl:GroupingCategory>RF-1167</nl:GroupingCategory>
        <nl:GroupingCode>${gruppe(a.number)}</nl:GroupingCode>
        <nl:AccountType>GL</nl:AccountType>
        ${ib >= 0 ? `<nl:OpeningDebitBalance>${n2(ib)}</nl:OpeningDebitBalance>` : `<nl:OpeningCreditBalance>${n2(-ib)}</nl:OpeningCreditBalance>`}
        ${ub >= 0 ? `<nl:ClosingDebitBalance>${n2(ub)}</nl:ClosingDebitBalance>` : `<nl:ClosingCreditBalance>${n2(-ub)}</nl:ClosingCreditBalance>`}
      </nl:Account>`;
    })
    .join("");

  const bilag = d.vouchers
    .map(
      (v) => `
        <nl:Transaction>
          <nl:TransactionID>${v.bilagsnr ?? ""}</nl:TransactionID>
          <nl:Period>${Number(v.dato.slice(5, 7))}</nl:Period>
          <nl:PeriodYear>${v.dato.slice(0, 4)}</nl:PeriodYear>
          <nl:TransactionDate>${v.dato}</nl:TransactionDate>
          <nl:Description>${esc(v.beskrivelse)}</nl:Description>
          <nl:SystemEntryDate>${v.dato}</nl:SystemEntryDate>
          <nl:GLPostingDate>${v.dato}</nl:GLPostingDate>${v.lines
            .map(
              (l, i) => `
          <nl:Line>
            <nl:RecordID>${i + 1}</nl:RecordID>
            <nl:AccountID>${esc(l.konto)}</nl:AccountID>
            <nl:Description>${esc(l.tekst ?? v.beskrivelse)}</nl:Description>
            ${l.debet ? `<nl:DebitAmount><nl:Amount>${n2(l.debet)}</nl:Amount></nl:DebitAmount>` : `<nl:CreditAmount><nl:Amount>${n2(l.kredit)}</nl:Amount></nl:CreditAmount>`}${
              l.mva_kode ? `
            <nl:TaxInformation><nl:TaxType>MVA</nl:TaxType><nl:TaxCode>${esc(l.mva_kode)}</nl:TaxCode></nl:TaxInformation>` : ""
            }
          </nl:Line>`,
            )
            .join("")}
        </nl:Transaction>`,
    )
    .join("");

  const totalD = `<TotalDebit>${n2(tD)}</TotalDebit>`;
  const totalK = `<TotalCredit>${n2(tK)}</TotalCredit>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<nl:AuditFile xmlns:nl="urn:StandardAuditFile-Taxation-Financial:NO">
  <nl:Header>
    <nl:AuditFileVersion>1.30</nl:AuditFileVersion>
    <nl:AuditFileCountry>NO</nl:AuditFileCountry>
    <nl:AuditFileDateCreated>${new Date().toISOString().slice(0, 10)}</nl:AuditFileDateCreated>
    <nl:SoftwareCompanyName>Fjordbok</nl:SoftwareCompanyName>
    <nl:SoftwareID>Fjordbok</nl:SoftwareID>
    <nl:SoftwareVersion>1.0</nl:SoftwareVersion>
    <nl:Company>
      <RegistrationNumber>${esc(d.company.org_nr)}</RegistrationNumber>
      <nl:Name>${esc(d.company.name)}</nl:Name>
      <nl:Address><nl:StreetName>${esc(d.company.adresse)}</nl:StreetName><nl:City>${esc(d.company.poststed)}</nl:City><nl:PostalCode>${esc(d.company.postnr)}</nl:PostalCode><nl:Country>NO</nl:Country></nl:Address>
    </nl:Company>
    <nl:DefaultCurrencyCode>NOK</nl:DefaultCurrencyCode>
    <nl:SelectionCriteria><nl:SelectionStartDate>${d.fra}</nl:SelectionStartDate><nl:SelectionEndDate>${d.til}</nl:SelectionEndDate></nl:SelectionCriteria>
    <nl:TaxAccountingBasis>A</nl:TaxAccountingBasis>
  </nl:Header>
  <nl:MasterFiles>
    <nl:GeneralLedgerAccounts>${kontoer}
    </nl:GeneralLedgerAccounts>
    <nl:Customers>${d.customers.map((c) => part(c, "Customer", "CustomerID")).join("")}
    </nl:Customers>
    <nl:Suppliers>${d.suppliers.map((s) => part(s, "Supplier", "SupplierID")).join("")}
    </nl:Suppliers>
    <nl:TaxTable><nl:TaxTableEntry><nl:TaxType>MVA</nl:TaxType><nl:Description>Merverdiavgift</nl:Description></nl:TaxTableEntry></nl:TaxTable>
  </nl:MasterFiles>
  <nl:GeneralLedgerEntries>
    <nl:NumberOfEntries>${d.vouchers.length}</nl:NumberOfEntries>
    <nl:NumberOfLines>${antLinjer}</nl:NumberOfLines>
    ${totalD}
    ${totalK}
    <nl:Journal>
      <nl:JournalID>GL</nl:JournalID>
      <nl:Description>Hovedbok</nl:Description>
      <nl:Type>GL</nl:Type>${bilag}
    </nl:Journal>
  </nl:GeneralLedgerEntries>
</nl:AuditFile>
`;
}
