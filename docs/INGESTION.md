# Extension — Ingesting supplier spreadsheets and emails at scale

Today a lot enters the system through one clean `POST /stock`. In reality it arrives as
dozens of spreadsheets and emails a week, each supplier with its own column names, date
formats, units and quirks. The design below turns that mess into the same validated rows,
without letting bad data reach the opportunity rule.

## 1. Pipeline shape

```
Sources                Landing            Processing               Serving
────────               ───────            ──────────               ───────
email inbox   ──┐                  ┌─ parse ─┐
SFTP drop     ──┼─▶ object store ──┼─ map ───┼─▶ staging ─▶ validate ─▶ dedupe ─▶ stock_items
shared drive  ──┘   (raw, WORM)    └─ normalize                │
API upload                                                     └─▶ review queue (humans)
```

Every file is stored **byte-for-byte first**, before anything parses it. The raw object is
the source of truth; every later stage is reproducible from it, which is what makes
reprocessing after a mapper bug fix a replay rather than a data-recovery exercise.

## 2. Normalization

Per-supplier **mapping profiles**, stored as versioned config rows rather than code:

```yaml
supplier: acme_metals
match: { from: "*@acmemetals.com", subject: "Weekly stock*" }
sheet: "Stock"
header_row: 3
columns:
  supplier:       { const: "Acme Metals" }
  product_type:   { from: "Item Description", lookup: product_alias }
  location:       { from: "Whse", lookup: location_alias }
  quantity:       { from: "Qty (MT)", unit: MT, to_unit: KG }
  purchase_price: { from: "Unit Cost", per_unit: true }
  currency:       { from: "Cur", default: AED }
  received_date:  { from: "GRN Date", formats: ["%d/%m/%Y", "%d-%b-%y"] }
```

Normalization steps, in order: decode and de-macro the file → locate the header row →
apply the column map → coerce types (dates with an explicit format list, never a guessing
parser; numbers with locale-aware thousand/decimal separators; negative-in-parentheses) →
convert units and per-lot-to-per-unit prices → canonicalize entities through alias tables
(`Cu Wire 2.5mm`, `COPPER WIRE 2.5`, `copper-wire-2.5mm` → one `product_type`) → trim,
collapse whitespace, uppercase currency codes.

Alias tables are data, curated by humans, and are the single place fuzzy matching is
allowed to write — after review.

## 3. Validation

Three tiers, each with a different consequence:

| Tier | Example | Consequence |
| --- | --- | --- |
| Structural | file unreadable, no header row found, required column absent | reject file, alert |
| Row-level | `quantity <= 0`, unknown currency, unparseable date, future `received_date` | quarantine row |
| Plausibility | price 10× the trailing median for that product, quantity 100× the supplier's norm, duplicate of a lot received yesterday | accept but flag for review |

The existing Pydantic schema is reused for tier 2, so the API and the pipeline can never
disagree about what a valid lot is. Tier 3 never silently drops data — that is exactly the
kind of row that is either a genuine bargain or a decimal-point error, and both need a human.
A file is loaded transactionally: either the good rows land together with their batch record,
or nothing does.

## 4. Deduplication

Suppliers resend the same week's file, forward the same email twice, and send corrections.
Three layers:

1. **File level** — SHA-256 of the raw bytes. Same hash, already ingested → stop, log as
   duplicate delivery.
2. **Row level** — a deterministic natural key,
   `hash(supplier_id, product_type, location, received_date, quantity, purchase_price, currency)`,
   as a unique index on the staging table. Byte-identical rows resent in a different file
   collapse onto the existing row.
3. **Near-duplicate** — same supplier/product/date but different quantity or price is a
   *correction candidate*, not a duplicate. It goes to review with both versions shown;
   accepting one supersedes the other (the old row is marked superseded, never deleted).

Idempotency keys on the batch make a retried batch a no-op rather than a double load.

## 5. Background processing and retries

A queue (Celery/RQ on Redis, or SQS with workers) with one job per stage, so a parse failure
does not re-download and a validation failure does not re-parse:

