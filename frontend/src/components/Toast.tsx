import { useEffect } from 'react'

export interface ToastMessage {
  id: number
  text: string
  tone: 'ok' | 'error'
}

export function Toasts({ items, onDismiss }: { items: ToastMessage[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toasts">
      {items.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])

  return (
    <div className={`toast toast--${toast.tone}`} role="status">
      <span>{toast.text}</span>
      <button className="toast__close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">×</button>
    </div>
  )
}
