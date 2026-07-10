# @sourcedhq/conformance

The Sourced honesty guarantees (G1–G7) as an **executable, adversarial test
suite** — coincidental-merge resistance, syndication collapse, event-hijack
resistance, fake urgency, fail-open. It targets the function shape, not one
implementation: point it at ANY engine that claims to count sources.

```ts
import { runConformance } from "@sourcedhq/conformance";
const report = await runConformance(myAssessImplementation);
// { passed, failed, results: [{ id, guarantee, pass, detail }] }
```

Watch it run live against the reference engine: **https://sourced.network**
