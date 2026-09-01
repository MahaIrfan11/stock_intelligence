"""Opportunity rule: under-priced lots versus their peer group median.

Peer group = same product_type + currency, received within the lookback window.
A lot is an opportunity when its unit price is at least `threshold` below the
peer median and the group has at least `min_sample` lots.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.stock import StockItem
from app.utils.stats import median

RULE_TEXT = (
    "A stock lot is an opportunity when its unit purchase price is at least "
    "DISCOUNT_THRESHOLD below the median unit price of its peer group "
    "(same product type and currency, received within LOOKBACK_DAYS), and the "
    "peer group contains at least MIN_SAMPLE lots."
)


def find_opportunities(
    db: Session,
    product_type: str | None = None,
    location: str | None = None,
    limit: int = 50,
) -> dict:
    s = get_settings()
    cutoff = date.today() - timedelta(days=s.opp_lookback_days)
    threshold = Decimal(str(s.opp_discount_threshold))

    stmt = select(StockItem).where(StockItem.received_date >= cutoff)
    if product_type:
        stmt = stmt.where(StockItem.product_type == product_type)
    if location:
        stmt = stmt.where(StockItem.location == location)

    groups: dict[tuple[str, str], list[StockItem]] = defaultdict(list)
    for item in db.scalars(stmt):
        groups[(item.product_type, item.currency)].append(item)

    results = []
    for items in groups.values():
        if len(items) < s.opp_min_sample:
            continue
        peer_median = median([i.purchase_price for i in items])
        if peer_median <= 0:
            continue
        for item in items:
            discount = (peer_median - item.purchase_price) / peer_median
            if discount < threshold:
                continue
            results.append(
                {
                    "stock_item_id": item.id,
                    "supplier": item.supplier,
                    "product_type": item.product_type,
                    "location": item.location,
                    "currency": item.currency,
                    "quantity": item.quantity,
                    "unit_price": item.purchase_price,
                    "peer_median_price": peer_median,
                    "discount_pct": round(float(discount) * 100, 2),
                    "estimated_saving": (peer_median - item.purchase_price) * item.quantity,
                    "sample_size": len(items),
                    "received_date": item.received_date,
                }
            )

    results.sort(key=lambda r: r["discount_pct"], reverse=True)
    return {
        "rule": RULE_TEXT,
        "parameters": {
            "lookback_days": s.opp_lookback_days,
            "min_sample": s.opp_min_sample,
            "discount_threshold": s.opp_discount_threshold,
        },
        "count": len(results),
        "opportunities": results[:limit],
    }
