export interface StockItem {
  id: number
  supplier: string
  product_type: string
  location: string
  quantity: string
  purchase_price: string
  currency: string
  received_date: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface StockFilters {
  q?: string
  supplier?: string
  product_type?: string
  location?: string
  currency?: string
  min_price?: string
  max_price?: string
  received_from?: string
  received_to?: string
}

export interface Opportunity {
  stock_item_id: number
  supplier: string
  product_type: string
  location: string
  currency: string
  quantity: string
  unit_price: string
  peer_median_price: string
  discount_pct: number
  estimated_saving: string
  sample_size: number
  received_date: string
}

export interface OpportunityResponse {
  rule: string
  parameters: Record<string, number>
  count: number
  opportunities: Opportunity[]
}

export interface Facets {
  suppliers: string[]
  product_types: string[]
  locations: string[]
  currencies: string[]
}

export type NewStockItem = Omit<StockItem, 'id'>

export type SortField = 'received_date' | 'purchase_price' | 'quantity' | 'supplier'

export interface Sort {
  field: SortField
  dir: 'asc' | 'desc'
}
