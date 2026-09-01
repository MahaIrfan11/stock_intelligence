from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Index, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class StockItem(Base):
    """A single received stock lot from a supplier."""

    __tablename__ = "stock_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supplier: Mapped[str] = mapped_column(String(120), nullable=False)
    product_type: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    purchase_price: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    received_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_stock_items_quantity_positive"),
        CheckConstraint("purchase_price >= 0", name="ck_stock_items_price_non_negative"),
        Index("ix_stock_items_supplier", "supplier"),
        Index("ix_stock_items_product_type", "product_type"),
        Index("ix_stock_items_location", "location"),
        Index("ix_stock_items_received_date", "received_date"),
        Index("ix_stock_items_type_currency_date", "product_type", "currency", "received_date"),
        # Supports the duplicate lookup performed before every insert.
        Index(
            "ix_stock_items_natural_key",
            "supplier", "product_type", "location",
            "quantity", "purchase_price", "currency", "received_date",
        ),
    )
