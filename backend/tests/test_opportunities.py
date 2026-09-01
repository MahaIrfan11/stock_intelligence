from datetime import date, timedelta

TODAY = date.today().isoformat()
OLD = (date.today() - timedelta(days=400)).isoformat()


def test_flags_below_median_lots(client, sample_item):
    for i, p in enumerate([10, 10, 10, 7]):  # median 10 -> the 7 is 30% below
        client.post(
            "/api/stock",
            json=sample_item(supplier=f"S{i}", purchase_price=p, received_date=TODAY),
        )

    body = client.get("/api/opportunities").json()
    assert body["count"] == 1
    opp = body["opportunities"][0]
    assert opp["supplier"] == "S3"
    assert opp["discount_pct"] == 30.0
    assert float(opp["estimated_saving"]) == 300.0


def test_respects_min_sample(client, sample_item):
    client.post("/api/stock", json=sample_item(purchase_price=10, received_date=TODAY))
    client.post("/api/stock", json=sample_item(purchase_price=4, received_date=TODAY))
    assert client.get("/api/opportunities").json()["count"] == 0


def test_ignores_lots_outside_lookback(client, sample_item):
    for p in (10, 10, 10, 5):
        client.post("/api/stock", json=sample_item(purchase_price=p, received_date=OLD))
    assert client.get("/api/opportunities").json()["count"] == 0


def test_groups_are_currency_specific(client, sample_item):
    for p in (10, 10, 10):
        client.post("/api/stock", json=sample_item(purchase_price=p, received_date=TODAY))
    # A cheap lot in another currency has no peer group of its own.
    client.post("/api/stock", json=sample_item(purchase_price=2, currency="USD", received_date=TODAY))
    assert client.get("/api/opportunities").json()["count"] == 0
