# @sourcedhq/log

Hash-chained **transparency log** for Sourced verdicts (Certificate-
Transparency style): each record commits to the previous record's hash.
Publish the chain head anywhere public and the whole history becomes
tamper-evident. Includes JSONL storage helpers and the `sourced-anchor` CLI.

```ts
import { append, verify, head } from "@sourcedhq/log";
```

Record format + verification semantics: **https://sourced.network** ·
Spec: **https://sourced.ink**
