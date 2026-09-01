# Stock Intelligence

A small stock intelligence service: record supplier stock lots, query them, and surface
buying opportunities where a lot is priced well below its peer group.

- **Backend** — Python 3.12, FastAPI, SQLAlchemy 2.0, PostgreSQL, Alembic
- **Frontend** — React 18 + TypeScript (Vite)
- **Tests** — pytest (SQLite, no external services needed)

---

## 1. Quick start

### With Docker (API + PostgreSQL)

```bash
cp backend/.env.example backend/.env
docker compose up --build
# API:  http://localhost:8000
# Docs: http://localhost:8000/docs
```

### Backend, locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                # then set DATABASE_URL
alembic upgrade head                # create the schema
python seed.py                      # optional demo data
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env                # VITE_API_URL=http://localhost:8000/api
npm run dev                         # http://localhost:5173
```

### Tests

```bash
cd backend
pytest
```

Tests point `DATABASE_URL` at a temporary SQLite file, so no database needs to be running.

---

## 2. API

All routes are served under the `API_PREFIX` (default `/api`).

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/stock` | Create a stock lot. Returns `201`, `422` with field-level errors, or `409` for a duplicate. |
| `GET` | `/api/stock` | List with free-text search, filtering, sorting and pagination. |
| `GET` | `/api/stock/facets` | Distinct suppliers / product types / locations / currencies (UI dropdowns). |
| `GET` | `/api/stock/{supplier}` | All lots for one supplier, paginated. |
| `GET` | `/api/opportunities` | Under-priced lots, with the rule and its parameters. |
| `GET` | `/api/health` | Liveness probe. |

### `POST /api/stock`

```json
{
  "supplier": "Acme Metals",
  "product_type": "Copper Wire",
  "location": "Dubai",
  "quantity": 120,
  "purchase_price": 41.5,
  "currency": "AED",
  "received_date": "2026-08-20"
}
```

Validation: all text fields non-blank (whitespace collapsed), `quantity > 0`,
`purchase_price >= 0`, `currency` a supported 3-letter ISO code (uppercased),
`received_date` not in the future. The quantity and price rules are also enforced
by `CHECK` constraints in the database.

### Duplicate lots

A lot is a duplicate when it matches an existing row on **every** business field —
supplier, product type, location, quantity, purchase price, currency and received date
(the natural key). `POST /api/stock` refuses it with `409 Conflict` and returns the lot it
clashes with, so the caller can show it rather than just say "no":

```json
{
  "detail": {
    "code": "duplicate_stock_item",
    "message": "An identical lot already exists.",
    "existing": { "id": 42, "supplier": "Acme Metals", "...": "..." }
  }
}
```

Two identical deliveries on one day are possible in real life, so this is a confirmation,
not a hard block: resend with `?allow_duplicate=true` and the lot is created. The UI turns
the `409` into a dialog showing the existing lot with **Cancel** / **Add anyway**, which
sends the confirmed request. Index `ix_stock_items_natural_key` (revision `0002`) backs the
lookup, which runs before every insert.

### `GET /api/stock`

Query parameters: `q` (free-text match on supplier, product type or location), `supplier`, `product_type`, `location`, `currency` (exact,
case-insensitive), `min_price`, `max_price`, `received_from`, `received_to`,
`page`, `page_size`, `sort_by` (`received_date` | `purchase_price` | `quantity` |
`supplier` | `id`), `sort_dir` (`asc` | `desc`).

Response:

```json
{ "items": [...], "total": 60, "page": 1, "page_size": 20, "pages": 3 }
```

### `GET /api/opportunities`

Optional `product_type`, `location`, `limit`. The response repeats the rule and the
parameters it ran with, so a consumer never has to guess how a row was produced.

---

## 3. The opportunity rule

> A stock lot is an **opportunity** when its unit purchase price is at least
> `OPP_DISCOUNT_THRESHOLD` below the **median** unit price of its peer group, and the
> peer group holds at least `OPP_MIN_SAMPLE` lots.
>
> A **peer group** is all lots with the same `product_type` **and** the same `currency`,
> received within the last `OPP_LOOKBACK_DAYS` days.

Defaults: 180-day lookback, minimum 3 lots per group, 15% discount threshold — all
configurable through the environment.

Each result carries `unit_price`, `peer_median_price`, `discount_pct`, `sample_size`
and `estimated_saving` (`(median − price) × quantity`), sorted by discount descending.

Why these choices:

- **Median, not mean** — one mispriced or mis-keyed lot cannot drag the benchmark.
- **Currency in the group key** — no FX rates are stored, so prices are only ever
  compared against prices in the same currency. Cross-currency comparison would need a
  dated FX table; see the assumptions below.
- **Minimum sample** — a "median" over one or two lots is noise, not a benchmark.
- **Lookback window** — commodity prices drift; a lot from two years ago is not a peer.

---

## 4. The interface

A two-tab console styled after the CBOX container look: steel greys, safety orange,
corrugated header stripe, square corners, and content grouped into bordered container
panels with stencil-style headers.

