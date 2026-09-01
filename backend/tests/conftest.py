import os
import tempfile

import pytest

# Tests run against a throwaway SQLite database; the app itself targets PostgreSQL.
_db_file = os.path.join(tempfile.gettempdir(), "stock_intelligence_test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db_file}"
os.environ["OPP_MIN_SAMPLE"] = "3"
os.environ["OPP_DISCOUNT_THRESHOLD"] = "0.15"
os.environ["OPP_LOOKBACK_DAYS"] = "180"

from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def sample_item():
    def _make(**overrides):
        payload = {
            "supplier": "Acme Metals",
            "product_type": "Copper Wire",
            "location": "Dubai",
            "quantity": 100,
            "purchase_price": 10.0,
            "currency": "AED",
            "received_date": "2026-08-01",
        }
        payload.update(overrides)
        return payload

    return _make
