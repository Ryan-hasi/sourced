# Sourced API — Integration Guide

Go from zero to corroboration verdicts in 3 steps.

## 1. The API in one request

```bash
curl -s https://sourced.run/api/v1/assess \
  -H "Content-Type: application/json" \
  -d '{
    "claims": [
      { "id": "a", "title": "Fed raises interest rates", "origin": "reuters", "publishedAt": "2026-07-21T12:00:00Z" },
      { "id": "b", "title": "Fed raises interest rates", "origin": "bloomberg", "publishedAt": "2026-07-21T12:04:00Z" }
    ]
  }'
```

Response:
```json
{
  "verdicts": [
    { "corroboration": 1, "corroboratingSources": [], "firstSeenAt": "2026-07-21T...", "signal": null },
    { "corroboration": 2, "corroboratingSources": ["reuters"], "firstSeenAt": "2026-07-21T...", "signal": "breaking" }
  ],
  "memory": "batch",
  "honest": "Sourced never says \"true\" — only \"corroborated by N independent sources\"."
}
```

That's it. Verdict 1: one source, bare (G5). Verdict 2: Reuters + Bloomberg → **2 sources, breaking**.

## 2. What you get

| Field | Meaning |
|---|---|
| `corroboration` | How many DISTINCT independent origins (outlets, monitors, sensors) report this event. Syndicated copies count as 1 (G3). |
| `corroboratingSources` | The receipts — which OTHER origins confirm this event. Empty when alone. |
| `firstSeenAt` | When the system first saw this event. Anonymous tier: request time. Keyed tier: true first sighting. |
| `signal` | `"confirmed"` (≥ 4 origins), `"breaking"` (≥ 2 origins, fresh), `"developing"` (≥ 2, older), or `null` (single source). |

## 3. Tiers

| | Anonymous | With API key (`sk_src_…`) |
|---|---|---|
| **Rate limit** | 60 req/min | 600 req/min |
| **Memory** | Batch-only (stateless) | Persistent event store across requests |
| **firstSeenAt** | Request timestamp | True first sighting |
| **Transparency chain** | — | Your own hash-chained log, daily git-anchored |
| **Cost** | Free | Free |
| **Key** | — | hello@tickwire.news (manual, named) |

With a key, send `Authorization: Bearer sk_src_...` header on every request.

## 4. Adding pre-grouped clusters

If you already know which claims report the same event (e.g., from your own LLM dedup or editorial grouping), pass `clusters`:

```bash
curl -s https://sourced.run/api/v1/assess \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_src_..." \
  -d '{
    "claims": [
      { "id": "c1", "title": "Earthquake M6.2 hits Tokyo region", "origin": "nhk", "publishedAt": "2026-07-21T06:00:00Z" },
      { "id": "c2", "title": "Strong quake near Tokyo — M6.2", "origin": "reuters", "publishedAt": "2026-07-21T06:05:00Z" },
      { "id": "c3", "title": "Typhoon warning in Okinawa", "origin": "nhk", "publishedAt": "2026-07-21T06:10:00Z" }
    ],
    "clusters": { "c1": ["nhk", "reuters"] }
  }'
```

`c1` and `c2` collapse to 2 origins. `c3` stays alone (different event). Without clusters, Sourced uses its own token-matching (dual-gate Jaccard) — slower but zero setup.

## 5. Quickstarts

### JavaScript / TypeScript
```ts
const res = await fetch("https://sourced.run/api/v1/assess", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}),
  },
  body: JSON.stringify({ claims }),
});
const { verdicts } = await res.json();
```

Install the zero-dep library to run locally:
```bash
npm install @sourcedhq/core
```

### Python
```python
import requests

res = requests.post("https://sourced.run/api/v1/assess", json={"claims": claims})
for v in res.json()["verdicts"]:
    if v:
        print(f"{v['corroboration']} sources, signal={v['signal']}")
```

### Go (`net/http`)
```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

func main() {
	payload, _ := json.Marshal(map[string]any{"claims": claims})
	req, _ := http.NewRequest("POST", "https://sourced.run/api/v1/assess", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil { panic(err) }
	defer resp.Body.Close()
	fmt.Println("Status:", resp.Status)
}
```

### Rust (`reqwest`)
```rust
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std.error.Error>> {
    const KEY: &str = "sk_src_...";
    let client = reqwest::Client::new();
    let res = client.post("https://sourced.run/api/v1/assess")
        .bearer_auth(KEY)
        .json(&json!({ "claims": claims }))
        .send()
        .await?;

    println!("Response: {:?}", res.text().await?);
    Ok(())
}
```

## 6. Use cases beyond news

The primitive works on any stream of `(claim, origin, timestamp)`:

### Outage detection
```json
{ "id": "o1", "title": "API gateway timeouts eu-west cluster", "origin": "monitor-paris", "publishedAt": "2026-07-21T10:00:00Z" }
```
One probe = bare. Five probes + user reports = CONFIRMED outage, with receipts. On-call engineer knows: real outage, not flaky probe.

### Content moderation
```json
{ "id": "f1", "title": "post_8723 violates export controls", "origin": "moderator-a", "publishedAt": "..." },
{ "id": "f2", "title": "post_8723 violates export controls", "origin": "ai-flag", "publishedAt": "..." }
```
One flag = queue. Two independent mods = escalated. ≥ 4 = confirmed policy violation, auto-action. (Keep `origin` distinct: moderator names, AI models, community reports.)

### OSINT / sensor fusion
```json
{ "id": "s1", "title": "unusual troop movement near border crossing 12", "origin": "satellite-feed", "publishedAt": "..." },
{ "id": "s2", "title": "unusual troop movement near border crossing 12", "origin": "social-media-geo", "publishedAt": "..." }
```
Each origin = a sensor type. `corroboration` = sensor fusion verdict. `breaking` = urgent, confirmed across sensor types.

## 7. Transparency chain (keyed tier only)

Your chain starts on your first API call and grows with each appending request:
- `GET /api/v1/chain?chain=<cid>` — read your chain
- `GET /api/v1/chain?chain=<cid>&full=1` — full history for verification
- Daily anchored into `github.com/Ryan-hasi/sourced/tree/main/anchors`

After anchoring, rewriting your chain becomes detectable — the git history would need rewriting too.

## 8. Rate limits & error handling

All endpoints return headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`.

**Best practice:** Sourced is designed to be honest, not fast. Cache verdicts client-side. For live feeds, assess every 5 minutes, not every second. The signal doesn't meaningfully change faster than sources publish.

## 9. Local development

Want to test offline? The engine is zero-dep:
```bash
npm install @sourcedhq/core
```

```ts
import { assess, createMemoryStore } from "@sourcedhq/core";
const store = createMemoryStore();
const verdicts = await assess(claims, { store });
```

Same API contract, same guarantees. When you're ready, point at the hosted API — same contract, persistent state.

---

Spec: [sourced.ink](https://sourced.ink) · Proof: [sourced.network](https://sourced.network) · Keys: **hello@tickwire.news**