`fetch → parse → normalize → validate → load → index`

- Workers are stateless and idempotent; job payloads reference the raw object key and the
  batch id, never file content.
- Retries use exponential backoff with jitter, bounded attempts, and a **dead-letter queue**
  for anything that exhausts them. Transient failures (network, DB timeout) retry; deterministic
  failures (unparseable file) go straight to DLQ — retrying them is just noise.
- Long files are chunked so one 200k-row workbook cannot block a worker or a queue.
- Concurrency is capped per supplier so one large drop cannot starve the rest.

## 6. Monitoring

- **Pipeline metrics**: files received / parsed / failed per supplier, rows accepted,
  quarantined, flagged; stage latency; queue depth; DLQ size; retry rate.
- **Freshness / absence alerts**: a supplier who normally sends a file every Monday and does
  not is a failure the pipeline will otherwise never report.
- **Data-quality metrics**: share of rows needing alias resolution, share flagged as
  implausible, drift in median price per product type — a jump usually means a mapping
  broke, not that the market moved.
- Structured logs carrying `batch_id` and `raw_object_key` on every line, traces across the
  stages, and alerting on rates rather than single events (except DLQ arrivals and
  structural rejections, which page immediately).

## 7. Data lineage

Every served row can answer "where did this come from?":

- `ingestion_batches` — raw object key, checksum, source (mailbox/SFTP/upload), sender,
  received timestamp, mapping profile id **and version**, pipeline version, status.
- `stock_items.batch_id`, `source_row_number`, and a `raw_payload` JSON snapshot of the
  original row as it appeared before normalization.
- `transformations` — the ordered list of what each stage changed for that row
  (`"Qty (MT)" 12.5 → quantity 12500 KG`), so a wrong number is traceable to the rule that
  produced it rather than to a guess.
- Corrections are append-only with `superseded_by`, so history is reconstructible at any date.

## 8. Human review

A review queue is a first-class part of the pipeline, not a fallback:

- **What lands there**: unmapped products/locations, plausibility flags, correction
  candidates, and anything an AI-assisted mapping proposed below a confidence threshold.
- **What a reviewer sees**: the normalized row, the raw row beside it, the rendered source
  file region, the reason it was flagged, and the peer statistics that made it look odd.
- **Actions**: accept, correct, reject, or "accept and remember" — the last one writing an
  alias or a mapping-profile change so the same file next week needs no review. The queue
  should shrink per supplier over time; if it doesn't, the mapping is wrong.
- Every decision is recorded with reviewer, timestamp and rationale, and feeds the accuracy
  metrics for the mapping that produced it.

## 9. Secure AI use

An LLM is genuinely good at the two hardest parts here — proposing a column mapping for a
new supplier layout, and matching a messy product description to a canonical type — provided
it stays inside these bounds:

- **AI proposes, deterministic code applies.** The model outputs a *mapping profile* or an
  *alias suggestion*, reviewed by a human once; the actual per-row transformation is executed
  by ordinary code. Rows are never transformed by a model call, which keeps ingestion
  reproducible, auditable and cheap.
- **Minimize data exposure.** Send headers plus a handful of sample rows, not whole files;
  redact contact details and commercial terms that the mapping task doesn't need. Prefer a
  vendor with a no-training / zero-retention agreement, or a self-hosted model for
  commercially sensitive pricing.
- **Constrain the output.** Structured output against a strict schema, validated before use;
  a model may only choose from existing canonical values or explicitly request a new one via
  review. Anything it returns that isn't in the allowed set is rejected, not coerced.
- **Treat supplier content as untrusted input.** Email bodies and spreadsheet cells can carry
  prompt injection. Content goes into the prompt as clearly delimited data, the model has no
  tools and no DB access, and its output can never be a command — only a proposal that the
  schema and the reviewer gate.
- **Confidence thresholds and fallbacks.** Below threshold → review queue. The pipeline must
  work, more slowly, with the model switched off entirely.
- **Log every call** (prompt hash, model, version, inputs referenced, output, confidence) as
  part of lineage, so an AI-assisted decision is as auditable as a human one.
