/**
 * @sourcedhq/core — Independence Map.
 *
 * G3 says independence is by origin, not by article. But real independence
 * needs knowing that 50 local sites are one wire service, who owns whom,
 * who syndicates whom. The independence map is the curated dataset that
 * collapses non-independent origins into a single counting unit.
 *
 * The map is optional and injectable — without it, every distinct origin
 * string counts as independent (the safe default). With it, syndication
 * and ownership are visible to the counter.
 */

export type IndependenceRelation = "ownership" | "syndication" | "editorial";

export type IndependenceGroup = {
  canonical: string;
  members: string[];
  relation: IndependenceRelation;
  note?: string;
};

export type IndependenceMap = {
  groups: IndependenceGroup[];
};

const groupIndex = new WeakMap<IndependenceMap, Map<string, string>>();

function buildIndex(map: IndependenceMap): Map<string, string> {
  let idx = groupIndex.get(map);
  if (idx) return idx;
  idx = new Map();
  for (const g of map.groups) {
    for (const m of g.members) {
      idx.set(m.toLowerCase(), g.canonical.toLowerCase());
    }
  }
  groupIndex.set(map, idx);
  return idx;
}

/**
 * Resolve an origin to its canonical independent identity.
 * Two origins that resolve to the same string are NOT independent (G3).
 * Unknown origins resolve to themselves (assumed independent).
 */
export function resolveOrigin(origin: string, map?: IndependenceMap): string {
  if (!map) return origin.toLowerCase();
  const idx = buildIndex(map);
  return idx.get(origin.toLowerCase()) ?? origin.toLowerCase();
}

/**
 * Deduplicate a list of origins using the independence map.
 * Returns only the canonical identities — the count of this array is the
 * true corroboration number.
 */
export function deduplicateOrigins(
  origins: string[],
  map?: IndependenceMap,
): string[] {
  if (!map) return Array.from(new Set(origins.map((o) => o.toLowerCase())));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const o of origins) {
    const canonical = resolveOrigin(o, map);
    if (!seen.has(canonical)) {
      seen.add(canonical);
      result.push(canonical);
    }
  }
  return result;
}

/**
 * The seed dataset — curated media ownership and syndication relationships.
 * This is the part that cannot be prompted into existence reliably; it is
 * accumulated work that improves every verdict.
 *
 * Sources: public ownership records, masthead disclosures, wire service
 * membership lists. Updated manually; contributions welcome.
 */