Interactions:

- **Stat tiles** — matching lots, page value, distinct suppliers and product types.
- **Collapsible "Add stock lot" panel** — grouped fieldsets, a live lot-value readout,
  inline server validation surfaced as a toast, `Esc` to collapse.
- **Duplicate confirmation** — saving a lot identical to an existing one opens a dialog
  showing the clashing lot; "Add anyway" re-sends it as an intentional repeat delivery.
- **Debounced free-text search** (350 ms) across supplier, product type and location,
  backed by `GET /api/stock?q=`.
- **Filter chips** — every active filter shows as a removable chip, plus "Clear all".
- **Sortable columns** — click a header to sort, click again to flip direction; the arrow
  shows the current field and direction. Sorting is server-side.
- **Expandable rows** — click a row for its detail panel; click a supplier name to filter
  the whole table to that supplier.
- **Pagination scrolls back to the top** of the list (smoothly, and respecting
  `prefers-reduced-motion`) so page 2 starts where page 1 did.
- **Toasts** for save confirmations and API errors; **skeleton shimmer** while loading;
  explicit empty states instead of a blank table.
- **Opportunities tab** — a collapsible explanation of the rule and its live parameters, a
  minimum-discount slider, and a bar per row showing how far below the peer median it sits.

---

## 5. Architecture

```
backend/
  app/
    main.py               FastAPI app, CORS, router wiring
    core/
      config.py           Pydantic settings, env-driven, cached
      database.py         Engine, session factory, declarative Base, get_db dependency
    models/stock.py       SQLAlchemy ORM model + indexes and check constraints
    schemas/              Pydantic request/response models (validation lives here)
    services/             Business logic: querying, filtering, the opportunity rule
    api/routes/           HTTP layer only: parse params, call a service, return
    utils/                Small helpers (pagination bounds, median)
  alembic/                Migrations (0001 schema, 0002 natural-key index)
  schema.sql              Same schema as plain SQL, for reference
  tests/                  pytest suite against SQLite
frontend/
  src/
    api/client.ts         Typed fetch wrapper, one function per endpoint
    components/           Form, filters, table, opportunities, tiles, toasts, duplicate dialog
    hooks/useDebounce.ts  Debounces the search box
    types.ts              Shared TypeScript types mirroring the API
    App.tsx               Tabs, state, data loading
docs/INGESTION.md         Extension answer: bulk supplier ingestion at scale
```

Layering rule: **routes → services → models**. Routes never build queries, services never
touch HTTP objects, and models never import services. Configuration is read only through
`core.config.get_settings()`, so nothing in the codebase reads `os.environ` directly.

Indexes cover the fields the API filters on, plus a composite
`(product_type, currency, received_date)` matching the opportunity query's access path.

---

## 6. Assumptions

1. `purchase_price` is the price **per unit** of `quantity`, in `currency` — not a lot total.
2. `quantity` is unit-agnostic (pieces, kg, m). A real system would carry a `unit_of_measure`
   column; comparisons here assume one product type is always quoted in one unit.
3. No FX conversion. Currencies are compared only against themselves. Adding an FX table
   keyed by (currency, date) would let peer groups span currencies.
4. Stock lots are immutable receipt records — there is no update or delete endpoint, and no
   consumption/outbound tracking. Corrections would be new rows plus a reversal.
5. Because of that, duplicates are guarded at write time rather than by a unique constraint:
   an identical lot is a confirmation prompt, not an impossibility, since the same goods can
   genuinely arrive twice in a day. A real deployment would carry the supplier's delivery
   note number and make *that* the unique key.
6. Supplier is a free-text name, not a foreign key. Real deployments need a supplier table
   with aliases (see `docs/INGESTION.md`).
7. No authentication. This would sit behind an API gateway or an auth dependency in
   production; the routing layer is already the natural place for it.
8. `GET /stock/{supplier}` matches the supplier name case-insensitively and exactly, and is
   declared after `/stock/facets` so the static path is not shadowed.
9. Median is computed in Python. At larger volumes this moves into PostgreSQL
   (`percentile_cont(0.5) WITHIN GROUP (ORDER BY purchase_price)`) so no rows leave the DB.

---

## 7. Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg2://stock:stock@localhost:5432/stock_intelligence` | SQLAlchemy URL |
| `API_PREFIX` | `/api` | Prefix for all routers |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE` | `20` / `100` | Pagination bounds |
| `OPP_LOOKBACK_DAYS` | `180` | Peer-group window |
| `OPP_MIN_SAMPLE` | `3` | Minimum lots per peer group |
| `OPP_DISCOUNT_THRESHOLD` | `0.15` | Discount below median to flag |
| `VITE_API_URL` (frontend) | `http://localhost:8000/api` | API base URL |

---

## 8. Extension

`docs/INGESTION.md` covers ingesting dozens of supplier spreadsheets and emails in
inconsistent formats: normalization, validation, deduplication, background processing,
retries, monitoring, data lineage, human review and secure AI use.
