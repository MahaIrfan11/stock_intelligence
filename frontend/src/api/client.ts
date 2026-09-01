import type {
  Facets,
  NewStockItem,
  OpportunityResponse,
  Page,
  Sort,
  StockFilters,
  StockItem,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: any) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(formatError(body) || `Request failed (${res.status})`, res.status, body)
  }
  return res.json() as Promise<T>
}

function formatError(body: any): string {
  if (Array.isArray(body?.detail)) {
    return body.detail
      .map((d: any) => `${d.loc?.slice(1).join('.')}: ${d.msg}`)
      .join('; ')
  }
  if (typeof body?.detail === 'string') return body.detail
  return body?.detail?.message ?? ''
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v))
  })
  return q.toString()
}

export const api = {
  listStock: (filters: StockFilters, page: number, pageSize: number, sort: Sort) =>
    request<Page<StockItem>>(
      `/stock?${toQuery({
        ...filters,
        page,
        page_size: pageSize,
        sort_by: sort.field,
        sort_dir: sort.dir,
      })}`,
    ),

  createStock: (item: NewStockItem, allowDuplicate = false) =>
    request<StockItem>(`/stock?${toQuery({ allow_duplicate: allowDuplicate ? 'true' : undefined })}`, {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  listBySupplier: (supplier: string, page = 1) =>
    request<Page<StockItem>>(`/stock/${encodeURIComponent(supplier)}?${toQuery({ page })}`),

  facets: () => request<Facets>('/stock/facets'),

  opportunities: () => request<OpportunityResponse>('/opportunities'),
}
