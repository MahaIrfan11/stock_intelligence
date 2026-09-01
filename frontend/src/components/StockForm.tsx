import { useEffect, useState } from 'react'
import { ApiError, api } from '../api/client'
import type { NewStockItem, StockItem } from '../types'
import { DuplicateDialog } from './DuplicateDialog'

const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'INR', 'CNY', 'JPY', 'SAR', 'CHF', 'AUD', 'CAD']

const EMPTY: NewStockItem = {
  supplier: '',
  product_type: '',
  location: '',
  quantity: '',
  purchase_price: '',
  currency: 'AED',
  received_date: new Date().toISOString().slice(0, 10),
}

interface Props {
  open: boolean
  onToggle: () => void
  onCreated: (item: NewStockItem) => void
  onError: (message: string) => void
}

export function StockForm({ open, onToggle, onCreated, onError }: Props) {
  const [form, setForm] = useState<NewStockItem>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [duplicate, setDuplicate] = useState<StockItem | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !duplicate) onToggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, duplicate, onToggle])

  const set =
    (key: keyof NewStockItem) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value })

  const total = Number(form.quantity) * Number(form.purchase_price)

  async function save(allowDuplicate: boolean) {
    setSaving(true)
    try {
      await api.createStock(form, allowDuplicate)
      setDuplicate(null)
      onCreated(form)
      setForm({ ...EMPTY, received_date: form.received_date })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDuplicate(err.body.detail.existing as StockItem)
      } else {
        onError((err as Error).message)
      }
    } finally {
      setSaving(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    void save(false)
  }

  return (
    <section className="panel">
      <button className="panel__head" onClick={onToggle} aria-expanded={open}>
        <span className="panel__title">Add stock lot</span>
        <span className="panel__chevron">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <form className="panel__body" onSubmit={submit}>
          <fieldset>
            <legend>Source</legend>
            <div className="grid">
              <label>Supplier
                <input value={form.supplier} onChange={set('supplier')} placeholder="Acme Metals" required />
              </label>
              <label>Product type
                <input value={form.product_type} onChange={set('product_type')} placeholder="Copper Wire" required />
              </label>
              <label>Location
                <input value={form.location} onChange={set('location')} placeholder="Jebel Ali" required />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Commercials</legend>
            <div className="grid">
              <label>Quantity
                <input type="number" step="0.001" min="0.001" value={form.quantity} onChange={set('quantity')} required />
              </label>
              <label>Unit price
                <input type="number" step="0.0001" min="0" value={form.purchase_price} onChange={set('purchase_price')} required />
              </label>
              <label>Currency
                <select value={form.currency} onChange={set('currency')}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>Received date
                <input type="date" max={EMPTY.received_date} value={form.received_date} onChange={set('received_date')} required />
              </label>
            </div>
            <p className="hint">
              Lot value:&nbsp;
              <strong>{total > 0 ? `${total.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${form.currency}` : '—'}</strong>
            </p>
          </fieldset>

          <div className="actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save lot'}
            </button>
            <button type="button" className="btn" onClick={() => setForm(EMPTY)}>Clear</button>
          </div>
        </form>
      )}

      {duplicate && (
        <DuplicateDialog
          existing={duplicate}
          saving={saving}
          onConfirm={() => void save(true)}
          onCancel={() => setDuplicate(null)}
        />
      )}
    </section>
  )
}
