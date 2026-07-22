import { describe, expect, it } from "vitest";
import { computeHash, verifyReceipt, type AnchorReceipt } from "@sourcedhq/anchor";

describe("computeHash", () => {
  it("produces SHA256 hex digest", () => {
    const hash = computeHash("hello world");
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });

  it("handles buffer input", () => {
    const buf = Buffer.from("test data", "utf-8");
    const hash = computeHash(buf);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("deterministic for same input", () => {
    const h1 = computeHash("sourced chain head");
    const h2 = computeHash("sourced chain head");
    expect(h1).toBe(h2);
  });

  it("different for different input", () => {
    const h1 = computeHash("hash one");
    const h2 = computeHash("hash two");
    expect(h1).not.toBe(h2);
  });
});

describe("verifyReceipt", () => {
  const validReceipt: AnchorReceipt = {
    hash: "abc123def456",
    timestamp: 1234567890,
    calendarUrl: "https://alice.btc.calendar.opentimestamps.org",
    commitment: "calendar-commitment-data-here",
    status: "pending",
  };

  it("returns valid for matching hash and valid commitment", () => {
    const result = verifyReceipt(validReceipt, "abc123def456");
    expect(result.valid).toBe(true);
  });

  it("returns invalid for mismatched hash", () => {
    const result = verifyReceipt(validReceipt, "wrong-hash");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("hash mismatch");
  });

  it("returns invalid for empty commitment", () => {
    const bad = { ...validReceipt, commitment: "" };
    const result = verifyReceipt(bad, "abc123def456");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("commitment");
  });

  it("returns invalid for missing calendar URL", () => {
    const bad = { ...validReceipt, calendarUrl: "" };
    const result = verifyReceipt(bad, "abc123def456");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("calendar URL");
  });
});
