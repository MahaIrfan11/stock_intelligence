from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class Opportunity(BaseModel):
    stock_item_id: int
    supplier: str
    product_type: str
    location: str
    currency: str
    quantity: Decimal
    unit_price: Decimal
    peer_median_price: Decimal
    discount_pct: float
    estimated_saving: Decimal
    sample_size: int
    received_date: date


class OpportunityResponse(BaseModel):
    rule: str
    parameters: dict
    count: int
    opportunities: list[Opportunity]
