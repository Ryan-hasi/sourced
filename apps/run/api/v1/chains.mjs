/**
 * GET /api/v1/chains — public directory of every hosted transparency chain:
 * [{ chainId, name, seq, head, ts }]. This is what the daily anchor workflow
 * reads; it is also how anyone can independently mirror all heads.
 */
import { stamp } from "../_auth.mjs";
import { kvGet, kvSMembers } from "../_kv.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  stamp(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const ids = await kvSMembers("sourced:chains:index");
  const chains = [];
  for (const cid of ids) {
    try {
      const meta = JSON.parse((await kvGet(`sourced:chain:${cid}:meta`)) ?? "null");
      if (meta) chains.push({ chainId: cid, name: meta.name, seq: meta.seq, head: meta.head, ts: meta.ts });
    } catch { /* skip broken entries, never fail the directory */ }
  }
  chains.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  res.setHeader("Cache-Control", "public, max-age=60");
  return res.status(200).json({
    chains,
    read: "GET /api/v1/chain?chain=<chainId>[&full=1]",
    anchors: "https://github.com/Ryan-hasi/sourced/tree/main/anchors — daily git-committed heads",
  });
}
