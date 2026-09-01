# Extension: handling supplier spreadsheets and emails at scale

Right now a lot arrives through one clean `POST /stock`. In practice it will arrive as
dozens of spreadsheets and emails a week, and every supplier has their own column names,
date formats and units. The design below turns all of that into the same validated rows,
without letting bad data reach the opportunity rule.

## 1. Pipeline shape

Files come in from an email inbox (IMAP or SES), an SFTP drop, a shared drive or an API
upload. They land in S3, get parsed, mapped and normalized, then move through staging,
validation and deduplication before reaching `stock_items` in PostgreSQL. Anything doubtful
branches off to a human review queue.

```
email / SFTP / drive / upload
        |
        v
   S3 (raw, immutable)  ==>  parse, map, normalize  ==>  staging
                                                            |
                                    validate, dedupe  ==>  stock_items
                                                            |
                                                     review queue (people)
```

The first thing that happens to a file is that it gets saved to S3 exactly as it arrived,
before anything tries to read it. That raw copy is the source of truth, so when a mapping
bug is found later, fixing it means replaying the files rather than trying to recover lost
data.

Concretely: keys are partitioned as `raw/supplier=<name>/dt=<date>/<ulid>-<filename>`,
with versioning and Object Lock switched on so nothing can overwrite or delete a raw file,
SSE-KMS encryption because supplier pricing is commercially sensitive, and lifecycle rules
moving objects to Glacier after ninety days. S3 event notifications push straight onto SQS,
so arrival triggers work instead of a polling loop. On premise, MinIO offers the same API
and the same locking behaviour.

## 2. Normalization

Each supplier gets a mapping profile, stored as versioned config in the database rather
than code. It says how to recognise their file and what each of their columns means:

```yaml
supplier: acme_metals
match: { from: "*@acmemetals.com", subject: "Weekly stock*" }
sheet: "Stock"
header_row: 3
columns:
  product_type:   { from: "Item Description", lookup: product_alias }
  quantity:       { from: "Qty (MT)", unit: MT, to_unit: KG }
  purchase_price: { from: "Unit Cost", per_unit: true }
  received_date:  { from: "GRN Date", formats: ["%d/%m/%Y", "%d-%b-%y"] }
```

The steps run in order: open the file (openpyxl for xlsx, pandas for csv, the stdlib
`email` package plus a text extractor for messages and PDFs), find the header row, apply
the column map, then convert the values. Dates are read against the list of formats we
expect rather than a parser that guesses, numbers respect local thousand and decimal
separators, and units and lot prices are converted to the ones we store. Product and
location names are matched through alias tables, so `Cu Wire 2.5mm` and `COPPER WIRE 2.5`
both end up as one product type.

Those alias tables are data that people curate, and they are the only place fuzzy matching
is ever allowed to write, after someone has reviewed it.

## 3. Validation

Three levels, each handled differently:

| Level | Example | What happens |
| --- | --- | --- |
| Structural | file unreadable, no header row | reject the file and alert |
| Row | quantity of zero, unknown currency, date in the future | quarantine that row |
| Plausibility | price ten times the usual median, quantity far above the supplier's norm | accept it but flag for review |

Row checks reuse the same Pydantic schema the API uses, so the two can never disagree about
what a valid lot looks like. Plausibility flags are never dropped quietly, because such a
row is either a real bargain or a misplaced decimal point, and both need a person to look.
Files load inside a single database transaction: either the good rows and their batch
record all land, or nothing does.

## 4. Deduplication

Suppliers resend the same file, forward the same email twice, and send corrections. Three
layers catch that.

At file level we store the SHA-256 of the raw bytes, so a file we have already ingested
stops immediately. At row level a natural key made of supplier, product, location, date,
quantity, price and currency is a unique index on the staging table, so an identical row
inside a different file merges into the one already there. And when the supplier, product
and date match but the quantity or price has changed, that is a correction rather than a
duplicate. It goes to review with both versions shown, and accepting one marks the other
superseded instead of deleting it.

