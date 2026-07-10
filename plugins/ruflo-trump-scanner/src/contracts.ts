/**
 * USASpending.gov contract watcher.
 *
 * Polls the public awards API for new contract awards to small/mid-cap
 * defense, medical, and tech contractor companies above a dollar threshold.
 * No API key required — USASpending is fully open.
 */

export interface ContractAward {
  awardId: string;
  recipientName: string;
  awardAmount: number;
  awardDate: string;
  description: string;
  naicsCode: string;
  naicsDescription: string;
  recipientState: string;
  agencyName: string;
  category: 'defense' | 'medical' | 'tech' | 'other';
  marketCapEstimate: 'small' | 'mid' | 'unknown';
  alert: boolean;
}

// NAICS codes for target sectors
const DEFENSE_NAICS = [
  '336411', // Aircraft Manufacturing
  '336414', // Guided Missile & Space Vehicle Manufacturing
  '332992', // Small Arms Ammunition Manufacturing
  '332994', // Small Arms Manufacturing
  '541330', // Engineering Services (defense)
  '541519', // Other Computer Related Services (defense IT)
  '336992', // Military Armored Vehicle Manufacturing
  '488190', // Other Support Activities for Air Transportation
];

const MEDICAL_NAICS = [
  '325412', // Pharmaceutical Preparation Manufacturing
  '339112', // Surgical & Medical Instrument Manufacturing
  '339113', // Surgical Appliance & Supplies Manufacturing
  '621111', // Medical Laboratory Services
  '325414', // Biological Product Manufacturing
  '334510', // Electromedical Equipment Manufacturing
];

const TECH_NAICS = [
  '541511', // Custom Computer Programming Services
  '541512', // Computer Systems Design Services
  '541513', // Computer Facilities Management Services
  '541519', // Other Computer Related Services
  '518210', // Data Processing & Hosting
  '334111', // Electronic Computer Manufacturing
  '334412', // Printed Circuit Assembly Manufacturing
];

const NAICS_TO_CATEGORY: Record<string, ContractAward['category']> = {
  ...Object.fromEntries(DEFENSE_NAICS.map(n => [n, 'defense' as const])),
  ...Object.fromEntries(MEDICAL_NAICS.map(n => [n, 'medical' as const])),
  ...Object.fromEntries(TECH_NAICS.map(n => [n, 'tech' as const])),
};

// Small cap: < $2B revenue proxy (we use award size as a signal)
// Alert threshold: $50M+
const ALERT_MIN_AMOUNT = 50_000_000;

// Known large-cap recipients to exclude (Fortune 500)
const LARGE_CAP_EXCLUDE = [
  'lockheed martin', 'boeing', 'raytheon', 'northrop grumman', 'general dynamics',
  'l3harris', 'bae systems', 'leidos', 'saic', 'booz allen', 'accenture',
  'microsoft', 'amazon', 'google', 'ibm', 'oracle', 'dell', 'hp',
  'pfizer', 'johnson & johnson', 'abbvie', 'merck', 'unitedhealth',
];

function classifyMarketCap(recipientName: string, awardAmount: number): ContractAward['marketCapEstimate'] {
  const lower = recipientName.toLowerCase();
  if (LARGE_CAP_EXCLUDE.some(name => lower.includes(name))) return 'unknown'; // filter out
  // Heuristic: if their single award is $50M-$500M, likely small/mid
  if (awardAmount >= 50_000_000 && awardAmount <= 2_000_000_000) return 'small';
  if (awardAmount > 2_000_000_000 && awardAmount <= 10_000_000_000) return 'mid';
  return 'unknown';
}

function classifyNaics(naicsCode: string): ContractAward['category'] {
  return NAICS_TO_CATEGORY[naicsCode] ?? 'other';
}

export async function fetchRecentContracts(daysBack = 1): Promise<ContractAward[]> {
  const endDate = new Date();
  const startDate = new Date(Date.now() - daysBack * 86400_000);
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const allNaics = [...DEFENSE_NAICS, ...MEDICAL_NAICS, ...TECH_NAICS];
  const results: ContractAward[] = [];

  // USASpending v2 Awards Search — no auth required
  const payload = {
    filters: {
      time_period: [{ start_date: fmt(startDate), end_date: fmt(endDate) }],
      award_type_codes: ['A', 'B', 'C', 'D'], // contracts only
      award_amounts: [{ lower_bound: ALERT_MIN_AMOUNT }],
      naics_codes: { require: allNaics },
    },
    fields: [
      'Award ID', 'Recipient Name', 'Award Amount', 'Start Date',
      'Description', 'NAICS Code', 'NAICS Description',
      'recipient_location_state_name', 'Awarding Agency',
    ],
    page: 1,
    limit: 100,
    sort: 'Award Amount',
    order: 'desc',
  };

  const resp = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    throw new Error(`USASpending API error: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as { results: Record<string, unknown>[] };

  for (const row of data.results ?? []) {
    const recipientName = String(row['Recipient Name'] ?? '');
    const awardAmount = Number(row['Award Amount'] ?? 0);
    const naicsCode = String(row['NAICS Code'] ?? '');
    const category = classifyNaics(naicsCode);
    const marketCapEstimate = classifyMarketCap(recipientName, awardAmount);

    // Skip large caps and irrelevant sectors
    if (marketCapEstimate === 'unknown') continue;
    if (category === 'other') continue;

    results.push({
      awardId: String(row['Award ID'] ?? ''),
      recipientName,
      awardAmount,
      awardDate: String(row['Start Date'] ?? ''),
      description: String(row['Description'] ?? '').slice(0, 300),
      naicsCode,
      naicsDescription: String(row['NAICS Description'] ?? ''),
      recipientState: String(row['recipient_location_state_name'] ?? ''),
      agencyName: String(row['Awarding Agency'] ?? ''),
      category,
      marketCapEstimate,
      alert: awardAmount >= ALERT_MIN_AMOUNT,
    });
  }

  return results;
}

export function formatContractAlert(award: ContractAward): string {
  const amt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(award.awardAmount);
  const emoji = award.category === 'defense' ? '🛡️' : award.category === 'medical' ? '💊' : '💻';

  return [
    `${emoji} CONTRACT ALERT — ${award.category.toUpperCase()} [${award.marketCapEstimate.toUpperCase()} CAP]`,
    `Recipient: ${award.recipientName}`,
    `Amount: ${amt}`,
    `Agency: ${award.agencyName}`,
    `Date: ${award.awardDate}`,
    `State: ${award.recipientState}`,
    `NAICS: ${award.naicsCode} — ${award.naicsDescription}`,
    ``,
    `Description: ${award.description}`,
    ``,
    `Search "${award.recipientName}" on Finviz/Bloomberg to find the ticker.`,
    `Win posted to USASpending — probably not priced in yet.`,
  ].join('\n');
}
