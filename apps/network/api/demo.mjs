import { assess, createMemoryStore, SEED_INDEPENDENCE_MAP } from "./_core.mjs";

const DEMOS = {
  outage: {
    name: "Outage Detection",
    config: { confirmedAt: 3, breakingWindowMs: 10 * 60_000 },
    waves: [
      {
        label: "T+0 — first probe reports",
        claims: [
          { id: "r1", title: "API gateway timeouts eu-west cluster", origin: "monitor-frankfurt", publishedAt: 0 },
        ],
      },
      {
        label: "T+2 — independent monitors confirm",
        claims: [
          { id: "r2", title: "API gateway timeouts eu-west cluster", origin: "monitor-paris", publishedAt: 2 },
          { id: "r3", title: "API gateway timeouts eu-west cluster", origin: "statuspage-bot", publishedAt: 2 },
          { id: "r4", title: "API gateway timeouts eu-west cluster", origin: "user-reports", publishedAt: 2 },
          { id: "r5", title: "checkout latency spike us-east canary", origin: "monitor-virginia", publishedAt: 2 },
        ],
      },
    ],
  },
  moderation: {
    name: "Content Moderation",
    config: {},
    waves: [
      {
        label: "T+0 — single user report",
        claims: [
          { id: "f1", title: "post_8723 hate speech in comments", origin: "user-report", publishedAt: 0 },
        ],
      },
      {
        label: "T+5 — AI classifier confirms",
        claims: [
          { id: "f2", title: "post_8723 hate speech in comments", origin: "toxicity-classifier-v2", publishedAt: 5 },
        ],
      },
      {
        label: "T+12 — two moderators agree",
        claims: [
          { id: "f3", title: "post_8723 hate speech in comments", origin: "moderator-anna", publishedAt: 12 },
          { id: "f4", title: "post_8723 hate speech in comments", origin: "moderator-chen", publishedAt: 12 },
          { id: "f5", title: "post_9101 off-topic in security channel", origin: "user-report", publishedAt: 12 },
        ],
      },
    ],
  },
  osint: {
    name: "OSINT Verification",
    config: { confirmedAt: 3, breakingWindowMs: 15 * 60_000 },
    independenceMap: {
      groups: [
        ...SEED_INDEPENDENCE_MAP.groups,
        {
          canonical: "known-bot-network",
          relation: "editorial",
          members: ["known-bot-network", "bot-account-1", "bot-account-2", "bot-account-3", "bot-account-4", "bot-account-5"],
        },
      ],
    },
    waves: [
      {
        label: "T+0 — single channel report",
        claims: [
          { id: "o1", title: "military convoy on highway M1 heading north", origin: "telegram-channel-A", publishedAt: 0 },
        ],
      },
      {
        label: "T+8 — satellite + second channel",
        claims: [
          { id: "o2", title: "military convoy on highway M1 heading north", origin: "satellite-imagery-feed", publishedAt: 8 },
          { id: "o3", title: "military convoy on highway M1 heading north", origin: "telegram-channel-B", publishedAt: 8 },
          { id: "o4", title: "explosion at power plant sector 7", origin: "bot-account-1", publishedAt: 8 },
          { id: "o5", title: "explosion at power plant sector 7", origin: "bot-account-2", publishedAt: 8 },
          { id: "o6", title: "explosion at power plant sector 7", origin: "bot-account-3", publishedAt: 8 },
        ],
      },
      {
        label: "T+20 — journalist on ground",
        claims: [
          { id: "o9", title: "military convoy on highway M1 heading north", origin: "journalist-onsite", publishedAt: 20 },
          { id: "o10", title: "explosion at power plant sector 7", origin: "local-news-outlet", publishedAt: 20 },
        ],
      },
    ],
  },
};

export default async function handler(req, res) {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }

  if (req.method === "GET") {
    res.writeHead(200, {
      ...cors,
      "Content-Type": "application/json",
      "X-RateLimit-Limit": "30",
      "X-RateLimit-Window": "60s",
    });
    res.end(JSON.stringify({
      demos: Object.entries(DEMOS).map(([id, d]) => ({
        id,
        name: d.name,
        waves: d.waves.length,
      })),
    }));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, cors);
    res.end("Method not allowed");
    return;
  }

  let body;
  try {
    const chunks = [];
    let totalBytes = 0;
    const MAX_BODY = 4096;
    for await (const c of req) {
      totalBytes += c.length;
      if (totalBytes > MAX_BODY) {
        res.writeHead(413, { ...cors, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "request body too large" }));
        return;
      }
      chunks.push(c);
    }
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    res.writeHead(400, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "invalid JSON" }));
    return;
  }

  const demoId = body.demo;
  const demo = DEMOS[demoId];
  if (!demo) {
    res.writeHead(400, { ...cors, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `unknown demo: ${demoId}. Available: ${Object.keys(DEMOS).join(", ")}` }));
    return;
  }

  const T0 = Date.now();
  const store = createMemoryStore();
  const results = [];

  for (const wave of demo.waves) {
    const waveMs = wave.claims[0]?.publishedAt ?? 0;
    const now = T0 + waveMs * 60_000;

    const claims = wave.claims.map((c) => ({
      id: c.id,
      title: c.title,
      origin: c.origin,
      publishedAt: new Date(T0 + c.publishedAt * 60_000).toISOString(),
    }));

    const opts = {
      store,
      now,
      config: demo.config,
    };
    if (demo.independenceMap) opts.independenceMap = demo.independenceMap;

    const verdicts = await assess(claims, opts);

    results.push({
      label: wave.label,
      claims: claims.map((c, i) => ({
        origin: c.origin,
        title: c.title,
        verdict: verdicts[i],
      })),
    });
  }

  res.writeHead(200, { ...cors, "Content-Type": "application/json" });
  res.end(JSON.stringify({ demo: demoId, name: demo.name, results }));
}