Batches carry idempotency keys, so a retried batch does nothing rather than loading twice.
This is the same natural key the API already uses to return `409` on a duplicate `POST`.

## 5. Background processing and retries

A queue runs one job per stage: fetch, parse, normalize, validate, load, index. Celery on
Redis works, or SQS with plain worker processes if the rest of the stack is already on AWS.
Splitting the stages means a validation failure does not force a re-download. Workers hold
no state and can safely run twice, and jobs carry the S3 key and batch id rather than the
file itself.

Retries back off exponentially with jitter and give up after a set number of attempts,
sending the job to a dead letter queue. Network blips and database timeouts are worth
retrying; a file that cannot be parsed never will be, so it goes straight to the dead letter
queue. Big files are processed in chunks so one huge workbook cannot block a worker, and
each supplier has a concurrency cap so a large drop cannot crowd everyone else out.

## 6. Monitoring

We track files received, parsed and failed per supplier, rows accepted, quarantined and
flagged, stage latency, queue depth, dead letter volume and retry rates, exported as
Prometheus metrics and shown in Grafana.

Just as important is noticing silence. A supplier who sends every Monday and suddenly does
not is a failure nothing else will report, so absence gets its own alert.

Data quality gets watched too: how many rows need alias resolution, how many look
implausible, and whether the median price for a product type suddenly moves. A jump there
usually means a mapping broke rather than that the market did something.

Logs are structured JSON carrying the batch id and S3 key on every line, with OpenTelemetry
traces spanning the stages. Alerts fire on rates rather than single events, except for dead
letter arrivals and rejected files, which page straight away.

## 7. Data lineage

Every row we serve can explain where it came from.

An `ingestion_batches` table records the S3 key, its checksum, who sent it, when, which
mapping profile and version read it, and the pipeline version. Each stock row keeps its
batch id, its row number in the original file, and a JSONB snapshot of how that row looked
before normalization. A `transformations` record lists what each stage changed, for example
`"Qty (MT)" 12.5` becoming `quantity 12500 KG`, so a wrong number can be traced to the rule
that produced it instead of guessed at.

Corrections only ever add rows, marking the old one superseded, so the history can be
reconstructed for any date.

## 8. Human review

The review queue is part of the pipeline rather than a place things go wrong.

Unmapped products and locations end up there, along with plausibility flags, correction
candidates and any AI suggestion the model was not confident about. The reviewer sees the
normalized row next to the raw one and the part of the file it came from, why it was
flagged, and the comparable prices that made it look odd.

They can accept, correct, reject, or accept and remember. That last option writes an alias
or updates the mapping profile, so next week's file needs no review at all. Over time the
queue for each supplier should shrink, and if it does not, the mapping is wrong. Every
decision is stored with who made it, when and why, and feeds back into how well that
mapping is performing.

## 9. Using AI safely

An LLM is genuinely useful for the two hardest parts here: suggesting a column mapping for a
supplier we have never seen, and matching a messy product description to one we already
know. It stays inside these limits.

The model proposes, ordinary code applies. It writes a mapping profile or an alias
suggestion, a person approves it once, and after that deterministic code does the actual
work on every row. No row is ever transformed by a model call, which keeps the whole thing
reproducible, auditable and cheap.

We send it as little as possible: column headers and a few sample rows rather than whole
files, with anything the task does not need removed. For commercially sensitive pricing,
either a vendor with a no training and no retention agreement, such as Bedrock or the
Anthropic API with zero retention, or a model hosted in house.

Its output is constrained to a strict JSON schema and validated with Pydantic before use. It
can pick from values we already have or ask for a new one through review, and anything
outside that is rejected rather than quietly corrected.

Supplier content is treated as untrusted, because an email body or a spreadsheet cell can
contain instructions aimed at the model. Content goes in as clearly marked data, the model
has no tools and no database access, and its output can only ever be a suggestion that the
schema and a reviewer approve.

When confidence is low the item goes to review, and if the model is switched off entirely
the pipeline still works, just more slowly. Every call is logged with the model, version,
inputs, output and confidence, so an AI assisted decision can be audited exactly like a
human one.
