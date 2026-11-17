// Token Radar — value model (lib/model.ts).
//
// One sealed snapshot in, one ranked board out. Every number below is derived
// from the snapshot's own figures; no protocol name is ever special-cased.
//
// A protocol is PRE-TOKEN when its record carries no token at all: mcap_usd,
// gecko_id and symbol are all null. The board ranks every pre-token protocol
// in the snapshot except centralised exchanges (an exchange's token already
// trades; a CEX row would be a launch that already happened).
//
// Two tiers, both ranked by the same implied value:
//   tier A "watchlist / early" — the clean launch candidates. The watchlist
//     (TVL >= floor, no token) is the floor, never the ceiling: tier A also
//     carries every clean pre-token protocol below the floor.
//   tier B "flagged" — pre-token records that are a wrapped, staked or
//     bridged product of a token that already trades (Bridge, Liquid Staking,
//     Liquid Restaking, Restaked BTC, Cross Chain Bridge, Canonical Bridge
//     categories, or a name carrying the whole word wrapped / staked /
//     staking). They are NOT ranked: no discount makes a wrapped product's
//     "launch" honest — WBTC at any rank would be a launch that already
//     happened. The dashboard lists them apart, unranked, with the reason,
//     so the radar shows its work and the separation is visible.
//
// Implied value, per protocol:
//
//   peer     = median mcap/TVL of token-bearing peers in the same category
//              (needs >= 3 peers, else the whole-market median), clamped
//              to [0.05, 0.60]. A category's own market is the comparable.
//   growth   = clamp(change_7d, -50, +100); growthMult = 1 + growth * 0.004
//              (a +100% week lifts value 40%, a -50% week cuts it 20%)
//   maturity = 0.70 + 0.30 * min(age_days, 1095) / 1095, where age_days is
//              listed_at -> as_of (unknown listed_at counts as 365 days).
//              A protocol that has run longer with no token has survived
//              longer without one; it is worth more, not less.
//   chains   = 1 + 0.03 * min(chains.length - 1, 5)  (up to 1.15)
//   implied  = round(tvl_usd * peer * growthMult * maturity * chains)
//
// Farm plans are built from the same record (category, chains, TVL, age):
// parameterised templates, never slogans, never per-protocol text. Every
// step states what to do, roughly what it costs and how long it takes.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model constants, stated in the dashboard's methodology panel. */
export interface ModelConstants {
  peer_min_peers: number;
  peer_floor: number;
  peer_cap: number;
  growth_floor: number;
  growth_cap: number;
  growth_weight: number;
  maturity_floor: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max_bonus: number;
}

export const MODEL: ModelConstants = {
  peer_min_peers: 3,
  peer_floor: 0.05,
  peer_cap: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  growth_weight: 0.004,
  maturity_floor: 0.7,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.03,
  chain_max_bonus: 5,
};

export const MODEL_VERSION = 'radar-2';

/** Categories whose pre-token record is a wrapped / staked / bridged product. */
const FLAGGED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

/** A name ending in a version marker is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A whole word wrapped / staked / staking in the name. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** Names beginning with an exchange's name. */
const EXCHANGE_PREFIX =
  /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

export type Tier = 'watchlist' | 'early';

/** One flagged protocol: listed apart, unranked, with the reason. */
export interface FlaggedRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  flag_reason: string;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  tier: Tier;
  flag_reason: string | null;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    peer_multiple: number;
    peer_count: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  tier: Tier;
  flag_reason: string | null;
  peer_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  farm_steps: string[];
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  flagged_size: number;
  live_size: number;
  peer_global_median: number;
  rows: RadarRow[];
  live: LiveRow[];
  flagged: FlaggedRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Whether a protocol's record carries no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whole days from listed_at to as_of, clamped at zero; null when unknown. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Median of a sorted list of numbers. */
function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  return n % 2 === 1
    ? sorted[(n - 1) / 2]!
    : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/**
 * The category comparables: for every category, the median mcap/TVL of its
 * token-bearing protocols. A category with fewer than peer_min_peers peers
 * falls back to the whole-market median. Both are clamped to [floor, cap].
 */
export function peerMultiples(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { byCategory: Map<string, number>; peerCount: Map<string, number>; global: number } {
  const ratiosByCat = new Map<string, number[]>();
  const allRatios: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const r = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(r) || r <= 0) continue;
    allRatios.push(r);
    const key = p.category ?? '';
    const list = ratiosByCat.get(key) ?? [];
    list.push(r);
    ratiosByCat.set(key, list);
  }
  allRatios.sort((a, b) => a - b);
  const clamp = (v: number): number =>
    Math.min(model.peer_cap, Math.max(model.peer_floor, v));
  const global = clamp(median(allRatios));
  const byCategory = new Map<string, number>();
  const peerCount = new Map<string, number>();
  for (const [cat, list] of ratiosByCat) {
    list.sort((a, b) => a - b);
    peerCount.set(cat, list.length);
    byCategory.set(
      cat,
      list.length >= model.peer_min_peers ? clamp(median(list)) : global,
    );
  }
  return { byCategory, peerCount, global };
}

