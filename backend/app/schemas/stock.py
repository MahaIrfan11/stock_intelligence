from datetime import date
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

T = TypeVar("T")

CURRENCIES = {"AED", "USD", "EUR", "GBP", "INR", "CNY", "JPY", "SAR", "CHF", "AUD", "CAD"}


class StockItemCreate(BaseModel):
    supplier: str = Field(min_length=1, max_length=120)
    product_type: str = Field(min_length=1, max_length=120)
    location: str = Field(min_length=1, max_length=120)
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    purchase_price: Decimal = Field(ge=0, max_digits=14, decimal_places=4)
    currency: str = Field(min_length=3, max_length=3)
    received_date: date

    @field_validator("supplier", "product_type", "location")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in CURRENCIES:
            raise ValueError(f"unsupported currency '{v}'")
        return v

    @field_validator("received_date")
    @classmethod
    def not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("received_date cannot be in the future")
        return v


class StockItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    supplier: str
    product_type: str
    location: str
    quantity: Decimal
    purchase_price: Decimal
    currency: str
    received_date: date


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int
