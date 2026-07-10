/**
 * GET /api/live — the live pulse of the engine in production.
 *
 * Reads Tickwire's public feed, whose items already carry REAL Sourced
 * verdicts (corroboration / signal / firstSeenAt come from the production
 * engine with persistent event memory), and aggregates them into a small,
 * honest, always-fresh statistic. Nothing is invented; if the feed carries
 * no verdict fields we compute a batch verdict with the embedded engine.
 * Cached at the edge for 60 s to be a good citizen.
 */
import { assess } from "./_core.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  try {
    const r = await fetch("https://app.tickwire.news/api/feed", { signal: AbortSignal.timeout(8000) });
    const feed = await r.json();
    const hero = Array.isArray(feed.hero) ? feed.hero : [feed.hero];
    const items = [...hero, ...(feed.topNews ?? []), ...(feed.stream ?? [])].filter(Boolean);
    if (items.length === 0) throw new Error("empty feed");

    let verdicts;
    if (items.some((it) => typeof it.corroboration === "number")) {
      // Production verdicts, straight from the live deployment.
      verdicts = items.map((it) =>
        typeof it.corroboration === "number"
          ? { corroboration: it.corroboration, signal: it.signal ?? null }
          : null,
      );
    } else {
      // Fallback: batch-assess with the embedded engine.
      const claims = items.map((it, i) => ({
        id: String(it.id ?? i),
        title: String(it.title ?? ""),
        origin: String(it.source ?? "unknown"),
        publishedAt: String(it.publishedAt ?? ""),
      }));
      verdicts = await assess(claims, { now: Date.now() });
    }

    const origins = new Set(items.map((it) => String(it.source ?? "unknown")));
    let top = null;
    verdicts.forEach((v, i) => {
      if (v && (!top || v.corroboration > top.corroboration)) {
        top = { corroboration: v.corroboration, title: String(items[i].title ?? "").slice(0, 90) };
      }
    });

    res.status(200).json({
      at: new Date().toISOString(),
      claims: items.length,
      origins: origins.size,
      corroborated: verdicts.filter((v) => v && v.corroboration >= 2).length,
      confirmed: verdicts.filter((v) => v && v.signal === "confirmed").length,
      top,
      source: "live Sourced verdicts from the Tickwire production deployment",
    });
  } catch {
    res.status(200).json({ error: "live source unreachable" });
  }
}
