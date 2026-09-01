import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api/client'
import { useDebounce } from './hooks/useDebounce'
import { Opportunities } from './components/Opportunities'
import { StatTiles } from './components/StatTiles'
import { StockFiltersBar } from './components/StockFilters'
import { StockForm } from './components/StockForm'
import { StockTable } from './components/StockTable'
import { Toasts, type ToastMessage } from './components/Toast'
import type {
  Facets, OpportunityResponse, Page, Sort, SortField, StockFilters, StockItem,
} from './types'

const PAGE_SIZE = 10

export default function App() {
  const [tab, setTab] = useState<'stock' | 'opportunities'>('stock')
  const [filters, setFilters] = useState<StockFilters>({})
  const [sort, setSort] = useState<Sort>({ field: 'received_date', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)

  const [data, setData] = useState<Page<StockItem>>()
  const [facets, setFacets] = useState<Facets>()
  const [opportunities, setOpportunities] = useState<OpportunityResponse>()
  const [loading, setLoading] = useState(true)
  const [oppLoading, setOppLoading] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const topRef = useRef<HTMLDivElement>(null)
  const debouncedFilters = useDebounce(filters)

  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'ok') => {
    setToasts((t) => [...t, { id: Date.now() + Math.random(), text, tone }])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [stock, f] = await Promise.all([
        api.listStock(debouncedFilters, page, PAGE_SIZE, sort),
        api.facets(),
      ])
      setData(stock)
      setFacets(f)
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [debouncedFilters, page, sort, notify])

  useEffect(() => { void load() }, [load])

  const loadOpportunities = useCallback(async () => {
    setOppLoading(true)
    try {
      setOpportunities(await api.opportunities())
    } catch (err) {
      notify((err as Error).message, 'error')
    } finally {
      setOppLoading(false)
    }
  }, [notify])

  useEffect(() => {
    if (tab === 'opportunities') void loadOpportunities()
  }, [tab, loadOpportunities])

  // Changing page returns the reader to the top of the list.
  function changePage(next: number) {
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    topRef.current?.focus({ preventScroll: true })
  }

  function toggleSort(field: SortField) {
    setSort((s) => ({ field, dir: s.field === field && s.dir === 'desc' ? 'asc' : 'desc' }))
    setPage(1)
  }

  const totalValue = (data?.items ?? []).reduce(
    (sum, i) => sum + Number(i.quantity) * Number(i.purchase_price), 0,
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <span className="brand__mark">SI</span>
            <div>
              <strong>Stock Intelligence</strong>
              <span className="brand__sub">Supplier stock &amp; pricing</span>
            </div>
          </div>
          <nav className="tabs">
            <button className={tab === 'stock' ? 'tab tab--active' : 'tab'} onClick={() => setTab('stock')}>
              Stock
            </button>
            <button
              className={tab === 'opportunities' ? 'tab tab--active' : 'tab'}
              onClick={() => setTab('opportunities')}
            >
              Opportunities
            </button>
          </nav>
        </div>
        <div className="stripe" />
      </header>

      <main ref={topRef} tabIndex={-1}>
        {tab === 'stock' ? (
          <>
            <StatTiles
              loading={loading}
              stats={[
                { label: 'Lots matching', value: String(data?.total ?? 0) },
                { label: 'Page value', value: totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 }), hint: 'this page only' },
                { label: 'Suppliers', value: String(facets?.suppliers.length ?? 0) },
                { label: 'Product types', value: String(facets?.product_types.length ?? 0) },
              ]}
            />

            <StockForm
              open={formOpen}
              onToggle={() => setFormOpen((o) => !o)}
              onCreated={(item) => {
                notify(`Added ${item.product_type} from ${item.supplier}.`)
                setPage(1)
                void load()
              }}
              onError={(msg) => notify(msg, 'error')}
            />

            <StockFiltersBar
              filters={filters}
              facets={facets}
              onChange={(f) => { setFilters(f); setPage(1) }}
            />

            <section className="panel">
              <div className="panel__head panel__head--static">
                <span className="panel__title">Stock lots</span>
                {data && <span className="badge">{data.total}</span>}
              </div>
              <div className="panel__body">
                <StockTable
                  page={data}
                  loading={loading}
                  sort={sort}
                  onSort={toggleSort}
                  onPageChange={changePage}
                  onSupplierClick={(supplier) => {
                    setFilters({ supplier })
                    setPage(1)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                />
              </div>
            </section>
          </>
        ) : (
          <Opportunities data={opportunities} loading={oppLoading} />
        )}
      </main>

      <Toasts items={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  )
}