export const SEED_INDEPENDENCE_MAP: IndependenceMap = {
  groups: [
    // ── Wire services (syndication) ──────────────────────────────────
    {
      canonical: "ap",
      relation: "syndication",
      note: "Associated Press wire copy appears under many names",
      members: [
        "ap",
        "ap news",
        "associated press",
        "ap wire",
      ],
    },
    {
      canonical: "reuters",
      relation: "syndication",
      note: "Reuters wire copy",
      members: [
        "reuters",
        "reuters wire",
      ],
    },
    {
      canonical: "afp",
      relation: "syndication",
      note: "Agence France-Presse wire",
      members: [
        "afp",
        "agence france-presse",
        "afp wire",
      ],
    },
    {
      canonical: "dpa",
      relation: "syndication",
      note: "Deutsche Presse-Agentur",
      members: [
        "dpa",
        "deutsche presse-agentur",
      ],
    },
    {
      canonical: "sda",
      relation: "syndication",
      note: "Schweizerische Depeschenagentur / Keystone-SDA",
      members: [
        "sda",
        "keystone-sda",
        "ats",
      ],
    },

    // ── News Corp / Murdoch (ownership) ──────────────────────────────
    {
      canonical: "news-corp",
      relation: "ownership",
      note: "News Corp / Fox Corporation — common ownership",
      members: [
        "news-corp",
        "fox news",
        "fox",
        "the sun",
        "the times",
        "the australian",
        "herald sun",
        "courier mail",
        "the advertiser",
        "news.com.au",
      ],
    },
    {
      canonical: "wsj",
      relation: "ownership",
      note: "Wall Street Journal — News Corp, editorial independence claimed",
      members: [
        "wsj",
        "wall street journal",
      ],
    },
    {
      canonical: "nyt",
      relation: "ownership",
      note: "NYT Company properties",
      members: [
        "nyt",
        "new york times",
        "the new york times",
        "ny times",
      ],
    },

    // ── Paramount / CBS (ownership) ──────────────────────────────────
    {
      canonical: "paramount-cbs",
      relation: "ownership",
      note: "Paramount Global — CBS properties",
      members: [
        "paramount-cbs",
        "cbs",
        "cbs news",
        "cbs evening news",
      ],
    },

    // ── Comcast / NBC (ownership) ────────────────────────────────────
    {
      canonical: "nbc-universal",
      relation: "ownership",
      note: "NBCUniversal / Comcast",
      members: [
        "nbc-universal",
        "nbc",
        "nbc news",
        "msnbc",
        "cnbc",
        "today",
      ],
    },

    // ── Warner Bros Discovery (ownership) ────────────────────────────
    {
      canonical: "wbd-cnn",
      relation: "ownership",
      note: "Warner Bros. Discovery — CNN properties",
      members: [
        "wbd-cnn",
        "cnn",
        "cnn international",
        "hln",
      ],
    },

    // ── Disney / ABC (ownership) ─────────────────────────────────────
    {
      canonical: "disney-abc",
      relation: "ownership",
      note: "Walt Disney Company — ABC properties",
      members: [
        "disney-abc",
        "abc",
        "abc news",
        "espn",
      ],
    },

    // ── Sinclair Broadcast Group (ownership) ─────────────────────────
    {
      canonical: "sinclair",
      relation: "ownership",
      note: "Sinclair Broadcast Group — ~190 local US stations share editorial",
      members: [
        "sinclair",
        "sinclair broadcast",
      ],
    },

    // ── Hearst (ownership) ───────────────────────────────────────────
    {
      canonical: "hearst",
      relation: "ownership",
      note: "Hearst Communications — newspapers + TV stations",
      members: [
        "hearst",
        "san francisco chronicle",
        "houston chronicle",
        "seattle post-intelligencer",
      ],
    },

    // ── Gannett / USA Today network (ownership) ──────────────────────
    {
      canonical: "gannett",
      relation: "ownership",
      note: "Gannett / USA Today Network — ~200 local papers share content",
      members: [
        "gannett",
        "usa today",
        "usatoday",
      ],
    },

    // ── Nexstar (ownership) ──────────────────────────────────────────
    {
      canonical: "nexstar",
      relation: "ownership",
      note: "Nexstar Media Group — largest US local TV owner",
      members: [
        "nexstar",
        "the hill",
      ],
    },

    // ── ARD (ownership/editorial) ────────────────────────────────────
    {
      canonical: "ard",
      relation: "editorial",
      note: "ARD — regional broadcasters sharing Tagesschau editorial",
      members: [
        "ard",
        "tagesschau",
        "das erste",
        "br",
        "wdr",
        "ndr",
        "hr",
        "mdr",
        "swr",
        "rbb",
        "sr",
      ],
    },

    // ── ZDF (ownership) ──────────────────────────────────────────────
    {
      canonical: "zdf",
      relation: "ownership",
      note: "ZDF and its digital channels",
      members: [
        "zdf",
        "zdf heute",
        "zdfheute",
      ],
    },

    // ── SRG SSR (ownership) ──────────────────────────────────────────
    {
      canonical: "srg-ssr",
      relation: "ownership",
      note: "Swiss public broadcaster — SRF/RTS/RSI/RTR share editorial",
      members: [
        "srg-ssr",
        "srf",
        "rts",
        "rsi",
        "rtr",
        "srg ssr",
        "srg",
        "swissinfo",
      ],
    },

    // ── Tamedia / TX Group (ownership) ───────────────────────────────
    {
      canonical: "tamedia",
      relation: "editorial",
      note: "TX Group / Tamedia — shared editorial desk for DE-CH papers",
      members: [
        "tagesanzeiger",
        "der bund",
        "basler zeitung",
        "berner zeitung",
        "20 minuten",
        "tamedia",
      ],
    },

    // ── Ringier (ownership) ──────────────────────────────────────────
    {
      canonical: "ringier",
      relation: "ownership",
      note: "Ringier AG — CH media group",
      members: [
        "blick",
        "sonntagsblick",
        "ringier",
      ],
    },

    // ── NZZ (ownership) ──────────────────────────────────────────────
    {
      canonical: "nzz",
      relation: "ownership",
      note: "Neue Zürcher Zeitung group",
      members: [
        "nzz",
        "neue zürcher zeitung",
        "nzz am sonntag",
      ],
    },

    // ── BBC (ownership) ──────────────────────────────────────────────
    {
      canonical: "bbc",
      relation: "ownership",
      note: "BBC — all services share editorial oversight",
      members: [
        "bbc",
        "bbc news",
        "bbc world",
        "bbc world service",
      ],
    },

    // ── Guardian Media Group (ownership) ─────────────────────────────
    {
      canonical: "guardian",
      relation: "ownership",
      note: "Guardian Media Group",
      members: [
        "guardian",
        "the guardian",
        "observer",
        "the observer",
      ],
    },

    // ── Daily Mail Group (ownership) ─────────────────────────────────
    {
      canonical: "dmg-media",
      relation: "ownership",
      note: "DMG Media — Associated Newspapers",
      members: [
        "dmg-media",
        "daily mail",
        "mail online",
        "dailymail",
        "metro uk",
        "the metro",
      ],
    },

    // ── Bloomberg (ownership) ────────────────────────────────────────
    {
      canonical: "bloomberg",
      relation: "ownership",
      note: "Bloomberg LP",
      members: [
        "bloomberg",
        "bloomberg news",
        "bloomberg tv",
        "bloomberg markets",
      ],
    },

    // ── Telegraph Media Group (ownership) ────────────────────────────
    {
      canonical: "telegraph",
      relation: "ownership",
      note: "Telegraph Media Group",
      members: [
        "telegraph",
        "the telegraph",
        "daily telegraph",
        "sunday telegraph",
      ],
    },

    // ── Axel Springer (ownership) ────────────────────────────────────
    {
      canonical: "axel-springer",
      relation: "ownership",
      note: "Axel Springer SE — shared editorial across properties",
      members: [
        "axel-springer",
        "axel springer",
        "bild",
        "die welt",
        "welt",
        "business insider",
        "business insider deutschland",
        "politico",
        "politico eu",
      ],
    },

    // ── Funke Mediengruppe (ownership) ───────────────────────────────
    {
      canonical: "funke",
      relation: "ownership",
      note: "Funke Mediengruppe — regional papers share content",
      members: [
        "funke",
        "waz",
        "nrz",
        "wp",
        "westfalenpost",
      ],
    },

    // ── Madsack / RND (ownership) ────────────────────────────────────
    {
      canonical: "rnd",
      relation: "editorial",
      note: "RedaktionsNetzwerk Deutschland — shared national desk",
      members: [
        "rnd",
        "redaktionsnetzwerk deutschland",
        "haz",
        "kieler nachrichten",
        "lübecker nachrichten",
      ],
    },

    // ── Google News syndication ──────────────────────────────────────
    {
      canonical: "google-news",
      relation: "syndication",
      note: "Google News is an aggregator, not an origin",
      members: [
        "google-news",
        "google news",
        "news google",
      ],
    },
  ],
};
