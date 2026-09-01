from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import get_settings
from app.schemas.stock import Page, StockItemCreate, StockItemOut
from app.services import stock_service
from app.services.stock_service import StockFilters

router = APIRouter(prefix="/stock", tags=["stock"])
settings = get_settings()


@router.post("", response_model=StockItemOut, status_code=status.HTTP_201_CREATED)
def create_stock(
    payload: StockItemCreate,
    db: Annotated[Session, Depends(get_db)],
    allow_duplicate: bool = Query(False, description="Confirm an intentional repeat lot"),
):
    """Create a lot. Identical lots are refused with 409 unless explicitly confirmed."""
    if not allow_duplicate:
        existing = stock_service.find_duplicate(db, payload)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "duplicate_stock_item",
                    "message": "An identical lot already exists.",
                    "existing": StockItemOut.model_validate(existing).model_dump(mode="json"),
                },
            )
    return stock_service.create_stock_item(db, payload)


@router.get("", response_model=Page[StockItemOut])
def list_stock(
    db: Annotated[Session, Depends(get_db)],
    q: str | None = Query(None, description="Free-text match on supplier, product type or location"),
    supplier: str | None = None,
    product_type: str | None = None,
    location: str | None = None,
    currency: str | None = None,
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    received_from: date | None = None,
    received_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    sort_by: str = "received_date",
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
):
    filters = StockFilters(
        q=q,
        supplier=supplier,
        product_type=product_type,
        location=location,
        currency=currency,
        min_price=min_price,
        max_price=max_price,
        received_from=received_from,
        received_to=received_to,
    )
    return stock_service.list_stock_items(db, filters, page, page_size, sort_by, sort_dir)


@router.get("/facets")
def facets(db: Annotated[Session, Depends(get_db)]):
    """Distinct filter values, used by the UI dropdowns."""
    return stock_service.distinct_values(db)


@router.get("/{supplier}", response_model=Page[StockItemOut])
def list_stock_by_supplier(
    supplier: str,
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
):
    return stock_service.list_by_supplier(db, supplier, page, page_size)
