"""Insert a small demo dataset. Usage: python seed.py"""

import random
from datetime import date, timedelta

from app.core.database import SessionLocal
from app.models.stock import StockItem

SUPPLIERS = ["Acme Metals", "Gulf Traders", "Nordic Supply", "Delta Imports"]
PRODUCTS = ["Copper Wire", "Aluminium Sheet", "Steel Rod", "PVC Pipe"]
LOCATIONS = ["Dubai", "Jebel Ali", "Sharjah", "Abu Dhabi"]
BASE_PRICE = {"Copper Wire": 42, "Aluminium Sheet": 18, "Steel Rod": 9, "PVC Pipe": 4}


def main() -> None:
    random.seed(7)
    db = SessionLocal()
    rows = []
    for _ in range(60):
        product = random.choice(PRODUCTS)
        price = BASE_PRICE[product] * random.choice([1.0, 1.05, 0.95, 1.1, 0.72, 0.98])
        rows.append(
            StockItem(
                supplier=random.choice(SUPPLIERS),
                product_type=product,
                location=random.choice(LOCATIONS),
                quantity=random.randint(10, 500),
                purchase_price=round(price, 2),
                currency="AED",
                received_date=date.today() - timedelta(days=random.randint(0, 120)),
            )
        )
    db.add_all(rows)
    db.commit()
    print(f"Inserted {len(rows)} stock items.")


if __name__ == "__main__":
    main()
