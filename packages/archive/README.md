# @sourcedhq/archive

Persistent event history for the [Sourced](https://sourced.ink) corroboration primitive.

The working set stays bounded (36h / 400 events) for matching performance; the **archive** is unbounded — every event, every origin, every first-seen timestamp, forever. This is the compounding moat: a copycat starting tomorrow begins with zero history.

## Install

```bash
npm install @sourcedhq/archive @sourcedhq/core
```

## Usage

```typescript
import { assess, createMemoryStore } from "@sourcedhq/core";
import { MemoryArchive, FileArchive } from "@sourcedhq/archive";

const store = createMemoryStore();
const archive = new FileArchive("./sourced-archive.jsonl");

const verdicts = await assess(claims, {
  store,
  archive: (retired) => archive.append(retired),
});

// Query the archive
const recent = await archive.query({ since: Date.now() - 86400_000 });
const count = await archive.count();
const firstSeen = await archive.firstSeen("event-key");
```

## Backends

| Backend | Use case | Storage |
|---|---|---|
| `MemoryArchive` | Tests, demos | In-process |
| `FileArchive` | CLI, local apps | JSONL file (append-only) |
| `KVArchive` | Hosted API | Key-value store (Upstash/Vercel KV) |

## Query

```typescript
const events = await archive.query({
  since: number,       // earliest firstSeenAt (epoch ms)
  until: number,       // latest firstSeenAt
  origin: string,      // filter by origin name
  keyPrefix: string,   // filter by event key prefix
  limit: number,       // max results
});
```

## API

- `append(events: StoredEvent[])` — store retired events
- `query(filter?)` — search the archive
- `count()` — total archived events
- `firstSeen(key)` — earliest timestamp for an event key
- `origins(key)` — all origins that reported an event

## License

MIT. Part of the [Sourced](https://sourced.ink) ecosystem.
