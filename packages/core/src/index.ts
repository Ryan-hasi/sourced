/**
 * @sourcedhq/core — the corroboration primitive.
 *
 * Given a stream of claims from many origins, Sourced tells you how many
 * INDEPENDENT sources corroborate each one, since when, and hands you the
 * receipts. It says "confirmed by sources" — never "the truth".
 *
 * Zero runtime dependencies. Storage, clustering, clock and config are
 * injected. Fail-open by contract (G7): `assess` never throws into the
 * stream it annotates — on any failure claims pass through unlabeled.
 *
 * The honesty guarantees (G1–G7) live in the spec and are enforced by
 * @sourcedhq/conformance. The default config values ARE the contract: they
 * encode the undercount-never-overcount tuning. Loosening them is a
 * conscious act, not a knob to fiddle.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One report of something happening, from one origin. */
export type Claim = {
  /** Stable identity of this report. */
  id: string;
  /** The claim, in words. Event identity is derived from it. */
  title: string;
  /** The source/outlet making it — the unit of independence (G3). */
  origin: string;
  /** When this report was published (ISO 8601). Drives the signal clock (G6). */
  publishedAt: string;
};

export type Signal = "confirmed" | "breaking" | "developing";

/** The corroboration verdict for one claim. Never says "true" (G2). */
export type Verdict = {
  /** Count of DISTINCT independent origins reporting this event. */
  corroboration: number;
  /** The receipts: which OTHER origins reported it (G4). Empty when alone. */
  corroboratingSources: string[];
  /** When the system FIRST saw this event (ISO 8601). */
  firstSeenAt: string;
  /** null for single-origin claims — silence protects credibility (G5). */
  signal: Signal | null;
};

/** An event tracked over time. */
export type StoredEvent = {
  key: string;
  /** Freshest wording seen for the event. */
  title: string;
  /** Distinct origins accumulated across all sightings. */
  origins: string[];
  firstSeenAt: number;
  lastSeenAt: number;
};

export type EventStore = Record<string, StoredEvent>;

/**
 * The one real coupling, injected. Anything durable works: KV, SQLite, a
 * file, memory. Both methods may be sync or async.
 */
export interface Store {
  load(): EventStore | null | undefined | Promise<EventStore | null | undefined>;
  save(store: EventStore): void | Promise<void>;
}

/**
 * Where retired events go instead of vanishing. The working set stays
 * bounded (matching needs a window); the HISTORY is the moat — an archive
 * sink receives every event that leaves the working set, so first-seen
 * timelines are never lost.
 */
export type ArchiveSink = (retired: StoredEvent[]) => void | Promise<void>;

/**
 * Pre-grouped claims that describe the same event, keyed by claim id →
 * list of origins reporting it in this batch. Produced by any clustering
 * (LLM, regex, embeddings, upstream editor) — Sourced only counts.
 */
export type Clusters = Map<string, string[]> | Record<string, string[]>;

export type Config = {
  /** Jaccard similarity gate for merging (G1). */
  mergeSimilarity: number;
  /** Minimum shared meaning-bearing tokens for merging (G1, second gate). */
  minSharedTokens: number;
  /** corroboration ≥ this → "confirmed". */
  confirmedAt: number;
  /** corroboration ≥ this → "developing"/"breaking". */
  corroboratedAt: number;
  /** Published less than this long ago (ms) + corroborated → "breaking". */
  breakingWindowMs: number;
  /** Events unseen this long (ms) leave the working set. */
  eventTtlMs: number;
  /** Working-set cap (most recently seen win). */
  maxEvents: number;
  /** Max receipts returned per verdict. */
  receiptsCap: number;
  /** Number of tokens forming the deterministic event key. */
  keyTokens: number;
  /** Stopwords carrying no event identity. */
  stopwords: ReadonlySet<string>;
};

