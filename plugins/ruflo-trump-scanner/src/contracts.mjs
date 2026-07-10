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
// NOTE: do not reintroduce a NAICS-code -> category lookup keyed on the API
// response. USASpending returns 'NAICS Code' as null on contract rows, so any
// such map silently drops every award. Category is derived from which
// per-group query matched -- see NAICS_GROUPS / fetchRecentContracts below.

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

const NAICS_GROUPS = {
  defense: DEFENSE_NAICS,
  medical: MEDICAL_NAICS,
  tech:    TECH_NAICS,
};

async function queryAwards(naicsCodes, startDate, endDate) {
  const payload = {
    filters: {
      time_period: [{ start_date: startDate, end_date: endDate }],
      award_type_codes: ['A', 'B', 'C', 'D'],
      award_amounts: [{ lower_bound: ALERT_MIN_AMOUNT }],
      naics_codes: { require: naicsCodes },
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
  return (await resp.json()).results ?? [];
}

/**
 * fetchRecentContracts(daysBack = 7)
 *
 * Two bugs made this return zero awards on every call since creation:
 *
 * 1. daysBack defaulted to 1 (and scan-loop passed 1 explicitly). USASpending
 *    lags: a 24h window returns nothing, a 7d window returns results. Verified
 *    1d -> 0, 7d -> 100 raw rows.
 *
 * 2. Category was derived from the row's 'NAICS Code' field, which the API
 *    returns as NULL on every contract row -- even when naics_codes is used as
 *    a server-side filter, so the rows genuinely are in-sector. That made
 *    NAICS_CATEGORY[naicsCode] undefined and `if (!category) continue` discard
 *    100% of results. This zeroed the poller at ANY window.
 *
 * Fixed by querying once per sector group, so category comes from which query
 * matched rather than from a field the API won't populate. Costs 3 requests
 * per poll (every 900s). Results are de-duplicated by Award ID, since a single
 * award can match more than one group.
 */
export async function fetchRecentContracts(daysBack = 7) {
  const end   = new Date();
  const start = new Date(Date.now() - daysBack * 86_400_000);
  const fmt   = d => d.toISOString().split('T')[0];

  const results = [];
  const seenIds = new Set();

  for (const [category, naicsCodes] of Object.entries(NAICS_GROUPS)) {
    const rows = await queryAwards(naicsCodes, fmt(start), fmt(end));

    for (const row of rows) {
      const recipientName = String(row['Recipient Name'] ?? '');
      const awardAmount   = Number(row['Award Amount']   ?? 0);
      const awardId       = String(row['Award ID']       ?? '');

      if (!awardId || seenIds.has(awardId)) continue;   // same award, two groups
      if (isLargeCap(recipientName)) continue;          // already priced in
      seenIds.add(awardId);

      results.push({
        awardId,
        recipientName,
        awardAmount,
        awardDate:       String(row['Start Date']                     ?? ''),
        description:     String(row['Description']                    ?? '').slice(0, 300),
        // Nullable server-side; retained when present, never used for routing.
        naicsCode:       String(row['NAICS Code']                     ?? ''),
        naicsDescription:String(row['NAICS Description']              ?? ''),
        recipientState:  String(row['Place of Performance State Code']?? ''),
        agencyName:      String(row['Awarding Agency']                ?? ''),
        category,
        alert: awardAmount >= ALERT_MIN_AMOUNT,
      });
    }
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
