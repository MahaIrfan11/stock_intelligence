import type { Facets, StockFilters as Filters } from '../types'

interface Props {
  filters: Filters
  facets?: Facets
  onChange: (filters: Filters) => void
}

const LABELS: Record<string, string> = {
  q: 'search',
  supplier: 'supplier',
  product_type: 'product',
  location: 'location',
  currency: 'currency',
  min_price: 'min price',
  max_price: 'max price',
  received_from: 'from',
  received_to: 'to',
}

export function StockFiltersBar({ filters, facets, onChange }: Props) {
  const set =
    (key: keyof Filters) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...filters, [key]: e.target.value || undefined })

  const active = Object.entries(filters).filter(([, v]) => v)

  return (
    <section className="panel panel--flat">
      <div className="panel__body">
        <div className="searchbar">
          <input
            className="searchbar__input"
            placeholder="Search supplier, product type or location…"
            value={filters.q ?? ''}
            onChange={set('q')}
          />
          {filters.q && (
            <button className="searchbar__clear" onClick={() => onChange({ ...filters, q: undefined })}>×</button>
          )}
        </div>

        <div className="grid grid--filters">
          <label>Supplier
            <select value={filters.supplier ?? ''} onChange={set('supplier')}>
              <option value="">All</option>
              {facets?.suppliers.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>Product type
            <select value={filters.product_type ?? ''} onChange={set('product_type')}>
              <option value="">All</option>
              {facets?.product_types.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>Location
            <select value={filters.location ?? ''} onChange={set('location')}>
              <option value="">All</option>
              {facets?.locations.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>Currency
            <select value={filters.currency ?? ''} onChange={set('currency')}>
              <option value="">All</option>
              {facets?.currencies.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>Min price
            <input type="number" value={filters.min_price ?? ''} onChange={set('min_price')} />
          </label>
          <label>Max price
            <input type="number" value={filters.max_price ?? ''} onChange={set('max_price')} />
          </label>
          <label>Received from
            <input type="date" value={filters.received_from ?? ''} onChange={set('received_from')} />
          </label>
          <label>Received to
            <input type="date" value={filters.received_to ?? ''} onChange={set('received_to')} />
          </label>
        </div>

        {active.length > 0 && (
          <div className="chips">
            {active.map(([key, value]) => (
              <button
                key={key}
                className="chip"
                onClick={() => onChange({ ...filters, [key]: undefined })}
                title="Remove filter"
              >
                {LABELS[key] ?? key}: <strong>{value}</strong> <span aria-hidden>×</span>
              </button>
            ))}
            <button className="chip chip--reset" onClick={() => onChange({})}>Clear all</button>
          </div>
        )}
      </div>
    </section>
  )
}
