/**
 * USASpending.gov contract watcher.
 * Uses the v2 spending_by_award API — no auth required.
 *
 * Field name fix: USASpending returns camelCase/snake_case internal names
 * when you request specific fields. We use the documented internal field
 * names from the v2 API, not the display labels.
 */

const ALERT_MIN_AMOUNT = 50_000_000;

// NAICS codes for target sectors
const DEFENSE_NAICS  = ['336411','336414','332992','332994','541330','336992'];
const MEDICAL_NAICS  = ['325412','339112','339113','325414','334510'];
const TECH_NAICS     = ['541511','541512','541513','541519','518210'];
const ALL_NAICS      = [...DEFENSE_NAICS, ...MEDICAL_NAICS, ...TECH_NAICS];

const NAICS_CATEGORY = {
  ...Object.fromEntries(DEFENSE_NAICS.map(n => [n, 'defense'])),
  ...Object.fromEntries(MEDICAL_NAICS.map(n => [n, 'medical'])),
  ...Object.fromEntries(TECH_NAICS.map(n => [n, 'tech'])),
};

const LARGE_CAP_EXCLUDE = [
  'lockheed martin','boeing','raytheon','northrop grumman','general dynamics',
  'l3harris','bae systems','leidos','saic','booz allen','accenture',
  'microsoft','amazon','google','ibm','oracle','dell',
  'pfizer','johnson & johnson','abbvie','merck','unitedhealth',
];

function isLargeCap(name) {
  const lower = name.toLowerCase();
  return LARGE_CAP_EXCLUDE.some(n => lower.includes(n));
}

export async function fetchRecentContracts(daysBack = 1) {
  const end   = new Date();
  const start = new Date(Date.now() - daysBack * 86_400_000);
  const fmt   = d => d.toISOString().split('T')[0];

  // Correct v2 API field names (snake_case, matching USASpending docs)
  const payload = {
    filters: {
      time_period: [{ start_date: fmt(start), end_date: fmt(end) }],
      award_type_codes: ['A', 'B', 'C', 'D'],
      award_amounts: [{ lower_bound: ALERT_MIN_AMOUNT }],
      naics_codes: { require: ALL_NAICS },
    },
    fields: [
      'Award ID',
      'Recipient Name',
      'Award Amount',
      'Start Date',
      'Description',
      'NAICS Code',
      'NAICS Description',
      'Place of Performance State Code',
      'Awarding Agency',
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

  if (!resp.ok) throw new Error(`USASpending ${resp.status}: ${resp.statusText}`);

  const data = await resp.json();
  const results = [];

  for (const row of data.results ?? []) {
    const recipientName = String(row['Recipient Name'] ?? '');
    const awardAmount   = Number(row['Award Amount']   ?? 0);
    const naicsCode     = String(row['NAICS Code']     ?? '');
    const category      = NAICS_CATEGORY[naicsCode];

    if (!category) continue;              // not a target sector
    if (isLargeCap(recipientName)) continue; // already priced in

    results.push({
      awardId:         String(row['Award ID']                       ?? ''),
      recipientName,
      awardAmount,
      awardDate:       String(row['Start Date']                     ?? ''),
      description:     String(row['Description']                    ?? '').slice(0, 300),
      naicsCode,
      naicsDescription:String(row['NAICS Description']             ?? ''),
      recipientState:  String(row['Place of Performance State Code']?? ''),
      agencyName:      String(row['Awarding Agency']               ?? ''),
      category,
      alert: awardAmount >= ALERT_MIN_AMOUNT,
    });
  }

  return results;
}

export function formatContractAlert(award) {
  const amt   = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(award.awardAmount);
  const emoji = award.category === 'defense' ? '🛡️' : award.category === 'medical' ? '💊' : '💻';

  return [
    `${emoji} CONTRACT ALERT — ${award.category.toUpperCase()} [SMALL/MID CAP]`,
    `Recipient : ${award.recipientName}`,
    `Amount    : ${amt}`,
    `Agency    : ${award.agencyName}`,
    `Date      : ${award.awardDate}`,
    `State     : ${award.recipientState}`,
    `NAICS     : ${award.naicsCode} — ${award.naicsDescription}`,
    ``,
    `${award.description}`,
    ``,
    `Search "${award.recipientName}" on Finviz to find the ticker.`,
    `Win on USASpending — likely not priced in yet.`,
  ].join('\n');
}
