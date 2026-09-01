import { Fragment, useState } from 'react'
import type { Page, Sort, SortField, StockItem } from '../types'

interface Props {
  page?: Page<StockItem>
  loading: boolean
  sort: Sort
  onSort: (field: SortField) => void
  onPageChange: (page: number) => void
  onSupplierClick: (supplier: string) => void
}

const COLUMNS: { key: SortField | null; label: string; num?: boolean }[] = [
  { key: 'supplier', label: 'Supplier' },
  { key: null, label: 'Product type' },
  { key: null, label: 'Location' },
  { key: 'quantity', label: 'Quantity', num: true },
  { key: 'purchase_price', label: 'Unit price', num: true },
  { key: null, label: 'Lot value', num: true },
  { key: 'received_date', label: 'Received' },
]

export function StockTable({ page, loading, sort, onSort, onPageChange, onSupplierClick }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  if (loading) return <SkeletonRows />
  if (!page || page.items.length === 0) {
    return (
      <div className="empty">
        <strong>No lots match these filters.</strong>
        <span>Widen the date range or clear a filter above.</span>
      </div>
    )
  }

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.label} className={c.num ? 'num' : ''}>
                  {c.key ? (
                    <button className="th-sort" onClick={() => onSort(c.key as SortField)}>
                      {c.label}
                      <span className="th-sort__icon">
                        {sort.field === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.items.map((item) => {
              const value = Number(item.quantity) * Number(item.purchase_price)
              const open = expanded === item.id
              return (
                <Fragment key={item.id}>
                  <tr
                    className={`row${open ? ' row--open' : ''}`}
                    onClick={() => setExpanded(open ? null : item.id)}
                  >
                    <td>
                      <button
                        className="link"
                        onClick={(e) => { e.stopPropagation(); onSupplierClick(item.supplier) }}
                      >
                        {item.supplier}
                      </button>
                    </td>
                    <td>{item.product_type}</td>
                    <td><span className="tag">{item.location}</span></td>
                    <td className="num">{Number(item.quantity).toLocaleString()}</td>
                    <td className="num">{item.purchase_price} {item.currency}</td>
                    <td className="num">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{item.received_date}</td>
                  </tr>
                  {open && (
                    <tr className="row-detail">
                      <td colSpan={7}>
                        <dl>
                          <div><dt>Lot ID</dt><dd>#{item.id}</dd></div>
                          <div><dt>Supplier</dt><dd>{item.supplier}</dd></div>
                          <div><dt>Currency</dt><dd>{item.currency}</dd></div>
                          <div><dt>Unit price</dt><dd>{item.purchase_price}</dd></div>
                          <div><dt>Lot value</dt><dd>{value.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.currency}</dd></div>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button className="btn" disabled={page.page <= 1} onClick={() => onPageChange(page.page - 1)}>
          ← Previous
        </button>
        <span className="pager__status">
          Page <strong>{page.page}</strong> of {page.pages} · {page.total} lots
        </span>
        <button className="btn" disabled={page.page >= page.pages} onClick={() => onPageChange(page.page + 1)}>
          Next →
        </button>
      </div>
    </>
  )
}

function SkeletonRows() {
  return (
    <div className="skeleton">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton__row" />)}
    </div>
  )
}
