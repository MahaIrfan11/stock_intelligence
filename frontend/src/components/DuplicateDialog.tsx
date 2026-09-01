import { useEffect } from 'react'
import type { StockItem } from '../types'

interface Props {
  existing: StockItem
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DuplicateDialog({ existing, saving, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dup-title">
      <div className="modal__box">
        <div className="modal__head">
          <span className="modal__warn">!</span>
          <span id="dup-title" className="panel__title">Duplicate lot</span>
        </div>
        <div className="modal__body">
          <p>
            An identical lot is already recorded — same supplier, product type, location,
            quantity, price, currency and received date.
          </p>
          <dl className="modal__lot">
            <div><dt>Lot</dt><dd>#{existing.id}</dd></div>
            <div><dt>Supplier</dt><dd>{existing.supplier}</dd></div>
            <div><dt>Product</dt><dd>{existing.product_type}</dd></div>
            <div><dt>Location</dt><dd>{existing.location}</dd></div>
            <div><dt>Quantity</dt><dd>{Number(existing.quantity).toLocaleString()}</dd></div>
            <div><dt>Unit price</dt><dd>{existing.purchase_price} {existing.currency}</dd></div>
            <div><dt>Received</dt><dd>{existing.received_date}</dd></div>
          </dl>
          <p className="hint">
            Add it anyway only if this is a genuine second delivery of the same goods.
          </p>
        </div>
        <div className="modal__actions">
          <button className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn btn--primary" onClick={onConfirm} disabled={saving}>
            {saving ? 'Saving…' : 'Add anyway'}
          </button>
        </div>
      </div>
    </div>
  )
}