// Stopwords (EN + DE + FR) — carry no event identity.
const STOP: ReadonlySet<string> = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for",
  "with", "as", "by", "from", "into", "over", "after", "before", "is", "are",
  "was", "were", "be", "been", "has", "have", "had", "will", "would", "can",
  "could", "new", "says", "say", "said", "amid", "its", "his", "her", "their",
  "der", "die", "das", "und", "oder", "von", "zu", "im", "auf", "mit",
  "für", "den", "dem", "des", "ein", "eine", "ist", "sind", "war", "wird",
  "nach", "vor", "über", "als", "sich", "auch", "bei", "aus", "wie", "mehr",
  "le", "la", "les", "un", "une", "des", "du", "de", "à", "au", "aux",
  "et", "ou", "mais", "donc", "car", "ni", "avec", "sur", "dans", "pour",
  "par", "est", "sont", "ont", "fait", "être", "avoir", "nous", "vous",
  "ils", "elles", "ce", "cet", "cette", "ces", "qui", "que", "dont", "où",
  "plus", "pas", "ne", "sans", "tout", "tous", "toute", "toutes",
]);

/**
 * The default tuning IS the honesty contract (undercount, never overcount).
 */
export const DEFAULT_CONFIG: Config = {
  mergeSimilarity: 0.6,
  minSharedTokens: 3,
  confirmedAt: 4,
  corroboratedAt: 2,
  breakingWindowMs: 30 * 60 * 1000,
  eventTtlMs: 36 * 60 * 60 * 1000,
  maxEvents: 400,
  receiptsCap: 6,
  keyTokens: 8,
  stopwords: STOP,
};

export type AssessOptions = {
  clusters?: Clusters;
  store?: Store;
  archive?: ArchiveSink;
  /** Injected clock (epoch ms) — deterministic runs, testable. */
  now?: number;
  config?: Partial<Config>;
};

/** The full signature of the primitive — what conformance suites target. */
export type AssessFn = (
  claims: Claim[],
  options?: AssessOptions,
) => Promise<(Verdict | null)[]>;

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** Title → meaning-bearing tokens (lowercased, no stopwords, ≥3 chars). */
export function tokenize(title: string, stopwords: ReadonlySet<string> = STOP): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9äöüéèàçß\s]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !stopwords.has(t));
}

/** Deterministic event key: sorted top tokens. */
export function keyOf(tokens: string[], keyTokens = DEFAULT_CONFIG.keyTokens): string {
  return Array.from(new Set(tokens)).sort().slice(0, keyTokens).join(" ");
}

function sharedCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const inter = sharedCount(a, b);
  return inter / (a.size + b.size - inter);
}

// ---------------------------------------------------------------------------
// The primitive
// ---------------------------------------------------------------------------

/**
 * Annotate a batch of claims with corroboration verdicts and fold them into
 * the persistent event store.
 *
 * Returns one entry per input claim, in order. `null` means "unassessable"
 * (e.g. a title with no meaning-bearing tokens) — the claim simply passes
 * through unlabeled. On ANY internal failure the whole batch degrades to
 * unlabeled instead of throwing (G7).
 */
export async function assess(
  claims: Claim[],
  options: AssessOptions = {},
): Promise<(Verdict | null)[]> {
  try {
    return await assessInner(claims, options);
  } catch {
    // G7 — fail open, never break the stream we annotate.
    return claims.map(() => null);
  }
}

