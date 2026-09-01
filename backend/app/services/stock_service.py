from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.stock import StockItem
from app.schemas.stock import StockItemCreate
from app.utils.pagination import normalize, page_count

SORTABLE = {
    "received_date": StockItem.received_date,
    "purchase_price": StockItem.purchase_price,
    "quantity": StockItem.quantity,
    "supplier": StockItem.supplier,
    "id": StockItem.id,
}


@dataclass
class StockFilters:
    q: str | None = None
    supplier: str | None = None
    product_type: str | None = None
    location: str | None = None
    currency: str | None = None
    min_price: Decimal | None = None
    max_price: Decimal | None = None
    received_from: date | None = None
    received_to: date | None = None


def find_duplicate(db: Session, payload: StockItemCreate) -> StockItem | None:
    """An existing lot identical on every business field (the natural key)."""
    stmt = select(StockItem).where(
        StockItem.supplier == payload.supplier,
        StockItem.product_type == payload.product_type,
        StockItem.location == payload.location,
        StockItem.quantity == payload.quantity,
        StockItem.purchase_price == payload.purchase_price,
        StockItem.currency == payload.currency,
        StockItem.received_date == payload.received_date,
    )
    return db.scalars(stmt.limit(1)).first()


def create_stock_item(db: Session, payload: StockItemCreate) -> StockItem:
    item = StockItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def _apply_filters(stmt, f: StockFilters):
    if f.q:
        term = f"%{f.q.strip().lower()}%"
        stmt = stmt.where(
            func.lower(StockItem.supplier).like(term)
            | func.lower(StockItem.product_type).like(term)
            | func.lower(StockItem.location).like(term)
        )
    if f.supplier:
        stmt = stmt.where(func.lower(StockItem.supplier) == f.supplier.strip().lower())
    if f.product_type:
        stmt = stmt.where(func.lower(StockItem.product_type) == f.product_type.strip().lower())
    if f.location:
        stmt = stmt.where(func.lower(StockItem.location) == f.location.strip().lower())
    if f.currency:
        stmt = stmt.where(StockItem.currency == f.currency.strip().upper())
    if f.min_price is not None:
        stmt = stmt.where(StockItem.purchase_price >= f.min_price)
    if f.max_price is not None:
        stmt = stmt.where(StockItem.purchase_price <= f.max_price)
    if f.received_from:
        stmt = stmt.where(StockItem.received_date >= f.received_from)
    if f.received_to:
        stmt = stmt.where(StockItem.received_date <= f.received_to)
    return stmt


def list_stock_items(
    db: Session,
    filters: StockFilters,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "received_date",
    sort_dir: str = "desc",
) -> dict:
    page, page_size = normalize(page, page_size)

    base = _apply_filters(select(StockItem), filters)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0

    column = SORTABLE.get(sort_by, StockItem.received_date)
    order = column.desc() if sort_dir.lower() == "desc" else column.asc()
    stmt = base.order_by(order, StockItem.id.desc()).offset((page - 1) * page_size).limit(page_size)

    return {
        "items": list(db.scalars(stmt)),
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": page_count(total, page_size),
    }


def list_by_supplier(db: Session, supplier: str, page: int = 1, page_size: int = 20) -> dict:
    return list_stock_items(db, StockFilters(supplier=supplier), page=page, page_size=page_size)


def distinct_values(db: Session) -> dict:
    return {
        "suppliers": sorted(db.scalars(select(StockItem.supplier).distinct())),
        "product_types": sorted(db.scalars(select(StockItem.product_type).distinct())),
        "locations": sorted(db.scalars(select(StockItem.location).distinct())),
        "currencies": sorted(db.scalars(select(StockItem.currency).distinct())),
    }
