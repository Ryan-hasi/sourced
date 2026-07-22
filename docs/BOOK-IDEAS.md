# Sourced — Aufbau-Bücher (Ideen-Liste)

> **Hauptbuch:** Die Sourced-Spec auf sourced.ink (12 Kapitel).
> Jedes Aufbau-Buch erklärt ein Kapitel oder Konzept aus dem Hauptbuch
> in Tiefe — für Ryan, als wäre es ein Lehrbuch an sich selbst.
>
> Format: `| Datum | Titel-Idee | Hauptbuch-Kapitel | Was es erklärt | Session-Kontext |`
>
> Regel: Wenn etwas in einer Session gebaut wird, das komplex genug ist
> um es einem Menschen von Grund auf zu erklären → Zeile hinzufügen.

## Basis-Buch Kapitel-Referenz

| # | Kapitel | Thema |
|---|---|---|
| 1 | What Sourced is (and is not) | Corroboration ≠ Truth, Primitive vs. Produkt |
| 2 | Quick start | `assess()`, Claims, Verdicts, Store |
| 3 | Data model | Claim, Verdict, StoredEvent, EventStore, Store, ArchiveSink |
| 4 | The algorithm | Tokenization, Dual-Gate, Corroboration, Signal, Decay |
| 5 | Configuration | DEFAULT_CONFIG, Thresholds, "defaults are the contract" |
| 6 | Honesty guarantees G1–G7 | Undercount, Never-True, Independence, Receipts, Bare-Single, Reliable-Clock, Fail-Open |
| 7 | Adversarial analysis | Astroturf, Keyword-Stuff, Rush-Breaking |
| 8 | Beyond news | Outage, OSINT, Moderation, Sensors, Market |
| 9 | Hosted API | sourced.run, Assess, Verify, Chain-as-a-Service |
| 10 | Conformance | Yardstick, adversarial suite, "whoever publishes the test defines the category" |
| 11 | Transparency log | Hash-Chain, Anchoring, Certificate-Transparency |
| 12 | Packages, status, license | npm, MIT + TRADEMARK, Firefox-Modell |

---

## Aufbau-Buch-Ideen

| Datum | Titel-Idee | Kapitel | Was es erklärt | Session-Kontext |
|---|---|---|---|---|
| 2026-07-22 | The Independence Map | §6 G3, §7 | Warum „unabhängig" nicht „anderer Name" bedeutet. Ownership, Syndication, Editorial. Wie 5 Bot-Accounts zu 1 Origin kollabieren. Warum das der Teil ist den ein Prompt nicht nachbauen kann. | Phase 2.1 — `independence.ts`, `SEED_INDEPENDENCE_MAP` (30 Mediengruppen), Integration in `assess()`, OSINT-Demo zeigt Astroturfing-Resistenz |
| 2026-07-22 | The Archive is the Moat | §3, §14 | Boundless vs. bounded. Working-Set (36h/400) vs. Archiv (für immer). Wie ein Copycat bei null anfängt und der Vorsprung täglich wächst. first-seen als compound interest. KV-Buckets, TTL-Retirement, lazy loading. | Phase 2.2 — `@sourcedhq/archive` mit 3 Backends (Memory/File/KV), `FileArchive` (JSONL append-only), `KVArchive` (monatliche Buckets mit lazy loading) |
| 2026-07-22 | Anchoring Time | §11 | Wie man beweist dass etwas zu einem Zeitpunkt existierte. Hash → Kalender-Server → Merkle-Tree → Bitcoin-Blockchain. Pending vs. confirmed proofs. Warum Git-Commits allein nicht reichen (man kann History umschreiben). OpenTimestamps-Protokoll. | Phase 2.3 — `@sourcedhq/anchor`, Calendar-Submission mit Retry/Timeout, Receipt-Verification, Scope-Doku (was dieses Paket tut vs. was die volle OTS-Library braucht) |
| 2026-07-22 | Beyond News: Drei Demos | §8 | Warum Sourced kein News-Tool ist. Outage-Detection (4 Monitore → CONFIRMED). Content-Moderation (User + AI + Humans → Auto-Action). OSINT (Telegram + Satellite + Journalist, Bot-Netzwerk kollabiert). Das Primitive als Baustein für jede Domain. | Phase 3.4 — `examples/osint/run.mjs` mit Independence Map gegen Bot-Netzwerk, interaktive Demo-API auf sourced.network |
| 2026-07-22 | The Yardstick | §10 | Warum wer die Tests definiert die Kategorie besitzt. 14 adversarial Cases als Standard-Setting. Wie man fremde Engines gegen G1–G7 testet. SVG-Badge als Vertrauens-Signal. „Sourced-conformant" als Qualitätslabel. | Phase 3.5 — `badge()`, `score()`, `/api/badge` SVG-Endpoint auf sourced.network, Conformance als npm-Paket das jeder importieren kann |
| 2026-07-22 | The Dashboard | §9 | Wie man ein Admin-UI für eine API baut ohne die Security zu brechen. Clerk-Auth auf einer Static Site. Proxy-Pattern: Browser sieht nie das Admin-Secret. Masked-Key-Lookup. Audit-Trail (wer hat was wann getan). Rate-Limiting auf Admin-Endpoints. | Dashboard-Bau — Clerk-Proxy (`/api/dashboard/proxy`), `keys.mjs` Hardening (disable/enable/audit/resolveKey), stats endpoint, 4-Tab UI |
| 2026-07-22 | Fail-Open: Die ehrlichste Garantie | §6 G7 | Warum Sourced nie in den Stream wirft den es annotiert. Broken Store → unlabeled. Garbage Input → null. Warum „degrading to nothing" immer sicherer ist als crashing. Das Design-Prinzip hinter fail-open. | Implizit in allem — jede `try/catch`-Block in `assess()`, `ArchiveSink` best-effort, Rate-Limiting fail-open bei KV-Ausfall |
| 2026-07-22 | Two Brands, One Flywheel | §1, §12 | Intel-Inside-Pattern. Tickwire trägt „Built on Sourced", Sourced sagt „powers apps like Tickwire". No-Revenue-Doktrin. Warum Sourced nie Geld macht und genau das der Punkt ist. Firefox-Modell (Code MIT, Name reserviert). | Sourced-Spec §13, Decisions.md, Selling-Points.md |
| 2026-07-22 | Der ehrliche Rahmen | §1, §6 G2 | Warum Sourced nie „wahr" sagt. Confirmation ≠ Truth. Warum das Vocabulary nur `confirmed/breaking/developing/null` ist und nie `true/verified/fact`. Die Last die das Wort „sourced" trägt. | Sourced-Spec §2, §5 G2, Conformance `g2-vocabulary` Test |
