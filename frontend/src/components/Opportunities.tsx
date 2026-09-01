import { useMemo, useState } from 'react'
import type { OpportunityResponse } from '../types'

export function Opportunities({ data, loading }: { data?: OpportunityResponse; loading: boolean }) {
  const [minDiscount, setMinDiscount] = useState(0)
  const [showRule, setShowRule] = useState(false)

  const rows = useMemo(
    () => (data?.opportunities ?? []).filter((o) => o.discount_pct >= minDiscount),
    [data, minDiscount],
  )
  const maxDiscount = Math.max(...rows.map((r) => r.discount_pct), 1)

  if (loading) return <div className="skeleton">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton__row" />)}</div>
  if (!data) return null

  return (
    <section className="panel">
      <div className="panel__head panel__head--static">
        <span className="panel__title">Opportunities</span>
        <span className="badge">{data.count}</span>
      </div>

      <div className="panel__body">
        <button className="rule-toggle" onClick={() => setShowRule(!showRule)}>
          {showRule ? '− Hide rule' : '+ How is this calculated?'}
        </button>
        {showRule && (
          <div className="rule-box">
            <p>{data.rule}</p>
            <ul>
              <li>Lookback: <strong>{data.parameters.lookback_days} days</strong></li>
              <li>Minimum peer group: <strong>{data.parameters.min_sample} lots</strong></li>
              <li>Discount threshold: <strong>{(data.parameters.discount_threshold * 100).toFixed(0)}%</strong></li>
            </ul>
          </div>
        )}

        <label className="slider">
          Minimum discount: <strong>{minDiscount}%</strong>
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={minDiscount}
            onChange={(e) => setMinDiscount(Number(e.target.value))}
          />
        </label>

        {rows.length === 0 ? (
          <div className="empty">
            <strong>Nothing below the threshold.</strong>
            <span>Lower the minimum discount or add more comparable lots.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Product type</th>
                  <th className="num">Unit price</th>
                  <th className="num">Peer median</th>
                  <th>Discount</th>
                  <th className="num">Est. saving</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.stock_item_id} className="row">
                    <td>{o.supplier}</td>
                    <td>{o.product_type} <span className="tag tag--muted">n={o.sample_size}</span></td>
                    <td className="num">{Number(o.unit_price).toFixed(2)} {o.currency}</td>
                    <td className="num">{Number(o.peer_median_price).toFixed(2)}</td>
                    <td>
                      <div className="bar" title={`${o.discount_pct}% below median`}>
                        <div className="bar__fill" style={{ width: `${(o.discount_pct / maxDiscount) * 100}%` }} />
                        <span className="bar__label">{o.discount_pct}%</span>
                      </div>
                    </td>
                    <td className="num strong">{Number(o.estimated_saving).toLocaleString(undefined, { maximumFractionDigits: 0 })} {o.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