/** Which tier a pre-token protocol belongs to, and why when it is flagged. */
export function tierOf(p: SnapshotProtocol): { tier: Tier | 'flagged'; reason: string | null } {
  if (FLAGGED_CATEGORIES.has(p.category ?? '')) {
    return {
      tier: 'flagged',
      reason: `${p.category ?? 'Bridged product'}: a wrapped, staked or bridged product of a token that already trades`,
    };
  }
  if (WRAPPED_WORD.test(p.name)) {
    return {
      tier: 'flagged',
      reason: 'Name carries wrapped / staked / staking: a product of a token that already trades',
    };
  }
  return { tier: 'early', reason: null };
}

/** Whether the board ranks this pre-token protocol at all: clean launch
 * candidates only — no CEX, no versioned pool, no exchange product, and no
 * wrapped / staked / bridged product of a token that already trades. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category === 'CEX') return false;
  if (VERSIONED.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  if (tierOf(p).tier === 'flagged') return false;
  return true;
}

/** The implied value and every multiplier behind it. */
export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  peers: { byCategory: Map<string, number>; peerCount: Map<string, number>; global: number },
  model: ModelConstants = MODEL,
): {
  implied: number;
  peer: number;
  peerCount: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainMult: number;
  age: number | null;
} {
  const cat = p.category ?? '';
  const peer = peers.byCategory.get(cat) ?? peers.global;
  const peerCount = peers.peerCount.get(cat) ?? 0;
  const rawGrowth = typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : 0;
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  // growth_weight is per percentage point: +100% lifts value 40%, -50% cuts it 20%.
  const growthMultiplier = 1 + growthPct * model.growth_weight;
  const age = ageDays(asOf, p.listed_at);
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (1 - model.maturity_floor) *
      (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days);
  const chainMult =
    1 + model.chain_step * Math.min(Math.max(p.chains.length - 1, 0), model.chain_max_bonus);
  const implied = Math.max(
    1,
    Math.round(p.tvl_usd * peer * growthMultiplier * maturityMult * chainMult),
  );
  return {
    implied,
    peer: round4(peer),
    peerCount,
    growthPct: round4(growthPct),
    growthMult: round4(growthMultiplier),
    maturityMult: round4(maturityMult),
    chainMult: round4(chainMult),
    age,
  };
}

/** Capital for one farm position, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** Hold window in days, from the protocol's age: younger needs longer proof. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/**
 * The one category-shaped action of the plan. It is chosen from the
 * protocol's DefiLlama category only — no name is ever matched.
 */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateralized'))
    return `Supply $${capital} of USDC to ${name} on ${chain} as a lender and keep the position open, so the deposit is counted in the protocol's lending totals.`;
  if (c.includes('dex') || c.includes('leveraged farm') || c.includes('liquidity manager'))
    return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open through at least one weekly fee cycle.`;
  if (c.includes('bridge'))
    return `Bridge $${capital} of USDC into ${chain} through ${name}, then use the bridged funds in an app on that chain instead of bridging straight back.`;
  if (c.includes('staking') || c.includes('restak'))
    return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token in the same wallet.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options'))
    return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged trade, then close it only after a week.`;
  if (c.includes('prediction'))
    return `Fund ${name} with $${capital} and place one position on a market that settles after at least a week, so the activity is not a same-day round trip.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk'))
    return `Deposit $${capital} into the ${name} vault on ${chain} and hold the vault shares; do not hop between vaults week to week.`;
  if (c.includes('stable') || c.includes('anchor'))
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the wallet that did the mint.`;
  if (c.includes('rwa'))
    return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} through ${name} and hold it for the full qualifying window.`;
  if (c.includes('insurance'))
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the full qualifying window.`;
  if (c.includes('yield aggregator') || c.includes('yield') || c.includes('farm'))
    return `Deposit $${capital} of USDC into ${name}'s main vault on ${chain} and leave it compounding for the full qualifying window.`;
  if (c.includes('chain'))
    return `Use $${capital} of ${name} on ${chain} for a real transaction — a swap or a transfer — and repeat it weekly from the same wallet.`;
  if (c.includes('payment') || c.includes('card'))
    return `Spend $${capital} through ${name} on ${chain} in at least two separate weeks, keeping the same wallet for both.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open for the full qualifying window.`;
}

