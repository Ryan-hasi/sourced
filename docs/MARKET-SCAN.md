# Sourced — Market Scan (2026-07-10)

> Frage: Gibt es das schon — und was muss Sourced sein, damit alles andere billig aussieht?
> Methode: 3 parallele Web-Research-Passes (Consumer-Produkte / Daten-APIs / OSS+Standards).
> **Verdict: Es existiert KEIN direktes Äquivalent.** Die Kategorie „Corroboration-Verdict als Primitive" ist unbesetzt.

## Die Landschaft

### Consumer-Produkte (zeigen etwas, sind aber keine Primitive)
| Produkt | Was es tut | Was ihm fehlt (vs. Sourced) |
|---|---|---|
| **Ground News** | Quellen-Zahl + Links/Rechts-Bias-Balken pro Story, „Blindspot" | Bias-Achse statt Korroborations-Achse; keine Unabhängigkeits-Dedup (Syndikation), kein first-seen, **kein echtes API** (angebliche APIs = SEO-Spam) |
| AllSides | redaktionelles L/C/R-Artikel-Triptychon | kein Count, keine Logik, kein API |
| **NewsGuard** | Trust-Score 0–100 pro QUELLE (echtes Enterprise-API); „Misinformation Fingerprints" für widerlegte Narrative | **falsche Achse**: bewertet Quellen, nicht Claims; Fingerprints nur für Falsches |
| Otherweb, Particle, Verity/ITN, SmartNews | Nutrition-Label / Publisher-Partnerschaften / Narrativ-Vergleich / Bias-Buckets | nirgends ein numerischer Korroborations-Count mit Receipts |
| Google „Full Coverage" | echtes Event-Clustering + Timeline | Search-Feature, nicht lizenzierbar, kein Count/Verdict |
| Factal (B2B) | Journalisten+KI verifizieren Breaking Events → binäres „verified" | Wahrheits-Urteil statt transparentem N-Quellen-Count; Enterprise-only |

### Daten-Plattformen & APIs (Rohmaterial oder teuer, keine Ehrlichkeit)
| Plattform | Was es tut | Warum es Sourced nicht ist |
|---|---|---|
| **GDELT** (gratis) | Events + Mentions global, 15-min-Takt, first-seen vorhanden | zählt ARTIKEL nicht unabhängige Origins; Doku warnt selbst vor „duplicate reports, circular reporting" — Dedup ist dem Nutzer überlassen. **Übererfasst genau da, wo G1/G3 schützen.** Rohmaterial, kein Engine |
| **Event Registry** (~$3k/yr) | echtes Event-Clustering, Artikel-Listen | Artikel-Counts = Volumen, keine dokumentierte Syndikations-Kollaps-Logik; closed SaaS |
| NewsCatcher (~$10k/mo), Perigon (~$24k/yr), Aylien (quote-only) | Story-/Cluster-Endpoints | Volumen-Metriken, Unabhängigkeit undokumentiert, Enterprise-Preise, closed |
| NewsWhip | Social-Viralität | ganz anderes Feld |
| Google Fact Check API / Full Fact AI / ClaimBuster | Matching gegen EXISTIERENDE menschliche Fact-Checks | zählen nichts; ohne Fact-Check keine Antwort |
| **Jina Grounding API** (LLM-Ära, ~$0.006/req) | Statement → 30 Web-Referenzen → Factuality-Score + true/false | kollabiert zum WAHRHEITS-Urteil — der Gegenentwurf zu G2; kein first-seen-Gedächtnis, kein Undercount-Versprechen |

### OSS & Standards (der Slot ist leer)
- **W3C Credible Web CG „cred-claims"** — „Corroboration-Based Strategies" als Konzept: **archiviert 04/2026, nie implementiert.** Der nächste konzeptionelle Verwandte hat aufgegeben → der Standard-Slot ist frei.
- Meedan Check: zählt Wiederholungen von Claims (Tiplines), nicht unabhängige Origins.
- PHEME/FEVER/SciFact: akademische Veracity-Klassifikation, ruhend, keine Lib.
- ClaimReview: EIN Fact-Checker, EIN Urteil — kein Feld für „N unabhängige Quellen".
- C2PA/Content Credentials: Provenienz von MEDIEN-Dateien, nicht von Claims.
- Verifiable Credentials / Originator Profile / Trust Project: Attestation/Publisher-Indikatoren, kein Korroborations-Datenformat.

## Die 4 Lücken, die NIEMAND füllt (= Sourceds Positionierung)
1. **Unabhängige-Origin-Zählung mit Syndikations-Kollaps** als dokumentiertes, garantiertes Output-Feld — alle zählen Artikel/Mentions/Cluster (Volumen).
2. **Honest-by-design-Semantik** — undercount-never-overcount, nie „wahr". Alle Verdict-Systeme (Fact-Check-APIs, Jina, Factal) behaupten das Gegenteil: true/false.
3. **Billig, embeddable, self-hostable.** Echtes Clustering kostet $3k–24k+/Jahr closed SaaS; GDELT ist gratis, aber unfertig. Eine offene Primitive, die man in einem Nachmittag einbettet, existiert nicht.
4. **Count + first-seen-Gedächtnis + Receipts als EIN Bündel.** Die Teile existieren verstreut, das Bündel nirgends.

## Was Sourced sein muss, damit die anderen billig aussehen
- **Offen + embeddable** → macht $24k-SaaS-Cluster-APIs zu Mieturteilen ohne Prüfbarkeit.
- **Garantien als öffentliche adversariale Test-Suite (G1–G7)** → macht „wir zählen auch Quellen" zu unauditiertem Volumen-Zählen. Wer die Messlatte publiziert, definiert die Kategorie.
- **Transparency-Log (hash-verkettete Verdicts, öffentlich verankert)** → macht jede Behauptung von Ehrlichkeit ohne Beweiskette unglaubwürdig. Nicht prompt-klonbar.
- **Archiv ohne Verfall (first-seen für immer)** → jeder Betriebstag vergrössert den Abstand zu jedem Nachbauer.
- **Nie „wahr" sagen** → einziges System, das quantifiziert, OHNE zu urteilen — die Position, die nach jedem KI-Halluzinations-Skandal wertvoller wird.

Schutz-Doktrin im Detail: [[Sourced]] §14 (open core, proprietäre Historie). Flywheel & Messlatte: §13.

## Namens-Nachbarn (keine Blocker, aber wissen)
- npm-Paket `sourced` = VERGEBEN (Event-Sourcing-Framework, aktiv) → **npm-Scope `@sourced/*` ist frei** — Org früh claimen, Pakete als `@sourced/core` etc.
- GitHub `RyanCodrai/sourced` = Python-Tool (Coding-Agents greppen Dependencies), 25 Stars — anderes Feld.
- Ryans Repo: `Ryan-hasi/sourced` (privat).

*Quellen/URLs in den Research-Reports der Session vom 2026-07-10. Related: [[Sourced]] · [[Decisions]] · [[Selling Points]].*
