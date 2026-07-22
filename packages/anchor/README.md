# @sourcedhq/anchor

Public timestamp anchoring for [Sourced](https://sourced.ink) — submits chain head hashes to OpenTimestamps calendar servers for unfakeable proof of existence.

## Install

```bash
npm install @sourcedhq/anchor
```

## Usage

```typescript
import { anchorHash, computeHash, verifyReceipt } from "@sourcedhq/anchor";

const hash = computeHash("my chain head data");
const result = await anchorHash(hash);

for (const receipt of result.receipts) {
  console.log(`Anchored at ${receipt.calendarUrl}`);
  const v = verifyReceipt(receipt, hash);
  console.log(`Valid: ${v.valid}`);
}
```

## CLI

```bash
sourced-anchor-ts anchors/tickwire.log
sourced-anchor-ts anchors/tickwire.log --calendars https://alice.btc.calendar.opentimestamps.org
```

## Scope

This package handles the **submission** step of OpenTimestamps:

- POST SHA256 hashes to calendar servers
- Store pending receipts
- Basic receipt verification (hash match + commitment present)

For **Bitcoin-confirmed proofs** (upgrading pending → confirmed, verifying against the blockchain), use the full [`opentimestamps`](https://opentimestamps.org) CLI:

```bash
ots upgrade receipt.ots    # pending → bitcoin-confirmed (~2-24h)
ots verify receipt.ots     # verify against blockchain
```

## Calendar Servers

Default servers (configurable):
- `alice.btc.calendar.opentimestamps.org`
- `bob.btc.calendar.opentimestamps.org`
- `finney.calendar.eternitywall.com`

## License

MIT. Part of the [Sourced](https://sourced.ink) ecosystem.
