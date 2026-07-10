# @sourcedhq/core

**Corroboration as a primitive.** Given claims from many origins, `assess()`
tells you how many INDEPENDENT sources corroborate each one, since when, with
receipts. Says "confirmed by sources" — never "true". Zero dependencies.

```ts
import { assess, createMemoryStore } from "@sourcedhq/core";

const verdicts = await assess(
  [
    { id: "a", title: "Central bank raises rates", origin: "reuters", publishedAt: "2026-01-01T12:00:00Z" },
    { id: "b", title: "Central bank raises rates", origin: "bbc",     publishedAt: "2026-01-01T12:04:00Z" },
  ],
  { store: createMemoryStore() },
);
// verdicts[1] → { corroboration: 2, corroboratingSources: ["reuters"],
//                 firstSeenAt: "…", signal: "breaking" }
```

Honesty guarantees (undercount-never-overcount, independence by origin,
receipts always, single sources stay bare, fail-open) are executable — see
`@sourcedhq/conformance` and run them live at https://sourced.network.

Full spec: **https://sourced.ink** · Hosted API & playground: **https://sourced.run**