/** Trim a step to the gate's 20..600 characters, keeping it a whole sentence. */
function stepText(s: string): string {
  let t = s.trim().replace(/\s+/g, ' ');
  if (t.length > 600) t = `${t.slice(0, 597).replace(/\s+\S*$/, '')}...`;
  if (t.length < 20) t = `${t} Keep a written log of the wallet, the dates and every transaction.`;
  return t;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): string[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 150 ? 8 : 4;
  const steps: string[] = [];
  steps.push(
    stepText(
      `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper, never in a screenshot or a chat. Cost: under $3 of gas for the first transaction. Time: 5 minutes.`,
    ),
  );
  steps.push(
    stepText(
      `${actionFor(p, capital, chain)} Cost: $${capital} of capital and about $${gas} of gas. Time: 15 minutes to set up.`,
    ),
  );
  steps.push(
    stepText(
      `Do one qualifying action each week from the same wallet — a deposit, a borrow, a swap or a vote on ${chain} — so the activity reads as a real user, not a one-off deposit. Cost: about $2 of gas a week. Time: 10 minutes a week.`,
    ),
  );
  steps.push(
    stepText(
      `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot window; withdrawing early is the most common way a farm scores nothing. Cost: the $${capital} stays in the position. Time: ${hold} days.`,
    ),
  );
  steps.push(
    stepText(
      `Before you claim anything, open the protocol's own points or rewards page from the link it publishes itself, and never pay a fee to claim: a real distribution never asks for one. Cost: no fee to check. Time: 10 minutes.`,
    ),
  );
  steps.push(
    stepText(
      `Write the wallet address, the dates and every transaction hash in a farm log, so you can repeat the position on the next protocol or unwind it cleanly. Cost: nothing but the log. Time: 5 minutes.`,
    ),
  );
  return steps;
}

/** The ranked board: every clean pre-token protocol — watchlist plus early. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const peers = peerMultiples(snapshot, model);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const tier: Tier = snapshot.watchlist.includes(p.slug) ? 'watchlist' : 'early';
    const v = impliedValue(p, snapshot.as_of, peers, model);
    return { p, tier, v };
  });
  scored.sort(
    (a, b) =>
      b.v.implied - a.v.implied ||
      (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0),
  );
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    tier: s.tier,
    flag_reason: null,
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      peer_multiple: s.v.peer,
      peer_count: s.v.peerCount,
      growth_pct: s.v.growthPct,
      growth_multiplier: s.v.growthMult,
      maturity_multiplier: s.v.maturityMult,
      chain_multiplier: s.v.chainMult,
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age),
  }));
}

/** Live-token protocols, by market cap: the market's own values, never ranked. */
export function liveRows(snapshot: Snapshot, limit = 24): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, limit)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The flagged protocols, unranked, by TVL: the wrapped / staked / bridged
 * products the board refuses to rank as launches, with the reason each. */
export function flaggedRows(snapshot: Snapshot): FlaggedRow[] {
  return snapshot.protocols
    .filter((p) => isPreToken(p) && !isRankable(p) && tierOf(p).tier === 'flagged')
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      flag_reason: tierOf(p).reason ?? 'Flagged product',
    }));
}

export function buildRadar(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const peers = peerMultiples(snapshot, model);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => r.tier === 'early').length,
    flagged_size: flaggedRows(snapshot).length,
    live_size: live.length,
    peer_global_median: peers.global,
    rows: board.map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      change_7d: r.change_7d,
      listed_at: r.listed_at,
      age_days: r.age_days,
      implied_value_usd: r.implied_value_usd,
      tier: r.tier,
      flag_reason: r.flag_reason,
      peer_multiple: r.model.peer_multiple,
      growth_multiplier: r.model.growth_multiplier,
      maturity_multiplier: r.model.maturity_multiplier,
      chain_multiplier: r.model.chain_multiplier,
      farm_steps: r.farm_steps,
    })),
    live,
    flagged: flaggedRows(snapshot),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape scored. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SnapshotError('snapshot.json is not a JSON object');
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) {
    throw new SnapshotError('snapshot.json has no as_of date');
  }
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) {
    throw new SnapshotError('snapshot.json has no floor_usd');
  }
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) {
    throw new SnapshotError('snapshot.json has no watchlist of slugs');
  }
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    }
    const p = v as Record<string, unknown>;
    if (
      typeof p.slug !== 'string' ||
      typeof p.name !== 'string' ||
      typeof p.tvl_usd !== 'number' ||
      !Number.isFinite(p.tvl_usd)
    ) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains)
        ? p.chains.filter((c): c is string => typeof c === 'string')
        : [],
      tvl_usd: p.tvl_usd,
      change_7d:
        typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd:
        typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) {
    return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  }
  if (board.length < 100) return `the board holds ${board.length} rows, under the 100-row floor`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  }
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `row ${i + 1} outranks row ${i} on implied value`;
    }
  }
  if (
    board.length >= 2 &&
    board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd
  ) {
    return `all ${board.length} rows share the same implied value`;
  }
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) {
      return `${r.slug} has ${r.farm_steps.length} farm steps`;
    }
    for (const s of r.farm_steps) {
      if (s.trim().length < 20 || s.trim().length > 600) {
        return `${r.slug} has a farm step of ${s.trim().length} characters`;
      }
    }
  }
  return null;
}

/** data.js: the dashboard's whole dataset as one script, no fetch, no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