async function assessInner(
  claims: Claim[],
  options: AssessOptions,
): Promise<(Verdict | null)[]> {
  const cfg: Config = { ...DEFAULT_CONFIG, ...options.config };
  const now = options.now ?? Date.now();
  const clustersOf = (id: string): string[] | undefined => {
    const c = options.clusters;
    if (!c) return undefined;
    return c instanceof Map ? c.get(id) : c[id];
  };

  // Load the working set — best-effort (G7).
  let store: EventStore = {};
  if (options.store) {
    try {
      store = (await options.store.load()) ?? {};
    } catch {
      store = {};
    }
  }

  // Retire expired events out of the working set — into the archive, not
  // into oblivion: the history is the moat.
  const retired: StoredEvent[] = [];
  for (const k of Object.keys(store)) {
    if (now - store[k].lastSeenAt > cfg.eventTtlMs) {
      retired.push(store[k]);
      delete store[k];
    }
  }

  // Token sets of known events, for similarity matching.
  const known = Object.values(store).map((e) => ({
    ev: e,
    tokens: new Set(tokenize(e.title, cfg.stopwords)),
  }));

  const verdicts: (Verdict | null)[] = [];

  for (const claim of claims) {
    const tokens = tokenize(String(claim?.title ?? ""), cfg.stopwords);
    if (tokens.length === 0) {
      verdicts.push(null);
      continue;
    }
    const tokenSet = new Set(tokens);

    // Origins reporting this event IN THIS BATCH (from the injected
    // clustering; no cluster → a lone report → just its own origin).
    const batchOrigins = clustersOf(claim.id) ?? [claim.origin];

    // Find the matching event: exact key first, then the dual gate (G1) —
    // high similarity AND enough shared meaning tokens. Both must hold.
    const k = keyOf(tokens, cfg.keyTokens);
    let match: StoredEvent | undefined = store[k];
    if (!match) {
      let best: { ev: StoredEvent; sim: number } | null = null;
      for (const { ev, tokens: et } of known) {
        const sim = jaccard(tokenSet, et);
        if (
          sim >= cfg.mergeSimilarity &&
          sharedCount(tokenSet, et) >= cfg.minSharedTokens &&
          (!best || sim > best.sim)
        ) {
          best = { ev, sim };
        }
      }
      match = best?.ev;
    }

    let ev: StoredEvent;
    if (match) {
      ev = match;
      // Independence is by origin (G3): a Set collapses syndication.
      ev.origins = Array.from(new Set([...ev.origins, ...batchOrigins]));
      ev.title = claim.title; // adopt the freshest wording
      ev.lastSeenAt = now;
    } else {
      ev = {
        key: k,
        title: claim.title,
        origins: Array.from(new Set(batchOrigins)),
        firstSeenAt: now,
        lastSeenAt: now,
      };
      store[k] = ev;
      known.push({ ev, tokens: tokenSet }); // later claims in batch can match
    }

    // Corroboration = distinct origins (this batch ∪ history).
    const corro = ev.origins.length;

    // Receipts (G4): who else — never the claim's own origin, capped.
    const receipts =
      corro > 1
        ? ev.origins.filter((s) => s !== claim.origin).slice(0, cfg.receiptsCap)
        : [];

    // Signal rides the RELIABLE clock (G6): the upstream publish time, never
    // our own first-seen guess — a matching error can shift a count but can
    // never invent urgency. Single origins stay bare (G5).
    const pubMs = new Date(claim.publishedAt).getTime();
    const pubAge = Number.isFinite(pubMs) ? now - pubMs : Infinity;
    let signal: Signal | null = null;
    if (corro >= cfg.confirmedAt) signal = "confirmed";
    else if (corro >= cfg.corroboratedAt && pubAge < cfg.breakingWindowMs) signal = "breaking";
    else if (corro >= cfg.corroboratedAt) signal = "developing";

    verdicts.push({
      corroboration: corro,
      corroboratingSources: receipts,
      firstSeenAt: new Date(ev.firstSeenAt).toISOString(),
      signal,
    });
  }

  // Cap the working set — evicted events retire into the archive.
  const entries = Object.entries(store).sort(
    (a, b) => b[1].lastSeenAt - a[1].lastSeenAt,
  );
  const capped: EventStore = {};
  for (const [key, ev] of entries.slice(0, cfg.maxEvents)) capped[key] = ev;
  for (const [, ev] of entries.slice(cfg.maxEvents)) retired.push(ev);

  if (retired.length > 0 && options.archive) {
    try {
      await options.archive(retired);
    } catch {
      /* best-effort (G7) */
    }
  }

  if (options.store) {
    try {
      await options.store.save(capped);
    } catch {
      /* best-effort (G7) */
    }
  }

  return verdicts;
}

// ---------------------------------------------------------------------------
// Batteries: in-memory store (tests, demos, single-process use)
// ---------------------------------------------------------------------------

export function createMemoryStore(
  initial: EventStore = {},
): Store & { snapshot(): EventStore } {
  let state: EventStore = structuredClone(initial);
  return {
    load: () => structuredClone(state),
    save: (s: EventStore) => {
      state = structuredClone(s);
    },
    snapshot: () => structuredClone(state),
  };
}
