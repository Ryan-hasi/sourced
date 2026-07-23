/**
 * Sourced X (Twitter) Bot & Viral Claim Verification Daemon.
 *
 * Scans viral posts and replies with transparent Sourced receipts:
 *   - Fetches live corroboration from https://sourced.run/api/v1/assess
 *   - Embeds official SVG receipt badge
 *   - Verifies against Sourced Merkle log on https://sourced.network
 */
import { assess } from "@sourcedhq/core";

export async function processTweetClaim(tweetId, text, originHandle) {
  const claim = {
    id: tweetId,
    title: text,
    origin: originHandle.toLowerCase().replace(/^@/, ""),
    publishedAt: new Date().toISOString(),
  };

  const [verdict] = await assess([claim]);
  if (!verdict) return null;

  const corro = verdict.corroboration;
  const receipts = verdict.corroboratingSources.join(", ");
  const signal = verdict.signal;

  let replyText = "";

  if (corro >= 2) {
    replyText = [
      `✓ Sourced Receipt: Corroborated by ${corro} independent sources.`,
      `• Receipts: [${receipts}]`,
      `• Signal: ${signal ? signal.toUpperCase() : "DEVELOPING"}`,
      `• First Sighted: ${verdict.firstSeenAt}`,
      `Honesty Guarantee G1-G7: Never says "true" — only independent source count.`,
      `Proof: https://sourced.network`,
    ].join("\n");
  } else {
    replyText = [
      `ℹ️ Sourced Status: Single Source Report (Bare)`,
      `No independent corroboration detected across news feeds or sensors yet.`,
      `Proof: https://sourced.network`,
    ].join("\n");
  }

  return {
    tweetId,
    replyText,
    verdict,
    badgeUrl: `https://sourced.run/api/v1/badge?corro=${corro}&signal=${signal || "bare"}&sources=${encodeURIComponent(receipts)}`,
  };
}
